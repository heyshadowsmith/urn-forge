// The insurance core. Dates are YYYY-MM-DD strings and amounts are decimal strings, so the
// arithmetic converts them first: days from the epoch, and cents as integers.
import { emit, fail, ok, type DomainCoreImplementation } from './generated/domain.runtime.generated';

const MINIMUM_REFUND_CENTS = 100n;

function day(date: string): number {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86_400_000;
}

/** A decimal with at most 2 digits after the point (the field's scale) as whole cents. */
function cents(amount: string): bigint {
  const [whole = '0', fraction = ''] = amount.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

function amount(cents: bigint): string {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

export const core = {
  // A policy is issued as requested, and the event says so (events plan).
  'urn:acme:insurance:policy:operation:issue_policy': (policy) =>
    ok({ ...policy }, [
      emit('urn:acme:insurance:policy:event:policy_issued', { policy_id: policy.policy_id, holder: policy.holder, premium: policy.premium }),
    ]),

  'urn:acme:insurance:policy:operation:cancel_policy': ({ effective_date, expiry_date, premium, cancellation_date }) => {
    // The invariants make sure that effective_date < expiry_date and that the
    // cancellation date is inside the term. The refund covers the days after it.
    const term = BigInt(day(expiry_date) - day(effective_date) + 1);
    const unused = BigInt(day(expiry_date) - day(cancellation_date));
    const refund = (cents(premium) * unused) / term;
    if (refund < MINIMUM_REFUND_CENTS) {
      return fail('urn:acme:insurance:policy:error:refund_below_minimum', { refund: amount(refund) });
    }
    return ok({ refund: amount(refund) }, [
      emit('urn:acme:insurance:policy:event:policy_cancelled', { cancellation_date, refund: amount(refund) }),
    ]);
  },
} satisfies DomainCoreImplementation;
