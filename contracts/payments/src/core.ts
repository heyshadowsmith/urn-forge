// A small payments core. The operations that move a payment get it as `current`; the reads find
// it among a few fixed payments. A few fixed card numbers, currencies and keys stand in for the
// answers of banks and of earlier requests.
import { emit, fail, ok, type DomainCoreImplementation } from './generated/domain.runtime.generated';

type Status = 'pending' | 'authorized' | 'failed' | 'captured' | 'voided' | 'expired' | 'partially_refunded' | 'refunded';

interface Stored {
  readonly merchant_id: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: Status;
  readonly captured_amount: number;
  readonly refunded_amount: number;
}

const NOW = '2026-11-22T10:00:00Z';
const MERCHANT = 'mer_1';
const paymentId = (word: string) => `pay_${word.padEnd(24, '0')}`;

const PAYMENTS: Readonly<Record<string, Stored>> = {
  [paymentId('authorized')]: { merchant_id: MERCHANT, amount: 5000, currency: 'EUR', status: 'authorized', captured_amount: 0, refunded_amount: 0 },
  [paymentId('partiallyrefunded')]: { merchant_id: MERCHANT, amount: 5000, currency: 'EUR', status: 'partially_refunded', captured_amount: 5000, refunded_amount: 2000 },
};

/** The payment captured more than 180 days ago: the record does not hold when it was captured. */
const CAPTURED_LONG_AGO = paymentId('capturedlongago');

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

// The event of a change. The shell gives its event_id (newEventId), so the core does not.
const change = (id: string, p: Stored, previous: Status | undefined, next: Status) => ({
  payment_id: id,
  merchant_id: p.merchant_id,
  amount: p.amount,
  currency: p.currency,
  ...(previous ? { previous_status: previous } : {}),
  new_status: next,
  occurred_at: NOW,
});

export const core = {
  'urn:corpus:payments:payment:operation:create_payment': (request) => {
    const { merchant_id, amount, currency, method, idempotency_key, card } = request;
    if (merchant_id !== MERCHANT) return fail('urn:corpus:payments:payment:error:not_found', {});
    if (idempotency_key === USED_KEY) return fail('urn:corpus:payments:payment:error:idempotency_conflict', { idempotency_key });
    if (currency === UNSUPPORTED_CURRENCY) return fail('urn:corpus:payments:payment:error:unsupported_currency', { currency });
    const number: string = card?.card_number ?? '';
    if (number in REFUSING_CARDS) return fail(REFUSING_CARDS[number as keyof typeof REFUSING_CARDS], {});

    const payment_id = paymentId('new');
    const status = method === 'card' ? 'authorized' : 'pending';
    const stored: Stored = { merchant_id, amount, currency, status, captured_amount: 0, refunded_amount: 0 };
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
          ? emit('urn:corpus:payments:payment:event:authorized', event)
          : emit('urn:corpus:payments:payment:event:pending', event),
      ],
    );
  },

  'urn:corpus:payments:payment:operation:capture_payment': ({ merchant_id, payment_id, amount }, current) => {
    if (current.merchant_id !== merchant_id) return fail('urn:corpus:payments:payment:error:not_found', {});
    const captured = amount ?? current.amount;
    return ok(
      { payment_id, currency: current.currency, authorized_amount: current.amount, captured_amount: captured, status: 'captured' as const },
      [emit('urn:corpus:payments:payment:event:captured', change(payment_id, current, current.status, 'captured'))],
    );
  },

  'urn:corpus:payments:payment:operation:void_payment': ({ merchant_id, payment_id }, current) => {
    if (current.merchant_id !== merchant_id) return fail('urn:corpus:payments:payment:error:not_found', {});
    return ok(
      { ...current, status: 'voided' as const },
      [emit('urn:corpus:payments:payment:event:voided', change(payment_id, current, current.status, 'voided'))],
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

  'urn:corpus:payments:refund:operation:refund_payment': ({ merchant_id, payment_id, amount, idempotency_key }, current) => {
    if (current.merchant_id !== merchant_id) return fail('urn:corpus:payments:payment:error:not_found', {});
    if (idempotency_key === USED_KEY) return fail('urn:corpus:payments:payment:error:idempotency_conflict', { idempotency_key });
    if (payment_id === CAPTURED_LONG_AGO) return fail('urn:corpus:payments:refund:error:refund_window_closed', {});

    const refunded_total = current.refunded_amount + amount;
    const next = refunded_total === current.captured_amount ? 'refunded' : 'partially_refunded';
    const event = change(payment_id, current, current.status, next);
    return ok(
      { refund_id: `re_${'2'.padStart(24, '0')}`, payment_id, merchant_id, amount, currency: current.currency, captured_amount: current.captured_amount, refunded_total, created_at: NOW },
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
