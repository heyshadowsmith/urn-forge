// A small subscriptions core. It holds no store. An operation that changes a subscription gets
// the stored record from the shell; for the others, a few fixed ids stand for the stored records
// that the scenarios need, and every other id is an active subscription.
import { emit, fail, ok, type DomainCoreImplementation } from './generated/domain.runtime.generated';
import { addDays, daysBetween } from 'urn-forge/exact';

const ID_24 = (c: string) => `sub_${c.repeat(24)}`;

export const MISSING = ID_24('0');
export const CANCELED = ID_24('c');
export const PAUSED = ID_24('p');
const CREATED = ID_24('n');
const MISSING_INVOICE = 'in_missing';
const NOW = '2026-11-22T10:00:00Z';

// A plan id names its period: "yearly" bills each year, "quarterly" each 3 months and
// "annual-monthly" each 12 months. Any other plan bills each month.
const periodOf = (plan_id: string) =>
  plan_id.includes('yearly')
    ? { billing_period: 'year' as const, interval_count: 1 }
    : { billing_period: 'month' as const, interval_count: plan_id.includes('quarterly') ? 3 : plan_id.includes('annual-monthly') ? 12 : 1 };

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

const monthsOf = (period: { billing_period: 'month' | 'year'; interval_count: number }) =>
  period.billing_period === 'year' ? 12 * period.interval_count : period.interval_count;

// A billing period of a plan, from its start.
const periodFrom = (start: string, period: { billing_period: 'month' | 'year'; interval_count: number }) => ({
  current_period_start: start,
  current_period_end: addMonths(start, monthsOf(period)),
});

const planOf = (plan_id: string) => ({
  plan_id,
  ...periodOf(plan_id),
  price: { amount_minor: 1500, currency: plan_id.includes('usd') ? 'USD' : 'EUR' },
});

const subscription = (subscription_id: string, status: 'active' | 'paused' | 'canceled' = 'active') => ({
  subscription_id,
  customer_id: 'cus_1',
  plan: planOf('plan_basic'),
  plan_id: 'plan_basic',
  quantity: 1,
  status,
  current_period_start: '2026-11-01T00:00:00Z',
  current_period_end: '2026-12-01T00:00:00Z',
});

const statusOf = (id: string) => (id === CANCELED ? 'canceled' : id === PAUSED ? 'paused' : 'active');

// A few fixed invoice ids stand for invoices of other plans and periods; any other id is the
// monthly invoice of November 2026.
const INVOICE_PERIODS: Readonly<Record<string, { plan_id: string; start: string }>> = {
  'in_2026-01-31': { plan_id: 'plan_basic', start: '2026-01-31T00:00:00Z' },
  'in_2028-01-31': { plan_id: 'plan_basic', start: '2028-01-31T00:00:00Z' },
  'in_2026-03-31': { plan_id: 'plan_basic', start: '2026-03-31T12:30:00Z' },
  'in_2026-12-31': { plan_id: 'plan_basic', start: '2026-12-31T23:59:59Z' },
  'in_quarterly-2026-11-30': { plan_id: 'plan_team-quarterly', start: '2026-11-30T00:00:00Z' },
  'in_yearly-2028-02-29': { plan_id: 'plan_pro-yearly', start: '2028-02-29T00:00:00Z' },
};

const invoicePeriod = (invoice_id: string) => {
  const { plan_id, start } = INVOICE_PERIODS[invoice_id] ?? { plan_id: 'plan_basic', start: '2026-11-01T00:00:00Z' };
  const period = periodOf(plan_id);
  const { current_period_start, current_period_end } = periodFrom(start, period);
  return { period_start: current_period_start, period_end: current_period_end, ...period };
};

const invoice = (invoice_id: string, subscription_id: string) => ({
  invoice_id,
  subscription_id,
  status: 'paid' as const,
  ...invoicePeriod(invoice_id),
  lines: [{ quantity: 2, amount: { amount_minor: 3000, currency: 'EUR' } }],
  total: { amount_minor: 3000, currency: 'EUR' },
});

// The shell gives each event its id (newEventId), so the core sets only the subscription and the time.
const meta = (subscription_id: string) => ({ subscription_id, occurred_at: NOW });

export const core = {
  // The shell gives the time of the call (now); the day of the request is its UTC date.
  'urn:corpus:subscriptions:subscription:operation:create_subscription': (req, _current, now) => {
    const today = now.slice(0, 10);
    // The core sees one call, not the stored subscriptions: a second live subscription of the
    // customer to the plan is refused by the unique entry of the subscription (the store's index,
    // and commitOnce answers conflict).
    const trialEnd =
      req.trial_end ?? (req.trial_days !== undefined && req.trial_days > 0 ? addDays(today, req.trial_days) : undefined);
    const plan = planOf(req.plan_id);
    // The first period starts now and lasts the plan's period.
    const base = { ...subscription(CREATED), customer_id: req.customer_id, plan, plan_id: req.plan_id, quantity: req.quantity, ...periodFrom(now, plan) };
    const created = emit('urn:corpus:subscriptions:subscription:event:created', meta(CREATED));
    if (trialEnd === undefined) {
      return ok(base, [
        created,
        emit('urn:corpus:subscriptions:invoice:event:created', { ...meta(CREATED), invoice_id: 'in_1' }),
        emit('urn:corpus:subscriptions:invoice:event:paid', { ...meta(CREATED), invoice_id: 'in_1' }),
      ]);
    }
    // A trial shorter than 3 days announces its end at once, and keeps the mark so that the clock
    // (announce_trial_end) does not announce it again.
    const soon = daysBetween(today, trialEnd) < 3;
    const trialing = { ...base, status: 'trialing' as const, trial_end: trialEnd };
    return soon
      ? ok({ ...trialing, trial_will_end_sent_at: now }, [created, emit('urn:corpus:subscriptions:subscription:event:trial_will_end', meta(CREATED))])
      : ok(trialing, [created]);
  },

  'urn:corpus:subscriptions:subscription:operation:read_subscription': ({ subscription_id }) =>
    subscription_id === MISSING
      ? fail('urn:corpus:subscriptions:subscription:error:not_found', { subscription_id })
      : ok(subscription(subscription_id, statusOf(subscription_id))),

  'urn:corpus:subscriptions:subscription:operation:list_subscriptions': ({ customer_id, status }) => {
    const all = [subscription(ID_24('a')), subscription(PAUSED, 'paused'), subscription(CANCELED, 'canceled')];
    return ok({ subscriptions: all.filter((s) => status === undefined || s.status === status).map((s) => ({ ...s, customer_id })) });
  },

  'urn:corpus:subscriptions:subscription:operation:change_plan': ({ subscription_id, plan_id, proration }, current, now) => {
    const next = planOf(plan_id);
    if (next.price.currency !== current.plan.price.currency) {
      return fail('urn:corpus:subscriptions:subscription:error:currency_mismatch', {
        plan_currency: next.price.currency,
        subscription_currency: current.plan.price.currency,
      });
    }
    // A plan with the same period keeps the current period; a plan with another one starts a new period now.
    const samePeriod = next.billing_period === current.plan.billing_period && next.interval_count === current.plan.interval_count;
    const changed =
      proration === 'at_period_end'
        ? { ...current, scheduled_plan_id: plan_id }
        : { ...current, plan: next, plan_id, ...(samePeriod ? {} : periodFrom(now, next)) };
    return ok(changed, [emit('urn:corpus:subscriptions:subscription:event:updated', meta(subscription_id))]);
  },

  'urn:corpus:subscriptions:subscription:operation:pause_subscription': ({ subscription_id, resume_on }, current) => {
    const paused = { ...current, status: 'paused' as const, ...(resume_on ? { resume_on } : {}) };
    return ok(paused, [emit('urn:corpus:subscriptions:subscription:event:updated', meta(subscription_id))]);
  },

  'urn:corpus:subscriptions:subscription:operation:resume_subscription': ({ subscription_id }, current) => {
    const { resume_on: _resumed, ...rest } = current;
    return ok({ ...rest, status: 'active' as const }, [emit('urn:corpus:subscriptions:subscription:event:updated', meta(subscription_id))]);
  },

  'urn:corpus:subscriptions:subscription:operation:cancel_subscription': ({ subscription_id, cancel_mode }, current) => {
    const canceled = cancel_mode === 'immediately' ? { ...current, status: 'canceled' as const } : { ...current, cancel_at: cancel_mode };
    return ok(canceled, [emit('urn:corpus:subscriptions:subscription:event:canceled', meta(subscription_id))]);
  },

  // The shell's clock calls it for each trialing subscription whose trial ends within 3 days and
  // that was not announced yet; the subscription keeps its status and gets the mark.
  'urn:corpus:subscriptions:subscription:operation:announce_trial_end': ({ subscription_id }, current, now) =>
    ok({ ...current, trial_will_end_sent_at: now }, [emit('urn:corpus:subscriptions:subscription:event:trial_will_end', { subscription_id, occurred_at: now })]),

  'urn:corpus:subscriptions:invoice:operation:read_invoice': ({ invoice_id }) =>
    invoice_id === MISSING_INVOICE
      ? fail('urn:corpus:subscriptions:invoice:error:not_found', { invoice_id })
      : ok(invoice(invoice_id, ID_24('a'))),

  'urn:corpus:subscriptions:invoice:operation:list_invoices': ({ subscription_id, status }) => {
    if (subscription_id === MISSING) return fail('urn:corpus:subscriptions:subscription:error:not_found', { subscription_id });
    const all = [invoice('in_1', subscription_id), { ...invoice('in_2', subscription_id), status: 'open' as const }];
    return ok({ invoices: all.filter((i) => status === undefined || i.status === status) });
  },
} satisfies DomainCoreImplementation;
