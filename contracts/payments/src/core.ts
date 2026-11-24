// A small payments core: a function for each operation of the manifest. runOperation checks each
// input before the core runs, and each answer and the rules of its output after. The shell gives
// the caller (as it authenticated the API key), the time of the call, the event id and the stored
// record; the core refuses a caller, puts the time in each new record and event, and answers the
// record as it is after the change, which the shell stores.
// A few fixed card numbers, a currency and an idempotency key stand in for the answers of banks and
// for the store of earlier requests with an idempotency key, which the shell keeps.
import {
  answer,
  type Brand,
  type Caller,
  type DomainCore,
  type MerchantId,
  type Payment,
  type PaymentEvent,
  type Status,
} from './generated/domain.generated';

/** The test cards whose bank refuses the payment. */
const REFUSING_CARDS = {
  '4000000000000002': 'card_declined',
  '4000000000009995': 'insufficient_funds',
  '4000000000000069': 'expired_card',
  '4100000000000019': 'fraud_suspected',
} as const;
/** A currency of the domain that the test merchant cannot take. */
const UNSUPPORTED_CURRENCY = 'JPY';
/** An idempotency key that the store found with another body. */
const CONFLICTING_KEY = 'used-with-another-body';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const REFUND_WINDOW_MS = 180 * 24 * 60 * 60 * 1000;

const brandOf = (number: string): Brand =>
  number.startsWith('4') ? 'visa' : /^5[1-5]/.test(number) ? 'mastercard' : /^3[47]/.test(number) ? 'amex' : 'other';

/** Who calls: no key, a key that may not make the call, a key of another merchant, or the merchant's own key. */
const merchantCall = (caller: Caller, merchant_id: MerchantId, owner: MerchantId | undefined, kinds: readonly string[]) => {
  if (caller.key_kind === 'none') return 'unauthorized' as const;
  if (!kinds.includes(caller.key_kind)) return 'forbidden' as const;
  if (caller.merchant_id !== merchant_id || (owner !== undefined && owner !== merchant_id)) return 'not_found' as const;
  return 'ok' as const;
};
const WRITE = ['secret'];
const READ = ['secret', 'read_only'];

/** The event of a change of a payment's status. */
const event = (event_id: string, p: Pick<Payment, 'payment_id' | 'merchant_id' | 'amount' | 'currency'>, previous: Status | undefined, next: Status, now: string): PaymentEvent => ({
  event_id,
  event_type: `payment.${next}`,
  payment_id: p.payment_id,
  merchant_id: p.merchant_id,
  amount: p.amount,
  currency: p.currency,
  ...(previous ? { previous_status: previous } : {}),
  new_status: next,
  occurred_at: now,
});

/** A payment that moves to a new status and changes nothing else, and the event of the move. */
const move = (stored: Payment, next: Status, event_id: string, now: string) =>
  answer('payment_changed', { payment: { ...stored, status: next }, payment_event: event(event_id, stored, stored.status, next, now) });

const pastWeek = (p: Payment, now: string) => p.method === 'card' && Date.parse(now) >= Date.parse(p.created_at) + WEEK_MS;

export const core = {
  create_payment: (request) => {
    const { merchant_id, amount, currency, method, card, line_items, caller, now, event_id } = request;
    const who = merchantCall(caller, merchant_id, undefined, WRITE);
    if (who !== 'ok') return answer(who, {});
    if (request.idempotency_key === CONFLICTING_KEY) return answer('idempotency_conflict', { idempotency_key: request.idempotency_key });
    if (line_items && line_items.reduce((sum, i) => sum + i.quantity * i.unit_amount, 0) !== amount) return answer('invalid_request', {});
    if (currency === UNSUPPORTED_CURRENCY) return answer('unsupported_currency', { currency });
    const number = card?.card_number ?? '';
    if (number in REFUSING_CARDS) return answer(REFUSING_CARDS[number as keyof typeof REFUSING_CARDS], {});

    const status: Status = method === 'card' ? 'authorized' : 'pending';
    const payment: Payment = {
      payment_id: `pay_${'new'.padEnd(24, '0')}`,
      merchant_id,
      amount,
      currency,
      method,
      status,
      captured_amount: 0,
      refunded_amount: 0,
      ...(card ? { card_summary: { brand: brandOf(number), last4: number.slice(-4), exp_month: card.exp_month, exp_year: card.exp_year } } : {}),
      created_at: now,
    };
    return answer('payment_changed', { payment, payment_event: event(event_id, payment, undefined, status, now) });
  },

  capture_payment: ({ merchant_id, amount, stored_payment: p, caller, now, event_id }) => {
    const who = merchantCall(caller, merchant_id, p.merchant_id, WRITE);
    if (who !== 'ok') return answer(who, {});
    if (p.status !== 'authorized' || pastWeek(p, now)) return answer('invalid_state', { status: p.status });
    if (amount !== undefined && amount > p.amount) {
      return answer('capture_exceeds_authorized', { amount, currency: p.currency, authorized_amount: p.amount });
    }
    const payment: Payment = { ...p, status: 'captured', captured_amount: amount ?? p.amount, captured_at: now };
    return answer('payment_changed', { payment, payment_event: event(event_id, p, p.status, 'captured', now) });
  },

  void_payment: ({ merchant_id, stored_payment: p, caller, now, event_id }) => {
    const who = merchantCall(caller, merchant_id, p.merchant_id, WRITE);
    if (who !== 'ok') return answer(who, {});
    if (p.status !== 'authorized' || pastWeek(p, now)) return answer('invalid_state', { status: p.status });
    return move(p, 'voided', event_id, now);
  },

  // The shell's clock calls it for a card payment that it finds due.
  expire_payment: ({ stored_payment: p, caller, now, event_id }) => {
    if (caller.key_kind === 'none') return answer('unauthorized', {});
    if (caller.key_kind !== 'clock') return answer('forbidden', {});
    if (p.status !== 'authorized' || !pastWeek(p, now)) return answer('invalid_state', { status: p.status });
    return move(p, 'expired', event_id, now);
  },

  // The shell calls it when the bank reports a bank transfer.
  settle_payment: ({ transfer_outcome, stored_payment: p, caller, now, event_id }) => {
    if (caller.key_kind === 'none') return answer('unauthorized', {});
    if (caller.key_kind !== 'bank') return answer('forbidden', {});
    if (p.status !== 'pending') return answer('invalid_state', { status: p.status });
    return move(p, transfer_outcome === 'arrived' ? 'authorized' : 'failed', event_id, now);
  },

  get_payment: ({ merchant_id, stored_payment, caller }) => {
    const who = merchantCall(caller, merchant_id, stored_payment.merchant_id, READ);
    return who === 'ok' ? answer('payment', stored_payment) : answer(who, {});
  },

  refund_payment: ({ merchant_id, payment_id, amount, idempotency_key, stored_payment: p, caller, now, event_id }) => {
    const who = merchantCall(caller, merchant_id, p.merchant_id, WRITE);
    if (who !== 'ok') return answer(who, {});
    if (idempotency_key === CONFLICTING_KEY) return answer('idempotency_conflict', { idempotency_key });
    if (p.status !== 'captured' && p.status !== 'partially_refunded') return answer('invalid_state', { status: p.status });
    if (p.captured_at === undefined || Date.parse(now) > Date.parse(p.captured_at) + REFUND_WINDOW_MS) return answer('refund_window_closed', {});
    const refunded_total = p.refunded_amount + amount;
    if (refunded_total > p.captured_amount) {
      return answer('amount_exceeds_captured', { amount, currency: p.currency, captured_amount: p.captured_amount, refunded_amount: p.refunded_amount });
    }
    const next: Status = refunded_total === p.captured_amount ? 'refunded' : 'partially_refunded';
    return answer('refund_made', {
      refund: {
        refund_id: `re_${'2'.padStart(24, '0')}`,
        payment_id,
        merchant_id: p.merchant_id,
        amount,
        currency: p.currency,
        captured_amount: p.captured_amount,
        refunded_total,
        created_at: now,
      },
      payment: { ...p, status: next, refunded_amount: refunded_total },
      payment_event: event(event_id, p, p.status, next, now),
    });
  },

  get_refund: ({ merchant_id, stored_refund, caller }) => {
    const who = merchantCall(caller, merchant_id, stored_refund.merchant_id, READ);
    return who === 'ok' ? answer('refund', stored_refund) : answer(who, {});
  },
} satisfies DomainCore;
