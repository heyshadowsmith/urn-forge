// A small claims core: enough for the scenarios. A few fixed values stand for the stored state:
// the claim CLM-0000000404 does not exist, CLM-0000000409 changed since the caller read it,
// CLM-0000000412 is in a state that refuses every change, the user "stranger" may do nothing,
// and the receipt whose hash is 64 times "f" is already on another claim.
import { sumDecimal } from 'urn-forge/exact';
import { emit, fail, ok, type DomainCoreImplementation } from './generated/domain.runtime.generated';

const MISSING = 'CLM-0000000404';
const CHANGED = 'CLM-0000000409';
const CLOSED = 'CLM-0000000412';
const STRANGER = 'stranger';
const KNOWN_RECEIPT = 'f'.repeat(64);

const EMPLOYEE = 'E-1001';
const TOTAL = '120.00';
const CURRENCY = 'EUR';
const EVENT_ID = '3f0c8a52-6d1e-4b7a-9c2f-1a2b3c4d5e6f';
const NOW = '2026-11-22T10:00:00Z';

type Line = { readonly amount: string; readonly receipt?: { readonly sha256: string } };

/** The refusal that the stored state gives a change request, if any. */
function refusal(claim_id: string, version: number, actor_id: string) {
  if (claim_id === MISSING) return fail('urn:corpus:claims:claim:error:not_found', { claim_id });
  if (actor_id === STRANGER) return fail('urn:corpus:claims:claim:error:forbidden', { actor_id });
  if (claim_id === CLOSED) return fail('urn:corpus:claims:claim:error:invalid_state', { claim_id, state: 'PAID' });
  if (claim_id === CHANGED) return fail('urn:corpus:claims:claim:error:version_conflict', { claim_id, version });
  return undefined;
}

function duplicate(lines: readonly Line[]) {
  const known = lines.find((line) => line.receipt?.sha256 === KNOWN_RECEIPT);
  return known?.receipt ? fail('urn:corpus:claims:claim:error:duplicate_receipt', { sha256: known.receipt.sha256 }) : undefined;
}

const total = (lines: readonly Line[]) => sumDecimal(lines.map((line) => line.amount));

/** The answer to a move to the next state, and the fields of the event that tells it. */
function move(state: 'SUBMITTED' | 'WITHDRAWN' | 'APPROVED' | 'PAID', { claim_id, version, actor_id }: { claim_id: string; version: number; actor_id: string }) {
  const answer = { claim_id, state, total: TOTAL, currency: CURRENCY, version: version + 1 };
  const fields = { event_id: EVENT_ID, claim_id, employee_id: EMPLOYEE, total: TOTAL, currency: CURRENCY, state, actor_id, occurred_at: NOW };
  return { answer, fields };
}

export const core = {
  'urn:corpus:claims:claim:operation:create_draft': ({ actor_id, employee_id, currency, lines }) => {
    const actor: string = actor_id;
    if (actor !== employee_id) return fail('urn:corpus:claims:claim:error:forbidden', { actor_id });
    return duplicate(lines) ?? ok({ claim_id: 'CLM-0000000001', state: 'DRAFT', total: total(lines), currency, version: 1 });
  },

  'urn:corpus:claims:claim:operation:edit_draft': ({ claim_id, version, actor_id, currency, lines }) =>
    refusal(claim_id, version, actor_id) ?? duplicate(lines) ?? ok({ claim_id, state: 'DRAFT', total: total(lines), currency, version: version + 1 }),

  'urn:corpus:claims:claim:operation:submit_claim': (input) =>
    refusal(input.claim_id, input.version, input.actor_id) ?? ((m) => ok(m.answer, [emit('urn:corpus:claims:claim:event:claim_submitted', m.fields)]))(move('SUBMITTED', input)),

  'urn:corpus:claims:claim:operation:withdraw_claim': (input) =>
    refusal(input.claim_id, input.version, input.actor_id) ?? ((m) => ok(m.answer, [emit('urn:corpus:claims:claim:event:claim_withdrawn', m.fields)]))(move('WITHDRAWN', input)),

  'urn:corpus:claims:claim:operation:approve_claim': (input) =>
    refusal(input.claim_id, input.version, input.actor_id) ?? ((m) => ok(m.answer, [emit('urn:corpus:claims:claim:event:claim_approved', m.fields)]))(move('APPROVED', input)),

  'urn:corpus:claims:claim:operation:mark_paid': (input) =>
    refusal(input.claim_id, input.version, input.actor_id) ?? ((m) => ok(m.answer, [emit('urn:corpus:claims:claim:event:claim_paid', m.fields)]))(move('PAID', input)),

  'urn:corpus:claims:claim:operation:reject_claim': ({ claim_id, version, actor_id, reason }) => {
    const refused = refusal(claim_id, version, actor_id);
    if (refused) return refused;
    const state = 'REJECTED';
    return ok({ claim_id, state, total: TOTAL, currency: CURRENCY, version: version + 1, reason }, [
      emit('urn:corpus:claims:claim:event:claim_rejected', {
        event_id: EVENT_ID, claim_id, employee_id: EMPLOYEE, total: TOTAL, currency: CURRENCY, state, actor_id, occurred_at: NOW, reason,
      }),
    ]);
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
      total: TOTAL,
      lines: [
        { category: 'TRAVEL', expense_date: '2026-11-02', description: 'Train to Lyon', amount: '95.00', receipt: { sha256: 'a'.repeat(64), media_type: 'application/pdf', size_bytes: 48213 } },
        { category: 'MEALS', expense_date: '2026-11-02', description: 'Lunch', amount: '25.00' },
      ],
    });
  },
} satisfies DomainCoreImplementation;
