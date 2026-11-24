// A small claims core: enough for the scenarios. The shell gives each operation the caller, the time
// of the call, the id of the event a change tells, and the stored claim that the request names. The
// harness, runOperation, checks each input before the core runs and each answer after, with the rules
// of the output that the core chose.
import { answer, type Caller, type Claim, type DomainCore, type Lines, type ReceiptsInUse } from './generated/domain.generated';

/** The id of a new claim. A real core takes the next number of a sequence. */
const NEW_CLAIM_ID = 'CLM-0000000001';

/** The caller makes the request as themselves. */
const isActor = (caller: Caller, actor_id: string): boolean => caller.employee_id !== undefined && caller.employee_id === actor_id;

/** The first receipt of the lines that is in use on another claim, or on two of the lines. */
function receiptInUse(lines: Lines, inUse: ReceiptsInUse): string | undefined {
  const hashes = lines.flatMap((line) => (line.receipt ? [line.receipt.sha256] : []));
  return hashes.find((sha256, i) => inUse.includes(sha256) || hashes.indexOf(sha256) !== i);
}

const sum = (lines: Lines): number => lines.reduce((total, line) => total + line.amount, 0);

/** The fields of an event that tells a change of the claim. */
function told(claim: Claim, input: { readonly event_id: string; readonly actor_id: string; readonly now: string }) {
  const { claim_id, employee_id, total, currency, state } = claim;
  return { event_id: input.event_id, claim_id, employee_id, total, currency, state, actor_id: input.actor_id, occurred_at: input.now };
}

/** The refusals of a change of a stored claim, in order: not found, forbidden, invalid state, version conflict. */
function refusal(
  input: { readonly claim_id: string; readonly version: number; readonly actor_id: string; readonly caller: Caller; readonly stored_claim?: Claim },
  allowed: (claim: Claim) => boolean,
  from: readonly string[],
) {
  const claim = input.stored_claim;
  if (!claim) return answer('not_found', { claim_id: input.claim_id });
  if (!allowed(claim)) return answer('forbidden', { role: input.caller.role, actor_id: input.actor_id });
  if (!from.includes(claim.state)) return answer('invalid_state', { claim_id: input.claim_id, state: claim.state });
  if (claim.version !== input.version) return answer('version_conflict', { claim_id: input.claim_id, version: input.version });
  return undefined;
}

export const core = {
  create_draft: (input) => {
    const { caller, actor_id, employee_id, manager_id, purpose, currency, lines, receipts_in_use } = input;
    if (!isActor(caller, actor_id) || employee_id !== actor_id) return answer('forbidden', { role: caller.role, actor_id });
    const sha256 = receiptInUse(lines, receipts_in_use);
    if (sha256) return answer('duplicate_receipt', { sha256 });
    return answer('claim', { claim_id: NEW_CLAIM_ID, version: 1, employee_id, manager_id, state: 'DRAFT', purpose, currency, total: sum(lines), lines });
  },

  edit_draft: (input) => {
    const refused = refusal(input, (claim) => isActor(input.caller, input.actor_id) && claim.employee_id === input.actor_id, ['DRAFT', 'REJECTED']);
    if (refused) return refused;
    const sha256 = receiptInUse(input.lines, input.receipts_in_use);
    if (sha256) return answer('duplicate_receipt', { sha256 });
    const { purpose, currency, lines } = input;
    const claim: Claim = { ...input.stored_claim!, state: 'DRAFT', purpose, currency, lines, total: sum(lines), version: input.version + 1 };
    return answer('claim', claim);
  },

  submit_claim: (input) => {
    const refused = refusal(input, (claim) => isActor(input.caller, input.actor_id) && claim.employee_id === input.actor_id, ['DRAFT']);
    if (refused) return refused;
    const claim: Claim = { ...input.stored_claim!, state: 'SUBMITTED', version: input.version + 1, submitted_at: input.now };
    return answer('submitted', { claim, claim_submitted: told(claim, input) });
  },

  withdraw_claim: (input) => {
    const refused = refusal(input, (claim) => isActor(input.caller, input.actor_id) && claim.employee_id === input.actor_id, ['SUBMITTED']);
    if (refused) return refused;
    const claim: Claim = { ...input.stored_claim!, state: 'WITHDRAWN', version: input.version + 1 };
    return answer('withdrawn', { claim, claim_withdrawn: told(claim, input) });
  },

  approve_claim: (input) => {
    const manager = (claim: Claim) => isActor(input.caller, input.actor_id) && claim.manager_id === input.actor_id && claim.employee_id !== input.actor_id;
    const refused = refusal(input, manager, ['SUBMITTED']);
    if (refused) return refused;
    const claim: Claim = { ...input.stored_claim!, state: 'APPROVED', version: input.version + 1 };
    return answer('approved', { claim, claim_approved: told(claim, input) });
  },

  reject_claim: (input) => {
    const refused = refusal(input, (claim) => isActor(input.caller, input.actor_id) && claim.manager_id === input.actor_id, ['SUBMITTED']);
    if (refused) return refused;
    const { reason } = input;
    const claim: Claim = { ...input.stored_claim!, state: 'REJECTED', version: input.version + 1, reason };
    return answer('rejected', { claim, claim_rejected: { ...told(claim, input), reason } });
  },

  // Who may pay does not depend on the claim, so a caller who is not a finance user is refused first.
  mark_paid: (input) => {
    if (!isActor(input.caller, input.actor_id) || input.caller.role !== 'finance') return answer('forbidden', { role: input.caller.role, actor_id: input.actor_id });
    const refused = refusal(input, () => true, ['APPROVED']);
    if (refused) return refused;
    const claim: Claim = { ...input.stored_claim!, state: 'PAID', version: input.version + 1 };
    return answer('paid', { claim, claim_paid: told(claim, input) });
  },

  get_claim: ({ caller, actor_id, claim_id, stored_claim }) => {
    if (!stored_claim) return answer('not_found', { claim_id });
    const reader = isActor(caller, actor_id) && (stored_claim.employee_id === actor_id || stored_claim.manager_id === actor_id || caller.role === 'finance');
    return reader ? answer('claim', stored_claim) : answer('forbidden', { role: caller.role, actor_id });
  },

  // The input rule claim_is_due rejects a call for a submitted claim that is not due.
  report_overdue: ({ caller, now, event_id, claim_id, stored_claim }) => {
    if (caller.role !== 'clock') return answer('forbidden', { role: caller.role });
    if (!stored_claim) return answer('not_found', { claim_id });
    if (stored_claim.state !== 'SUBMITTED') return answer('invalid_state', { claim_id, state: stored_claim.state });
    const claim: Claim = { ...stored_claim, overdue_reported_at: now };
    const { employee_id, manager_id, total, currency, state, submitted_at } = claim;
    const event = { event_id, claim_id, employee_id, manager_id, total, currency, state, submitted_at: submitted_at!, occurred_at: now };
    return answer('overdue_reported', { claim, claim_decision_overdue: event });
  },
} satisfies DomainCore;
