// A small subscriptions core. It holds no store: the shell loads the stored records that a call
// needs into its input, and gives the caller and the time of the call (now). The core decides the
// answer; the harness, runOperation, checks the input before and the answer after.
import { answer, type DomainCore, type Event, type Plan, type Subscription } from './generated/domain.generated';

// Ids that the core makes, from the call that makes them, so that a run is deterministic: a hash
// (FNV-1a) of the text, in base 36 or hex. A real core would draw random ids.
const hash = (text: string, length: number, radix: 16 | 36): string => {
  let out = '';
  for (let round = 0; out.length < length; round++) {
    let h = 0x811c9dc5 ^ round;
    for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
    out += h.toString(radix).padStart(radix === 16 ? 8 : 7, '0');
  }
  return out.slice(0, length);
};
const newSubscriptionId = (customer_id: string, plan_id: string, now: string) => `sub_${hash(`${customer_id} ${plan_id} ${now}`, 24, 36)}`;
const newInvoiceId = (subscription_id: string, now: string) => `in_${hash(`${subscription_id} ${now}`, 12, 36)}`;
const newEventId = (text: string) => {
  const h = hash(text, 32, 16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

// The day of an instant in UTC, and a day n days later.
const dayOf = (instant: string) => instant.slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

// An instant in UTC, n calendar months later, at the same time of day. A day that the target month
// lacks is that month's last day: 2026-01-31T10:00:00Z + 1 is 2026-02-28T10:00:00Z.
export const addMonths = (instant: string, n: number): string => {
  const [year, month, day] = [Number(instant.slice(0, 4)), Number(instant.slice(5, 7)) - 1 + n, Number(instant.slice(8, 10))];
  const last = new Date(Date.UTC(2000, 0, 1));
  last.setUTCFullYear(year, month + 1, 0);
  const target = new Date(Date.UTC(2000, 0, 1));
  target.setUTCFullYear(year, month, Math.min(day, last.getUTCDate()));
  return `${target.toISOString().slice(0, 10)}${instant.slice(10)}`;
};

// A billing period of a plan, from its start.
const periodFrom = (start: string, plan: Plan) => ({
  current_period_start: start,
  current_period_end: addMonths(start, plan.billing_period === 'year' ? 12 * plan.interval_count : plan.interval_count),
});

const event = (event_type: Event['event_type'], subscription_id: string, occurred_at: string, invoice_id?: string): Event => ({
  event_id: newEventId(`${subscription_id} ${event_type} ${occurred_at}`),
  event_type,
  subscription_id,
  occurred_at,
  ...(invoice_id ? { invoice_id } : {}),
});

const isBillingAdmin = (caller: { caller_kind: string; staff_roles?: readonly string[] }) =>
  caller.caller_kind === 'staff' && (caller.staff_roles ?? []).includes('billing-admin');

// A customer may use only their own subscriptions; staff and the clock may use any.
const holds = (caller: { caller_kind: string; customer_id?: string }, stored: Subscription) =>
  caller.caller_kind !== 'customer' || caller.customer_id === stored.customer_id;

const LIVE = ['trialing', 'active', 'past_due', 'paused'];

export const core = {
  create_subscription: (input) => {
    if (!isBillingAdmin(input.caller)) return answer('forbidden', { caller: input.caller });
    if (input.existing_subscription) return answer('conflict', { customer_id: input.customer_id, plan_id: input.plan_id });
    const today = dayOf(input.now);
    const trialEnd = input.trial_end ?? (input.trial_days !== undefined && input.trial_days > 0 ? addDays(today, input.trial_days) : undefined);
    const subscription_id = newSubscriptionId(input.customer_id, input.plan_id, input.now);
    const base: Subscription = {
      subscription_id,
      customer_id: input.customer_id,
      plan: input.plan,
      plan_id: input.plan_id,
      quantity: input.quantity,
      subscription_status: 'active',
      ...periodFrom(input.now, input.plan),
    };
    const created = event('subscription.created', subscription_id, input.now);
    if (trialEnd === undefined) {
      const invoice_id = newInvoiceId(subscription_id, input.now);
      return answer('subscription_change', {
        subscription: base,
        events: [created, event('invoice.created', subscription_id, input.now, invoice_id), event('invoice.paid', subscription_id, input.now, invoice_id)],
      });
    }
    const trialing: Subscription = { ...base, subscription_status: 'trialing', trial_end: trialEnd };
    // A trial that ends less than 3 days after today is announced at once, and marked so that the
    // clock (announce_trial_end) does not announce it again.
    if (daysBetween(today, trialEnd) < 3) {
      return answer('subscription_change', {
        subscription: { ...trialing, trial_will_end_sent_at: input.now },
        events: [created, event('subscription.trial_will_end', subscription_id, input.now)],
      });
    }
    return answer('subscription_change', { subscription: trialing, events: [created] });
  },

  read_subscription: ({ subscription_id, caller, stored_subscription }) => {
    if (!stored_subscription) return answer('subscription_not_found', { subscription_id });
    if (!holds(caller, stored_subscription)) return answer('forbidden', { caller });
    return answer('subscription', stored_subscription);
  },

  list_subscriptions: ({ customer_id, subscription_status, caller, stored_subscriptions }) => {
    if (caller.caller_kind === 'customer' && caller.customer_id !== customer_id) return answer('forbidden', { caller });
    const subscriptions = stored_subscriptions.filter((s) => s.customer_id === customer_id && (subscription_status === undefined || s.subscription_status === subscription_status));
    return answer('subscription_list', { subscriptions });
  },

  change_plan: (input) => {
    const stored = input.stored_subscription;
    if (!stored) return answer('subscription_not_found', { subscription_id: input.subscription_id });
    if (!isBillingAdmin(input.caller)) return answer('forbidden', { caller: input.caller });
    if (!LIVE.includes(stored.subscription_status)) {
      return answer('invalid_state_transition', { subscription_id: input.subscription_id, subscription_status: stored.subscription_status });
    }
    const next = input.new_plan;
    if (next.price.currency !== stored.plan.price.currency) {
      return answer('currency_mismatch', { plan_currency: next.price.currency, subscription_currency: stored.plan.price.currency });
    }
    if (input.existing_subscription) return answer('conflict', { customer_id: stored.customer_id, plan_id: input.plan_id });
    const { scheduled_plan_id: _scheduled, ...rest } = stored;
    // A plan with the same period keeps the current period; a plan with another one starts a new period now.
    const samePeriod = next.billing_period === stored.plan.billing_period && next.interval_count === stored.plan.interval_count;
    const changed: Subscription =
      input.proration === 'at_period_end'
        ? { ...stored, scheduled_plan_id: input.plan_id }
        : { ...rest, plan: next, plan_id: input.plan_id, ...(samePeriod ? {} : periodFrom(input.now, next)) };
    return answer('subscription_change', { subscription: changed, events: [event('subscription.updated', stored.subscription_id, input.now)] });
  },

  pause_subscription: ({ subscription_id, resume_on, caller, now, stored_subscription: stored }) => {
    if (!stored) return answer('subscription_not_found', { subscription_id });
    if (!holds(caller, stored)) return answer('forbidden', { caller });
    if (stored.subscription_status !== 'active' && stored.subscription_status !== 'trialing') {
      return answer('invalid_state_transition', { subscription_id, subscription_status: stored.subscription_status });
    }
    const { resume_on: _old, ...rest } = stored;
    const paused: Subscription = { ...rest, subscription_status: 'paused', ...(resume_on ? { resume_on } : {}) };
    return answer('subscription_change', { subscription: paused, events: [event('subscription.updated', subscription_id, now)] });
  },

  resume_subscription: ({ subscription_id, caller, now, stored_subscription: stored }) => {
    if (!stored) return answer('subscription_not_found', { subscription_id });
    if (!holds(caller, stored)) return answer('forbidden', { caller });
    if (stored.subscription_status !== 'paused') {
      return answer('invalid_state_transition', { subscription_id, subscription_status: stored.subscription_status });
    }
    const { resume_on: _resumed, ...rest } = stored;
    return answer('subscription_change', { subscription: { ...rest, subscription_status: 'active' }, events: [event('subscription.updated', subscription_id, now)] });
  },

  cancel_subscription: ({ subscription_id, cancel_mode, caller, now, stored_subscription: stored }) => {
    if (!stored) return answer('subscription_not_found', { subscription_id });
    if (!holds(caller, stored)) return answer('forbidden', { caller });
    if (!LIVE.includes(stored.subscription_status)) {
      return answer('invalid_state_transition', { subscription_id, subscription_status: stored.subscription_status });
    }
    const canceled: Subscription = cancel_mode === 'immediately' ? { ...stored, subscription_status: 'canceled' } : { ...stored, cancel_at: 'at_period_end' };
    return answer('subscription_change', { subscription: canceled, events: [event('subscription.canceled', subscription_id, now)] });
  },

  // The shell's clock calls it for each trialing subscription whose trial ends within 3 days and
  // that was not announced yet; the subscription keeps its status and gets the mark.
  announce_trial_end: ({ subscription_id, caller, now, stored_subscription: stored }) => {
    if (!stored) return answer('subscription_not_found', { subscription_id });
    if (caller.caller_kind === 'customer') return answer('forbidden', { caller });
    const due =
      stored.subscription_status === 'trialing' &&
      stored.trial_will_end_sent_at === undefined &&
      stored.trial_end !== undefined &&
      daysBetween(dayOf(now), stored.trial_end) <= 3;
    if (!due) return answer('invalid_state_transition', { subscription_id, subscription_status: stored.subscription_status });
    return answer('subscription_change', {
      subscription: { ...stored, trial_will_end_sent_at: now },
      events: [event('subscription.trial_will_end', subscription_id, now)],
    });
  },

  read_invoice: ({ invoice_id, caller, stored_invoice, stored_subscription }) => {
    if (!stored_invoice) return answer('invoice_not_found', { invoice_id });
    if (stored_subscription && !holds(caller, stored_subscription)) return answer('forbidden', { caller });
    return answer('invoice', stored_invoice);
  },

  list_invoices: ({ subscription_id, invoice_status, caller, stored_subscription, stored_invoices }) => {
    if (!stored_subscription) return answer('subscription_not_found', { subscription_id });
    if (!holds(caller, stored_subscription)) return answer('forbidden', { caller });
    const invoices = stored_invoices.filter((i) => i.subscription_id === subscription_id && (invoice_status === undefined || i.invoice_status === invoice_status));
    return answer('invoice_list', { invoices });
  },
} satisfies DomainCore;
