// A small payments core: a few fixed payments stand in for the stored ones, and a few fixed
// card numbers, currencies and keys stand in for the answers of banks and of earlier requests.
import { emit, fail, ok, type DomainCoreImplementation } from './generated/domain.runtime.generated';

type Status = 'pending' | 'authorized' | 'failed' | 'captured' | 'voided' | 'expired' | 'partially_refunded' | 'refunded';

interface Stored {
  readonly merchant_id: string;
  readonly amount: number;
  readonly status: Status;
  readonly captured_amount: number;
  readonly refunded_amount: number;
  /** The capture was more than 180 days ago. */
  readonly captured_long_ago?: boolean;
}

const NOW = '2026-11-22T10:00:00Z';
const MERCHANT = 'mer_1';
const EVENT_ID = '123e4567-e89b-12d3-a456-426614174000';
const paymentId = (word: string) => `pay_${word.padEnd(24, '0')}`;

const PAYMENTS: Readonly<Record<string, Stored>> = {
  [paymentId('authorized')]: { merchant_id: MERCHANT, amount: 5000, status: 'authorized', captured_amount: 0, refunded_amount: 0 },
  [paymentId('captured')]: { merchant_id: MERCHANT, amount: 5000, status: 'captured', captured_amount: 5000, refunded_amount: 0 },
  [paymentId('partiallyrefunded')]: { merchant_id: MERCHANT, amount: 5000, status: 'partially_refunded', captured_amount: 5000, refunded_amount: 2000 },
  [paymentId('voided')]: { merchant_id: MERCHANT, amount: 5000, status: 'voided', captured_amount: 0, refunded_amount: 0 },
  [paymentId('capturedlongago')]: { merchant_id: MERCHANT, amount: 5000, status: 'captured', captured_amount: 5000, refunded_amount: 0, captured_long_ago: true },
};

const REFUND_ID = `re_${'1'.padStart(24, '0')}`;
const REFUND = { payment_id: paymentId('partiallyrefunded'), amount: 2000 };

/** The test cards whose bank refuses the payment. */
const REFUSING_CARDS = {
  '4000000000000002': 'urn:corpus:payments:payment:error:card_declined',
  '4000000000009995': 'urn:corpus:payments:payment:error:insufficient_funds',
  '4000000000000069': 'urn:corpus:payments:payment:error:expired_card',
  '4100000000000019': 'urn:corpus:payments:payment:error:fraud_suspected',
} as const;
const UNSUPPORTED_CURRENCY = 'XXX';
/** A key that an earlier request with a different body used. */
const USED_KEY = 'used-key';

const find = (merchant: string, id: string): Stored | undefined => {
  const payment = PAYMENTS[id];
  return payment && payment.merchant_id === merchant ? payment : undefined;
};

const brandOf = (number: string) =>
  number.startsWith('4') ? 'visa' : /^5[1-5]/.test(number) ? 'mastercard' : /^3[47]/.test(number) ? 'amex' : 'other';

const change = (id: string, p: Stored, previous: Status | undefined, next: Status) => ({
  event_id: EVENT_ID,
  payment_id: id,
  merchant_id: p.merchant_id,
  amount: p.amount,
  currency: 'EUR',
  ...(previous ? { previous_status: previous } : {}),
  new_status: next,
  occurred_at: NOW,
});

export const core = {
  'urn:corpus:payments:payment:operation:create_payment': (request) => {
    const { merchant_id, amount, currency, method, idempotency_key, line_items, card } = request;
    if (merchant_id !== MERCHANT) return fail('urn:corpus:payments:payment:error:not_found', {});
    if (idempotency_key === USED_KEY) return fail('urn:corpus:payments:payment:error:idempotency_conflict', { idempotency_key });
    if (line_items && line_items.reduce((sum, line) => sum + line.quantity * line.unit_amount, 0) !== amount) {
      return fail('urn:corpus:payments:payment:error:invalid_request', {});
    }
    if (currency === UNSUPPORTED_CURRENCY) return fail('urn:corpus:payments:payment:error:unsupported_currency', { currency });
    const number: string = card?.card_number ?? '';
    if (number in REFUSING_CARDS) return fail(REFUSING_CARDS[number as keyof typeof REFUSING_CARDS], {});

    const payment_id = paymentId('new');
    const status = method === 'card' ? 'authorized' : 'pending';
    const stored: Stored = { merchant_id, amount, status, captured_amount: 0, refunded_amount: 0 };
    const event = change(payment_id, stored, undefined, status);
    return ok(
      {
        payment_id,
        merchant_id,
        amount,
        currency,
        method,
        status,
        ...(card ? { card: { brand: brandOf(number), last4: number.slice(-4), exp_month: card.exp_month, exp_year: card.exp_year } } : {}),
        created_at: NOW,
      },
      [
        status === 'authorized'
          ? emit('urn:corpus:payments:payment:event:authorized', { ...event, currency })
          : emit('urn:corpus:payments:payment:event:pending', { ...event, currency }),
      ],
    );
  },

  'urn:corpus:payments:payment:operation:capture_payment': ({ merchant_id, payment_id, amount }) => {
    const p = find(merchant_id, payment_id);
    if (!p) return fail('urn:corpus:payments:payment:error:not_found', {});
    if (p.status !== 'authorized') return fail('urn:corpus:payments:payment:error:invalid_state', { status: p.status });
    if (amount !== undefined && amount > p.amount) {
      return fail('urn:corpus:payments:payment:error:capture_exceeds_authorized', { amount, authorized_amount: p.amount });
    }
    const captured = amount ?? p.amount;
    return ok(
      { payment_id, currency: 'EUR', authorized_amount: p.amount, captured_amount: captured, status: 'captured' as const },
      [emit('urn:corpus:payments:payment:event:captured', change(payment_id, p, 'authorized', 'captured'))],
    );
  },

  'urn:corpus:payments:payment:operation:void_payment': ({ merchant_id, payment_id }) => {
    const p = find(merchant_id, payment_id);
    if (!p) return fail('urn:corpus:payments:payment:error:not_found', {});
    if (p.status !== 'authorized') return fail('urn:corpus:payments:payment:error:invalid_state', { status: p.status });
    return ok(
      { payment_id, merchant_id, amount: p.amount, currency: 'EUR', method: 'card' as const, status: 'voided' as const, captured_amount: 0, refunded_amount: 0, created_at: NOW },
      [emit('urn:corpus:payments:payment:event:voided', change(payment_id, p, 'authorized', 'voided'))],
    );
  },

  'urn:corpus:payments:payment:operation:get_payment': ({ merchant_id, payment_id }) => {
    const p = find(merchant_id, payment_id);
    if (!p) return fail('urn:corpus:payments:payment:error:not_found', {});
    return ok({
      payment_id,
      merchant_id,
      amount: p.amount,
      currency: 'EUR',
      method: 'card' as const,
      status: p.status,
      captured_amount: p.captured_amount,
      refunded_amount: p.refunded_amount,
      card: { brand: 'visa' as const, last4: '4242', exp_month: 12, exp_year: 2030 },
      created_at: NOW,
    });
  },

  'urn:corpus:payments:refund:operation:refund_payment': ({ merchant_id, payment_id, amount, idempotency_key }) => {
    const p = find(merchant_id, payment_id);
    if (!p) return fail('urn:corpus:payments:payment:error:not_found', {});
    if (p.status !== 'captured' && p.status !== 'partially_refunded') {
      return fail('urn:corpus:payments:payment:error:invalid_state', { status: p.status });
    }
    if (idempotency_key === USED_KEY) return fail('urn:corpus:payments:payment:error:idempotency_conflict', { idempotency_key });
    if (p.captured_long_ago) return fail('urn:corpus:payments:refund:error:refund_window_closed', {});
    const available = p.captured_amount - p.refunded_amount;
    if (amount > available) return fail('urn:corpus:payments:refund:error:amount_exceeds_captured', { amount, available });

    const refunded_total = p.refunded_amount + amount;
    const next = refunded_total === p.captured_amount ? 'refunded' : 'partially_refunded';
    const event = change(payment_id, p, p.status, next);
    return ok(
      { refund_id: `re_${'2'.padStart(24, '0')}`, payment_id, merchant_id, amount, currency: 'EUR', captured_amount: p.captured_amount, refunded_total, created_at: NOW },
      [
        next === 'refunded'
          ? emit('urn:corpus:payments:payment:event:refunded', event)
          : emit('urn:corpus:payments:payment:event:partially_refunded', event),
      ],
    );
  },

  'urn:corpus:payments:refund:operation:get_refund': ({ merchant_id, refund_id }) => {
    const p = find(merchant_id, REFUND.payment_id);
    if (refund_id !== REFUND_ID || !p) return fail('urn:corpus:payments:payment:error:not_found', {});
    return ok({
      refund_id,
      payment_id: REFUND.payment_id,
      merchant_id,
      amount: REFUND.amount,
      currency: 'EUR',
      captured_amount: p.captured_amount,
      refunded_total: p.refunded_amount,
      created_at: NOW,
    });
  },
} satisfies DomainCoreImplementation;
