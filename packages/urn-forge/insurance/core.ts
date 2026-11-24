// The insurance core. Times are RFC 3339 strings and amounts are integers of cents, so the
// arithmetic is exact: whole seconds of the term, and a refund rounded down to the cent.
import { answer, type DomainCore } from './generated/domain.generated.js';

/** A refund below this amount, in cents, is not paid: the output refund_below_minimum. */
const MINIMUM_REFUND_CENTS = 100;

const seconds = (time: string): number => Math.floor(Date.parse(time) / 1000);

/**
 * The refund of a cancellation: the premium for the time of the term after the cancellation,
 * rounded down to the cent.
 *
 * Example: a premium of 36500 cents from 2026-01-01T00:00:00Z to 2027-01-01T00:00:00Z (365 days),
 * cancelled at 2026-07-02T00:00:00Z, refunds the 183 days after it: 36500 × 183 ÷ 365 = 18300.
 */
function refundOf(premium: number, effective: string, expires: string, cancelled: string): number {
  const term = seconds(expires) - seconds(effective);
  return Math.floor((premium * (seconds(expires) - seconds(cancelled))) / term);
}

export const core = {
  // A policy is issued as requested, and the event says so.
  issue_policy: (policy) =>
    answer('issued', { policy, policy_issued: { policy_id: policy.policy_id, holder: policy.holder, premium: policy.premium } }),

  cancel_policy: ({ stored_policy, cancelled_at }) => {
    // The rules of the input make sure that the cover ends after it starts and that the
    // cancellation is inside the term.
    const { policy_id, premium, effective_at, expires_at } = stored_policy;
    const refund = refundOf(premium, effective_at, expires_at, cancelled_at);
    const event = { policy_id, cancelled_at, refund };
    if (refund < MINIMUM_REFUND_CENTS) return answer('refund_below_minimum', { refund, refund_refused: event });
    return answer('refund_quote', { refund, policy_cancelled: event });
  },
} satisfies DomainCore;
