// The insurance core. Dates are YYYY-MM-DD strings and amounts are decimal strings, so the
// arithmetic uses urn-forge/exact: whole days between dates, and decimals with no float.
import { emit, fail, ok, type DomainCoreImplementation } from './generated/domain.runtime.generated';
import { compareDecimal, daysBetween, divideDecimal, multiplyDecimal } from 'urn-forge/exact';

/** A refund below this amount is not paid: the declared error refund_below_minimum. */
const MINIMUM_REFUND = '1.00';

/**
 * The refund of a cancellation: the premium for the days of the term after the cancellation
 * date, rounded down to the cent. The term counts its first and its last day.
 *
 * Example: a premium of 365.00 for 2026-01-01 to 2026-12-31 (365 days), cancelled on
 * 2026-07-02, refunds the 182 days after it: 365.00 × 182 ÷ 365 = 182.00.
 */
function refundOf(premium: string, effective: string, expiry: string, cancelled: string): string {
  const term = daysBetween(effective, expiry) + 1;
  return divideDecimal(multiplyDecimal(premium, String(daysBetween(cancelled, expiry))), String(term), 2, 'floor');
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
    const refund = refundOf(premium, effective_date, expiry_date, cancellation_date);
    // A refund under the minimum is refused, and the error records it as refund_refused.
    const tooSmall = compareDecimal(refund, MINIMUM_REFUND) < 0;
    if (tooSmall) {
      return fail('urn:acme:insurance:policy:error:refund_below_minimum', { refund });
    }
    return ok({ refund }, [
      emit('urn:acme:insurance:policy:event:policy_cancelled', { cancellation_date, refund }),
    ]);
  },
} satisfies DomainCoreImplementation;
