/** The invariant kind (invariants plan): its IR, and later its schemas, runtime and gate 3. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
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
      'PolicyTermIsPositive',
    ]);
    expect(invariantsOf(ir, 'urn:acme:insurance:policy:entity:refund_quote' as Urn)).toEqual([]);
  });
});
