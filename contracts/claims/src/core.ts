// A small claims core: enough for the scenarios. The shell passes the stored claim that a change
// or a read names as `current`. Who may call is the manifest's callers, checked before the core
// runs, so the core does not check the caller. A fixed value stands for what is not in the record:
// the receipt whose hash is 64 times "f" is already on another claim.
import { sumDecimal } from 'urn-forge/exact';
import { emit, fail, ok, type DomainCoreImplementation } from './generated/domain.runtime.generated';
import type { ClaimCurrency } from './generated/domain.schemas.generated';

const KNOWN_RECEIPT = 'f'.repeat(64);
const NOW = '2026-11-22T10:00:00Z';

type Line = { readonly amount: string; readonly receipt?: { readonly sha256: string } };
type Request = { readonly claim_id: string; readonly version: number; readonly actor_id: string };
type Stored = { readonly claim_id: string; readonly version: number; readonly employee_id: string; readonly total: string; readonly currency: ClaimCurrency };

function duplicate(lines: readonly Line[]) {
  const known = lines.find((line) => line.receipt?.sha256 === KNOWN_RECEIPT);
  return known?.receipt ? fail('urn:corpus:claims:claim:error:duplicate_receipt', { sha256: known.receipt.sha256 }) : undefined;
}

const total = (lines: readonly Line[]) => sumDecimal(lines.map((line) => line.amount));

/** The answer to a move of the claim to a new state, and the fields of the event that tells it; the shell gives the event id. */
function move(state: 'SUBMITTED' | 'WITHDRAWN' | 'APPROVED' | 'PAID' | 'REJECTED', { actor_id }: Request, current: Stored) {
  const { claim_id, employee_id, total, currency } = current;
  const answer = { claim_id, state, total, currency, version: current.version + 1 };
  const fields = { claim_id, employee_id, total, currency, state, actor_id, occurred_at: NOW };
  return { answer, fields };
}

export const core = {
  'urn:corpus:claims:claim:operation:create_draft': ({ currency, lines }) =>
    duplicate(lines) ?? ok({ claim_id: 'CLM-0000000001', state: 'DRAFT', total: total(lines), currency, version: 1 }),

  'urn:corpus:claims:claim:operation:edit_draft': (input, current) =>
    duplicate(input.lines) ??
    ok({ claim_id: current.claim_id, state: 'DRAFT', total: total(input.lines), currency: input.currency, version: current.version + 1 }),

  // The answer holds when the claim was submitted, the time of the call; the shell stores it in the record.
  'urn:corpus:claims:claim:operation:submit_claim': (input, current, now) =>
    ((m) => ok({ ...m.answer, submitted_at: now }, [emit('urn:corpus:claims:claim:event:claim_submitted', m.fields)]))(move('SUBMITTED', input, current)),

  'urn:corpus:claims:claim:operation:withdraw_claim': (input, current) =>
    ((m) => ok(m.answer, [emit('urn:corpus:claims:claim:event:claim_withdrawn', m.fields)]))(move('WITHDRAWN', input, current)),

  'urn:corpus:claims:claim:operation:approve_claim': (input, current) =>
    ((m) => ok(m.answer, [emit('urn:corpus:claims:claim:event:claim_approved', m.fields)]))(move('APPROVED', input, current)),

  'urn:corpus:claims:claim:operation:mark_paid': (input, current) =>
    ((m) => ok(m.answer, [emit('urn:corpus:claims:claim:event:claim_paid', m.fields)]))(move('PAID', input, current)),

  'urn:corpus:claims:claim:operation:reject_claim': (input, current) => {
    const { answer, fields } = move('REJECTED', input, current);
    const { reason } = input;
    return ok({ ...answer, reason }, [emit('urn:corpus:claims:claim:event:claim_rejected', { ...fields, reason })]);
  },

  'urn:corpus:claims:claim:operation:get_claim': (_input, current) => ok(current),

  // The shell's clock calls it for a claim that is due: the claim keeps its state and holds the mark of the report.
  'urn:corpus:claims:claim:operation:report_overdue': (_input, current, now) => {
    const { claim_id, employee_id, manager_id, total, currency, state, submitted_at } = current;
    const fields = { claim_id, employee_id, manager_id, total, currency, state, submitted_at: submitted_at!, occurred_at: now };
    return ok({ ...current, overdue_reported_at: now }, [emit('urn:corpus:claims:claim:event:claim_decision_overdue', fields)]);
  },
} satisfies DomainCoreImplementation;
