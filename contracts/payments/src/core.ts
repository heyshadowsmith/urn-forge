// A small payments core. The operations that move or read a payment or a refund get it as
// `current`. Who may call (the merchant of the key, and its kind) is checked by the runtime from
// the callers of the manifest before a handler runs, so no handler reads the merchant to refuse.
// The shell gives the time of the call (`now`) to each operation whose rules read it, and the
// core puts it in each event and in each new record.
// A few fixed card numbers and a currency stand in for the answers of banks. The answers of earlier
// requests with an idempotency key are kept by the store (runOnce), not here.
import { emit, fail, ok, type DomainCoreImplementation, type EventFields } from './generated/domain.runtime.generated';

type Status = 'pending' | 'authorized' | 'failed' | 'captured' | 'voided' | 'expired' | 'partially_refunded' | 'refunded';

interface Stored {
  readonly merchant_id: string;
  readonly amount: number;
  readonly currency: EventFields<'urn:corpus:payments:payment:event:captured'>['currency'];
  readonly status: Status;
  readonly captured_amount: number;
  readonly refunded_amount: number;
}

const paymentId = (word: string) => `pay_${word.padEnd(24, '0')}`;

/** The test cards whose bank refuses the payment. */
const REFUSING_CARDS = {
  '4000000000000002': 'urn:corpus:payments:payment:error:card_declined',
  '4000000000009995': 'urn:corpus:payments:payment:error:insufficient_funds',
  '4000000000000069': 'urn:corpus:payments:payment:error:expired_card',
  '4100000000000019': 'urn:corpus:payments:payment:error:fraud_suspected',
} as const;
/** A currency of the domain that the test merchant cannot take. */
const UNSUPPORTED_CURRENCY = 'JPY';

const brandOf = (number: string) =>
  number.startsWith('4') ? 'visa' : /^5[1-5]/.test(number) ? 'mastercard' : /^3[47]/.test(number) ? 'amex' : 'other';

// The event of a change. The shell gives its event_id (newEventId), so the core does not.
const change = (id: string, p: Stored, previous: Status | undefined, next: Status, now: string) => ({
  payment_id: id,
  merchant_id: p.merchant_id,
  amount: p.amount,
  currency: p.currency,
  ...(previous ? { previous_status: previous } : {}),
  new_status: next,
  occurred_at: now,
});

export const core = {
  'urn:corpus:payments:payment:operation:create_payment': (request, _current, now) => {
    const { merchant_id, amount, currency, method, card } = request;
    if (currency === UNSUPPORTED_CURRENCY) return fail('urn:corpus:payments:payment:error:unsupported_currency', { currency });
    const number: string = card?.card_number ?? '';
    if (number in REFUSING_CARDS) return fail(REFUSING_CARDS[number as keyof typeof REFUSING_CARDS], {});

    const payment_id = paymentId('new');
    const status = method === 'card' ? 'authorized' : 'pending';
    const stored: Stored = { merchant_id, amount, currency, status, captured_amount: 0, refunded_amount: 0 };
    const event = change(payment_id, stored, undefined, status, now);
    return ok(
      {
        payment_id,
        merchant_id,
        amount,
        currency,
        method,
        status,
        ...(card ? { card: { brand: brandOf(number), last4: number.slice(-4), exp_month: card.exp_month, exp_year: card.exp_year } } : {}),
        created_at: now,
      },
      [
        status === 'authorized'
          ? emit('urn:corpus:payments:payment:event:authorized', event)
          : emit('urn:corpus:payments:payment:event:pending', event),
      ],
    );
  },

  'urn:corpus:payments:payment:operation:capture_payment': ({ payment_id, amount }, current, now) => {
    const captured = amount ?? current.amount;
    return ok(
      { payment_id, currency: current.currency, authorized_amount: current.amount, captured_amount: captured, status: 'captured' as const, captured_at: now },
      [emit('urn:corpus:payments:payment:event:captured', change(payment_id, current, current.status, 'captured', now))],
    );
  },

  'urn:corpus:payments:payment:operation:void_payment': ({ payment_id }, current, now) => {
    return ok(
      { ...current, status: 'voided' as const },
      [emit('urn:corpus:payments:payment:event:voided', change(payment_id, current, current.status, 'voided', now))],
    );
  },

  // The shell's clock calls it for a card payment that is due; the runtime refuses one that is not.
  'urn:corpus:payments:payment:operation:expire_payment': ({ payment_id }, current, now) => {
    return ok(
      { ...current, status: 'expired' as const },
      [emit('urn:corpus:payments:payment:event:expired', change(payment_id, current, current.status, 'expired', now))],
    );
  },

  'urn:corpus:payments:payment:operation:get_payment': (_lookup, current) => ok(current),

  'urn:corpus:payments:refund:operation:refund_payment': ({ payment_id, amount }, current, now) => {
    const refunded_total = current.refunded_amount + amount;
    const next = refunded_total === current.captured_amount ? 'refunded' : 'partially_refunded';
    const event = change(payment_id, current, current.status, next, now);
    return ok(
      { refund_id: `re_${'2'.padStart(24, '0')}`, payment_id, merchant_id: current.merchant_id, amount, currency: current.currency, captured_amount: current.captured_amount, refunded_total, created_at: now },
      [
        next === 'refunded'
          ? emit('urn:corpus:payments:payment:event:refunded', event)
          : emit('urn:corpus:payments:payment:event:partially_refunded', event),
      ],
    );
  },

  'urn:corpus:payments:refund:operation:get_refund': (_lookup, current) => ok(current),
} satisfies DomainCoreImplementation;
