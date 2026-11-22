// A small claims core: enough for the scenarios. The shell passes the stored claim that a change
// request names as `current`. A few fixed values stand for what is not in that record: the user
// "stranger" may not decide on or pay any claim, and the receipt whose hash is 64 times "f" is
// already on another claim.
import { sumDecimal } from 'urn-forge/exact';
import { emit, fail, ok, type DomainCoreImplementation } from './generated/domain.runtime.generated';

const MISSING = 'CLM-0000000404';
const STRANGER = 'stranger';
const KNOWN_RECEIPT = 'f'.repeat(64);

const EMPLOYEE = 'E-1001';
const CURRENCY = 'EUR';
const EVENT_ID = '3f0c8a52-6d1e-4b7a-9c2f-1a2b3c4d5e6f';
const NOW = '2026-11-22T10:00:00Z';

type Line = { readonly amount: string; readonly receipt?: { readonly sha256: string } };
type Request = { readonly claim_id: string; readonly version: number; readonly actor_id: string };
type Stored = { readonly claim_id: string; readonly version: number; readonly employee_id: string; readonly total: string; readonly currency: string };

/** The refusal of a request by a user other than the owner of the claim, if any. */
function notOwner({ actor_id }: Request, current: Stored) {
  const actor: string = actor_id;
  const owner: string = current.employee_id;
  return actor !== owner ? fail('urn:corpus:claims:claim:error:forbidden', { actor_id }) : undefined;
}

/** The refusal of a decision or payment by a user who may make none, if any. */
function notAllowed({ actor_id }: Request) {
  return actor_id === STRANGER ? fail('urn:corpus:claims:claim:error:forbidden', { actor_id }) : undefined;
}

function duplicate(lines: readonly Line[]) {
  const known = lines.find((line) => line.receipt?.sha256 === KNOWN_RECEIPT);
  return known?.receipt ? fail('urn:corpus:claims:claim:error:duplicate_receipt', { sha256: known.receipt.sha256 }) : undefined;
}

const total = (lines: readonly Line[]) => sumDecimal(lines.map((line) => line.amount));

/** The answer to a move of the claim to a new state, and the fields of the event that tells it. */
function move(state: 'SUBMITTED' | 'WITHDRAWN' | 'APPROVED' | 'PAID' | 'REJECTED', { actor_id }: Request, current: Stored) {
  const { claim_id, employee_id, total, currency } = current;
  const answer = { claim_id, state, total, currency, version: current.version + 1 };
  const fields = { event_id: EVENT_ID, claim_id, employee_id, total, currency, state, actor_id, occurred_at: NOW };
  return { answer, fields };
}

export const core = {
  'urn:corpus:claims:claim:operation:create_draft': ({ actor_id, employee_id, currency, lines }) => {
    const actor: string = actor_id;
    if (actor !== employee_id) return fail('urn:corpus:claims:claim:error:forbidden', { actor_id });
    return duplicate(lines) ?? ok({ claim_id: 'CLM-0000000001', state: 'DRAFT', total: total(lines), currency, version: 1 });
  },

  'urn:corpus:claims:claim:operation:edit_draft': (input, current) =>
    notOwner(input, current) ??
    duplicate(input.lines) ??
    ok({ claim_id: current.claim_id, state: 'DRAFT', total: total(input.lines), currency: input.currency, version: current.version + 1 }),

  'urn:corpus:claims:claim:operation:submit_claim': (input, current) =>
    notOwner(input, current) ??
    ((m) => ok(m.answer, [emit('urn:corpus:claims:claim:event:claim_submitted', m.fields)]))(move('SUBMITTED', input, current)),

  'urn:corpus:claims:claim:operation:withdraw_claim': (input, current) =>
    notOwner(input, current) ??
    ((m) => ok(m.answer, [emit('urn:corpus:claims:claim:event:claim_withdrawn', m.fields)]))(move('WITHDRAWN', input, current)),

  'urn:corpus:claims:claim:operation:approve_claim': (input, current) =>
    notAllowed(input) ??
    ((m) => ok(m.answer, [emit('urn:corpus:claims:claim:event:claim_approved', m.fields)]))(move('APPROVED', input, current)),

  'urn:corpus:claims:claim:operation:mark_paid': (input, current) =>
    notAllowed(input) ??
    ((m) => ok(m.answer, [emit('urn:corpus:claims:claim:event:claim_paid', m.fields)]))(move('PAID', input, current)),

  'urn:corpus:claims:claim:operation:reject_claim': (input, current) => {
    const refused = notAllowed(input);
    if (refused) return refused;
    const { answer, fields } = move('REJECTED', input, current);
    const { reason } = input;
    return ok({ ...answer, reason }, [emit('urn:corpus:claims:claim:event:claim_rejected', { ...fields, reason })]);
  },

  'urn:corpus:claims:claim:operation:get_claim': ({ claim_id, actor_id }) => {
    if (claim_id === MISSING) return fail('urn:corpus:claims:claim:error:not_found', { claim_id });
    if (actor_id === STRANGER) return fail('urn:corpus:claims:claim:error:forbidden', { actor_id });
    return ok({
      claim_id,
      version: 3,
      employee_id: EMPLOYEE,
      state: 'SUBMITTED',
      purpose: 'Client visit in Lyon',
      currency: CURRENCY,
      total: '120.00',
      lines: [
        { category: 'TRAVEL', expense_date: '2026-11-02', description: 'Train to Lyon', amount: '95.00', receipt: { sha256: 'a'.repeat(64), media_type: 'application/pdf', size_bytes: 48213 } },
        { category: 'MEALS', expense_date: '2026-11-02', description: 'Lunch', amount: '25.00' },
      ],
    });
  },
} satisfies DomainCoreImplementation;
