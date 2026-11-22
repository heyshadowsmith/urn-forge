/**
 * Callers: the manifest header names the caller entity, and each operation states who may call
 * it. The runtime checks the caller after the record loads and before its state, so a caller who
 * may not call learns nothing of the record. The target is tests/fixtures/callers.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import type { Urn } from '../src/ir/types.js';

const APPROVE = 'urn:demo:callers:claim:operation:approve_claim';
const READ = 'urn:demo:callers:claim:operation:read_claim';
const CHECK = 'urn:demo:callers:claim:operation:check_claim_id';
const FORBIDDEN = 'urn:demo:callers:claim:error:forbidden';

const source = readFileSync(new URL('./fixtures/callers/domain.manifest.yaml', import.meta.url), 'utf8');
const runtimeFile = new URL('./fixtures/callers/expected/domain.runtime.generated.ts', import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtime: any = existsSync(runtimeFile) ? await import(runtimeFile.href) : undefined;

const claim = (state: string, employee = 'E-1000', manager = 'E-2000') => ({ claim_id: 'CLM-0000000001', state, employee_id: employee, manager_id: manager });
const ref = { claim_id: 'CLM-0000000001' };
const calls: string[] = [];
const core = {
  [APPROVE]: (_input: unknown, current: Record<string, unknown>) => (calls.push(APPROVE), runtime.ok({ ...current, state: 'APPROVED' })),
  [READ]: (_input: unknown, current: Record<string, unknown>) => (calls.push(READ), runtime.ok(current)),
  [CHECK]: (input: unknown) => runtime.ok(input),
};
const run = (urn: string, caller: unknown, current?: unknown) => runtime.executeOperation(urn, ref, core, { caller, ...(current === undefined ? {} : { current }) });

describe('the callers target compiles', () => {
  it('with no diagnostics, and the IR holds the caller, the callers and the read', () => {
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.ir?.meta.caller).toBe('urn:demo:callers:auth:entity:caller');
    const ops = result.ir?.operations as Readonly<Record<Urn, unknown>> | undefined;
    expect(ops?.[APPROVE as Urn]).toMatchObject({ callers: { allow: [{ ruleText: "caller.role = 'manager' and caller.employee_id = current.manager_id and caller.employee_id != current.employee_id" }], otherwise: FORBIDDEN } });
    expect(ops?.[READ as Urn]).toMatchObject({ reads: { entity: 'urn:demo:callers:claim:entity:claim', missing: 'urn:demo:callers:claim:error:not_found' } });
    expect(ops?.[CHECK as Urn]).toMatchObject({ callers: { allow: 'any' } });
  });
});

describe('the runtime of the callers target', () => {
  const manager = { role: 'manager', employee_id: 'E-2000' };

  it('runs the handler for a caller that a rule allows', () => {
    expect(run(APPROVE, manager, claim('SUBMITTED'))).toMatchObject({ ok: true, output: { state: 'APPROVED' } });
  });

  it('answers otherwise, filled from the caller, for a caller that no rule allows, and never calls the handler', () => {
    calls.length = 0;
    expect(run(APPROVE, manager, claim('SUBMITTED', 'E-2000', 'E-2000'))).toMatchObject({
      ok: false,
      kind: 'DomainError',
      error: { urn: FORBIDDEN, message: 'A caller with the role manager may not do this' },
    });
    expect(run(APPROVE, { role: 'employee', employee_id: 'E-1000' }, claim('SUBMITTED'))).toMatchObject({ error: { urn: FORBIDDEN } });
    expect(calls).toEqual([]);
  });

  it('checks the caller before the state, so a refused caller does not learn the state', () => {
    expect(run(APPROVE, { role: 'employee', employee_id: 'E-3000' }, claim('APPROVED'))).toMatchObject({ error: { urn: FORBIDDEN } });
    expect(run(APPROVE, manager, claim('APPROVED'))).toMatchObject({ error: { urn: 'urn:demo:callers:claim:error:invalid_state' } });
  });

  it('allows a read by any of its rules, and answers missing before the callers', () => {
    expect(run(READ, { role: 'employee', employee_id: 'E-1000' }, claim('SUBMITTED'))).toMatchObject({ ok: true });
    expect(run(READ, manager, claim('SUBMITTED'))).toMatchObject({ ok: true });
    expect(run(READ, { role: 'finance', employee_id: 'E-9000' }, claim('SUBMITTED'))).toMatchObject({ ok: true });
    expect(run(READ, { role: 'employee', employee_id: 'E-3000' }, claim('SUBMITTED'))).toMatchObject({ error: { urn: FORBIDDEN } });
    expect(run(READ, { role: 'employee', employee_id: 'E-3000' }, null)).toMatchObject({ error: { urn: 'urn:demo:callers:claim:error:not_found' } });
  });

  it('allows any caller with allow: any, but needs a caller that parses', () => {
    expect(run(CHECK, { role: 'employee', employee_id: 'E-3000' })).toMatchObject({ ok: true });
    expect(runtime.executeOperation(CHECK, ref, core)).toMatchObject({
      ok: false,
      kind: 'ContractViolation',
      issues: [{ message: `${CHECK} needs the caller, as the shell authenticated them: pass it as { caller }` }],
    });
    expect(run(CHECK, { role: 'admin', employee_id: 'E-3000' })).toMatchObject({ ok: false, kind: 'ContractViolation', issues: [{ path: 'caller.role' }] });
  });
});

describe('the compile errors of callers', () => {
  const messages = (from: string, to: string) =>
    compile(source.replace(from, to)).diagnostics.map((d) => [d.code, d.message.replace(/^urn:demo:callers:claim:operation:/, '')]);

  it('refuses an operation of a domain with a caller that states no callers', () => {
    expect(messages('  callers:\n    allow: any\n    otherwise: claim.error.forbidden\n', '')).toEqual([
      ['invalid-callers', 'check_claim_id: states no callers, but the manifest names the caller urn:demo:callers:auth:entity:caller; add callers, with allow: any for every caller'],
    ]);
  });

  it('refuses callers in a domain whose header names no caller', () => {
    const result = messages('  caller: auth.entity.caller\n', '');
    expect(result).toContainEqual(['invalid-callers', 'approve_claim: callers: the manifest header names no caller; add caller: <entity> to it']);
  });

  it('refuses caller. outside callers, a rule that does not type, and an otherwise that cannot be filled', () => {
    expect(messages("      - caller.role = 'finance'\n", '      - caller.role = 3\n')).toEqual([
      ['rule-type', 'read_claim: callers.allow.2: 3 is not text in quotes, so it cannot meet an enum in "=" (at column 1 of the rule)'],
    ]);
    expect(messages('    otherwise: claim.error.forbidden\n  errors: [claim.error.forbidden]', "    otherwise: claim.error.forbidden\n  ensures: [\"caller.role = 'finance'\"]\n  errors: [claim.error.forbidden]")).toEqual([
      ['invalid-condition', 'check_claim_id: ensures.0: "caller.role" reads the caller, which only a rule of callers can'],
    ]);
    expect(messages('    otherwise: claim.error.forbidden\n  errors: [claim.error.forbidden]', '    otherwise: claim.error.invalid_state\n  errors: [claim.error.forbidden, claim.error.invalid_state]')).toEqual([
      ['invalid-callers', 'check_claim_id: callers.otherwise: urn:demo:callers:claim:error:invalid_state needs state, which neither the caller, the input nor the record has'],
    ]);
  });

  it('refuses reads in an operation that also changes a record', () => {
    expect(messages('  changes:\n    entity: claim.entity.claim\n    from: [SUBMITTED]', '  reads:\n    entity: claim.entity.claim\n  changes:\n    entity: claim.entity.claim\n    from: [SUBMITTED]')).toEqual([
      ['invalid-reads', 'approve_claim: reads: the operation also changes a record; changes gives it as current, so leave out reads'],
    ]);
  });
});
