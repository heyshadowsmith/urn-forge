/** The invariant kind: its IR, and later its schemas, runtime and gate 3. */
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { RULE_CASES } from './rule-cases.js';
import * as r from './fixtures/rules/expected/domain.schemas.generated.js';
import { core as insuranceCore } from '../insurance/core.js';
import * as insuranceRuntime from '../insurance/generated/domain.runtime.generated.js';
import { ok } from '../insurance/generated/domain.runtime.generated.js';
import { buildIrFromSource } from '../src/ir/build.js';
import { invariantsOf, type Urn } from '../src/ir/types.js';

const insurance = readFileSync(new URL('../insurance/domain.manifest.yaml', import.meta.url), 'utf8');

describe('the invariant kind', () => {
  it('builds the insurance invariants, each with its parsed rule and canonical text', () => {
    const built = buildIrFromSource(insurance);
    if (!built.success) throw new Error(JSON.stringify(built.issues));
    const ir = built.ir;
    expect(Object.values(ir.invariants).map((i) => [i.urn.split(':').at(-1), i.on.split(':').at(-1), i.ruleText])).toEqual([
      ['cancellation_within_term', 'cancellation', 'cancellation_date >= effective_date and cancellation_date <= expiry_date'],
      ['deductible_below_premium', 'policy', 'deductible is absent or deductible < premium'],
      ['limit_is_positive', 'coverage', 'limit > 0'],
      ['term_at_most_a_year', 'policy', 'expiry_date - effective_date <= 366'],
      ['term_is_positive', 'policy', 'expiry_date > effective_date'],
    ]);
    expect(ir.invariants['urn:acme:insurance:policy:invariant:term_is_positive' as Urn]).toMatchObject({
      brandIdentifier: 'PolicyTermIsPositive',
      rule: { op: '>', left: { op: 'field', name: 'expiry_date' }, right: { op: 'field', name: 'effective_date' } },
      message: 'The expiry date must be after the effective date',
    });
    // The entity does not list its invariants; they are found by `on`.
    expect(invariantsOf(ir, 'urn:acme:insurance:policy:entity:policy' as Urn).map((i) => i.brandIdentifier)).toEqual([
      'PolicyDeductibleBelowPremium',
      'PolicyTermAtMostAYear',
      'PolicyTermIsPositive',
    ]);
    expect(invariantsOf(ir, 'urn:acme:insurance:policy:entity:refund_quote' as Urn)).toEqual([]);
  });
});

describe('the generated rule of each operator on each primitive (fixture: rules)', () => {
  /** The generated rule function of each rule text. */
  const rules: Readonly<Record<string, (p: never) => boolean>> = {
    'i1 < i2': r.RIntLtRule,
    'i1 <= i2': r.RIntLeRule,
    'i1 = i2': r.RIntEqRule,
    'i1 != i2': r.RIntNeRule,
    'i1 >= i2': r.RIntGeRule,
    'i1 > i2': r.RIntGtRule,
    'i1 + 1 = i2': r.RIntPlusRule,
    'i2 - i1 >= 2': r.RIntMinusRule,
    'f1 < f2': r.RFloatLtRule,
    'f1 > 0.5': r.RFloatLiteralRule,
    'd1 < d2': r.RDecLtRule,
    'd1 = d2': r.RDecEqRule,
    "d1 + d2 = '3.30'": r.RDecPlusRule,
    'd2 - d1 >= 1': r.RDecMinusRule,
    'dt1 < dt2': r.RDateLtRule,
    "dt1 >= '2026-01-01'": r.RDateLiteralRule,
    'dt2 <= dt1 + 28': r.RDatePlusDaysRule,
    'dt1 - 7 < dt2': r.RDateMinusDaysRule,
    'dt2 - dt1 >= 1': r.RDaysBetweenRule,
    'dt2 <= dt1 + i1': r.RDaysFromFieldRule,
    "dt1 - '2026-01-01' >= 0": r.RDaysBetweenLiteralRule,
    't1 < t2': r.RTsLtRule,
    't1 = t2': r.RTsEqRule,
    's1 != s2': r.RStrNeRule,
    "e1 = 'a'": r.REnumEqRule,
    'b1 = true': r.RBoolEqRule,
    'opt is absent or opt < d1': r.ROptGuardRule,
    'not i1 = 0': r.RNotRuleRule,
    'i1 = 0 or i2 = 0': r.ROrRuleRule,
  };
  const cases = Object.fromEntries(Object.entries(RULE_CASES).map(([text, [holds, breaks]]) => [text, [rules[text]!, holds, breaks] as const]));
  it.each(Object.entries(cases))('%s', (_rule, [rule, holds, breaks]) => {
    for (const p of holds) expect(rule(p as never), JSON.stringify(p)).toBe(true);
    for (const p of breaks) expect(rule(p as never), JSON.stringify(p)).toBe(false);
  });

  it('point a broken invariant at the first field its rule names, with its message', () => {
    const sample = {
      i1: 1, i2: 3, f1: 0.6, f2: 0.7, d1: '1.1', d2: '2.2', dt1: '2026-01-01', dt2: '2026-01-02',
      t1: '2026-01-01T00:00:00Z', t2: '2026-01-01T00:00:00Z', s1: 'a', s2: 'b', b1: true, e1: 'a',
    };
    const issues = v.safeParse(r.RSampleSchema, sample).issues ?? [];
    // Every rule that these values break, each at its first field.
    expect(issues.map((issue) => [v.getDotPath(issue), issue.message])).toEqual([
      // dec_plus holds: 1.1 + 2.2 is exactly 3.30.
      ['d1', 'dec_eq does not hold'],
      ['i1', 'int_eq does not hold'],
      ['i1', 'int_ge does not hold'],
      ['i1', 'int_gt does not hold'],
      ['i1', 'int_plus does not hold'],
      ['i1', 'or_rule does not hold'],
      ['t1', 'ts_lt does not hold'],
    ]);
  });
});

describe('the runtime and invariants (insurance)', () => {
  const POLICY = {
    policy_id: '123e4567-e89b-12d3-a456-426614174000',
    holder: '9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d',
    coverages: [{ peril: 'fire', limit: '1000.00' }],
    effective_date: '2026-06-01',
    premium: '120.00',
  };
  const ISSUE = 'urn:acme:insurance:policy:operation:issue_policy' as const;
  const TERM = 'urn:acme:insurance:policy:invariant:term_is_positive';

  it('rejects an input that breaks an invariant, and names it on the issue', () => {
    const result = insuranceRuntime.executeOperation(ISSUE, { ...POLICY, expiry_date: '2026-05-31' }, insuranceCore);
    expect(result).toMatchObject({
      ok: false,
      kind: 'InputRejected',
      issues: [{ path: 'expiry_date', fieldUrn: 'urn:acme:insurance:policy:field:expiry_date', invariantUrn: TERM, message: 'The expiry date must be after the effective date' }],
    });
  });

  it('calls an output that breaks an invariant a ContractViolation, with its URN', () => {
    const sabotaged = { ...insuranceCore, [ISSUE]: (policy: { readonly effective_date: string }) => ok({ ...policy, expiry_date: policy.effective_date }) };
    const result = insuranceRuntime.executeOperation(ISSUE, { ...POLICY, expiry_date: '2026-12-31' }, sabotaged as never);
    expect(result).toMatchObject({ ok: false, kind: 'ContractViolation', issues: [{ path: 'expiry_date', invariantUrn: TERM }] });
  });

  it('leaves invariantUrn out of an issue that a field schema gives', () => {
    const result = insuranceRuntime.executeOperation(ISSUE, { ...POLICY, expiry_date: '2026-12-31', premium: '0' }, insuranceCore);
    expect(result).toMatchObject({ ok: false, kind: 'InputRejected' });
    expect((result as { issues: readonly object[] }).issues.every((issue) => !('invariantUrn' in issue))).toBe(true);
  });
});
