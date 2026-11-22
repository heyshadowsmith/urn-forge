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
const TAKEN_CUSTOMER = 'cus_taken';
const MISSING_INVOICE = 'in_missing';
const NOW = '2026-11-22T10:00:00Z';
const EVENT_ID = '7d1c2a4e-5b6f-4a8b-9c0d-1e2f3a4b5c6d';

// A plan id names its period: "yearly" bills each year, "quarterly" each 3 months and
// "annual-monthly" each 12 months. Any other plan bills each month.
const periodOf = (plan_id: string) =>
  plan_id.includes('yearly')
    ? { billing_period: 'year' as const, interval_count: 1 }
    : { billing_period: 'month' as const, interval_count: plan_id.includes('quarterly') ? 3 : plan_id.includes('annual-monthly') ? 12 : 1 };

const planOf = (plan_id: string) => ({
  plan_id,
  ...periodOf(plan_id),
  price: { amount_minor: 1500, currency: plan_id.includes('usd') ? 'USD' : 'EUR' },
});

const subscription = (subscription_id: string, status: 'active' | 'paused' | 'canceled' = 'active') => ({
  subscription_id,
  customer_id: 'cus_1',
  plan: planOf('plan_basic'),
  quantity: 1,
  status,
  current_period_start: '2026-11-01T00:00:00Z',
  current_period_end: '2026-12-01T00:00:00Z',
});

const statusOf = (id: string) => (id === CANCELED ? 'canceled' : id === PAUSED ? 'paused' : 'active');

const invoice = (invoice_id: string, subscription_id: string) => ({
  invoice_id,
  subscription_id,
  status: 'paid' as const,
  period_start: '2026-11-01T00:00:00Z',
  period_end: '2026-12-01T00:00:00Z',
  lines: [{ quantity: 2, amount: { amount_minor: 3000, currency: 'EUR' } }],
  total: { amount_minor: 3000, currency: 'EUR' },
});

const meta = (subscription_id: string) => ({ event_id: EVENT_ID, subscription_id, occurred_at: NOW });

export const core = {
  'urn:corpus:subscriptions:subscription:operation:create_subscription': (req) => {
    if (req.customer_id === TAKEN_CUSTOMER) {
      return fail('urn:corpus:subscriptions:subscription:error:conflict', { customer_id: req.customer_id, plan_id: req.plan_id });
    }
    const trialEnd =
      req.trial_end ?? (req.trial_days !== undefined && req.trial_days > 0 ? addDays(req.requested_on, req.trial_days) : undefined);
    const base = { ...subscription(CREATED), customer_id: req.customer_id, plan: planOf(req.plan_id), quantity: req.quantity };
    const created = emit('urn:corpus:subscriptions:subscription:event:created', meta(CREATED));
    if (trialEnd === undefined) {
      return ok(base, [
        created,
        emit('urn:corpus:subscriptions:invoice:event:created', { ...meta(CREATED), invoice_id: 'in_1' }),
        emit('urn:corpus:subscriptions:invoice:event:paid', { ...meta(CREATED), invoice_id: 'in_1' }),
      ]);
    }
    const soon = daysBetween(req.requested_on, trialEnd) < 3;
    const events = soon ? [created, emit('urn:corpus:subscriptions:subscription:event:trial_will_end', meta(CREATED))] : [created];
    return ok({ ...base, status: 'trialing' as const, trial_end: trialEnd }, events);
  },

  'urn:corpus:subscriptions:subscription:operation:read_subscription': ({ subscription_id }) =>
    subscription_id === MISSING
      ? fail('urn:corpus:subscriptions:subscription:error:not_found', { subscription_id })
      : ok(subscription(subscription_id, statusOf(subscription_id))),

  'urn:corpus:subscriptions:subscription:operation:list_subscriptions': ({ customer_id, status }) => {
    const all = [subscription(ID_24('a')), subscription(PAUSED, 'paused'), subscription(CANCELED, 'canceled')];
    return ok({ subscriptions: all.filter((s) => status === undefined || s.status === status).map((s) => ({ ...s, customer_id })) });
  },

  'urn:corpus:subscriptions:subscription:operation:change_plan': ({ subscription_id, plan_id, proration }, current) => {
    const next = planOf(plan_id);
    if (next.price.currency !== current.plan.price.currency) {
      return fail('urn:corpus:subscriptions:subscription:error:currency_mismatch', {
        plan_currency: next.price.currency,
        subscription_currency: current.plan.price.currency,
      });
    }
    const changed = proration === 'at_period_end' ? { ...current, scheduled_plan_id: plan_id } : { ...current, plan: next };
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
