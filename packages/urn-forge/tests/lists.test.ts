/**
 * Rules over lists: a total over the items of a list (`sum`), an exact product (`*`),
 * uniqueness by several properties of an item (`unique: [ … ]`), and equality of embedded
 * entities. The target is tests/fixtures/lists.
 */
import { existsSync, readFileSync } from 'node:fs';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import { PLUGINS } from '../src/plugins/index.js';
import type { Urn } from '../src/ir/types.js';

/** A test of the target that does not pass yet: `it.fails` until its step is built, then `it`. */
const target = { compile: it.fails, sum: it.fails, unique: it.fails, equality: it.fails };

const source = readFileSync(new URL('./fixtures/lists/domain.manifest.yaml', import.meta.url), 'utf8');
const expected = (file: string) => new URL(`./fixtures/lists/expected/${file}`, import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const load = async (file: string): Promise<any> => (existsSync(expected(file)) ? import(expected(file).href) : undefined);
const schemas = await load('domain.schemas.generated.ts');
const runtime = await load('domain.runtime.generated.ts');
const sql = existsSync(expected('schema.generated.sql')) ? readFileSync(expected('schema.generated.sql'), 'utf8') : '';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parse = (schema: string, value: unknown): any => v.safeParse(schemas[schema], value);

describe('the lists target compiles', () => {
  target.compile('with no errors, and keeps each rule as text', () => {
    const result = compile(source);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.ir?.invariants?.['urn:demo:lists:claim:invariant:total_is_sum' as Urn]).toMatchObject({ ruleText: 'total = sum(line in lines: line.amount)' });
    expect(result.ir?.invariants?.['urn:demo:lists:payment:invariant:amount_is_sum' as Urn]).toMatchObject({
      ruleText: 'line_items is absent or amount = sum(item in line_items: item.quantity * item.unit_amount)',
    });
  });
});

describe('sum and *', () => {
  const claim = (total: string, ...amounts: string[]) => ({ claim_id: 'CLM-0001', total, lines: amounts.map((amount) => ({ amount })) });

  target.sum('accept a total that is the exact sum of the lines, and refuse another', () => {
    expect(parse('ClaimClaimSchema', claim('0.30', '0.10', '0.20')).success).toBe(true);
    const refused = parse('ClaimClaimSchema', claim('0.31', '0.10', '0.20'));
    expect(refused.success).toBe(false);
    expect(refused.issues[0].message).toBe('The total must be the sum of the line amounts');
  });

  target.sum('multiply a quantity by a unit amount exactly, and add the products', () => {
    const items = [{ quantity: 2, unit_amount: '1.25' }, { quantity: 3, unit_amount: '0.10' }];
    expect(parse('PaymentRequestSchema', { amount: '2.80', line_items: items }).success).toBe(true);
    expect(parse('PaymentRequestSchema', { amount: '2.81', line_items: items }).success).toBe(false);
    expect(parse('PaymentRequestSchema', { amount: '9.99' }).success).toBe(true);
  });

  target.sum('mark a rule with sum as not enforced in SQL', () => {
    const result = compile(source, [{ plugin: PLUGINS.valibot, config: {} }, { plugin: PLUGINS.fcis, config: {} }, { plugin: PLUGINS.postgres, config: { tables: ['claim.entity.claim', 'reservation.entity.request'] } }]);
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'unenforced-in-sql' })]));
  });
});

describe('unique by several properties', () => {
  const line = (sku: string, location: string) => ({ sku, location, quantity: 1 });

  target.unique('refuse two items with the same pair, and accept the same sku at another location', () => {
    expect(parse('ReservationRequestSchema', { order_id: 'o1', lines: [line('A', 'X'), line('A', 'Y')] }).success).toBe(true);
    const refused = parse('ReservationRequestSchema', { order_id: 'o1', lines: [line('A', 'X'), line('B', 'X'), line('A', 'X')] });
    expect(refused.success).toBe(false);
    expect(v.getDotPath(refused.issues[0])).toBe('lines.2');
  });

  target.unique('is a UNIQUE constraint of the child table over the parent key and the named columns', () => {
    expect(sql).toMatch(/UNIQUE \("order_id", "sku", "location"\)/);
  });
});

describe('equality of embedded entities', () => {
  const CHANGE = 'urn:demo:lists:subscription:operation:change_plan';
  const current = { subscription_id: 's1', status: 'active', plan: { plan_id: 'basic', price: '10.00' } };
  const core = (plan: { plan_id: string; price: string }) => ({
    [CHANGE]: (input: { plan_id: string }) => runtime.ok({ ...current, plan, scheduled_plan_id: input.plan_id }),
  });

  target.equality('keeps an answer whose plan equals the stored plan, property by property', () => {
    expect(runtime.executeOperation(CHANGE, { subscription_id: 's1', plan_id: 'pro', proration: 'at_period_end' }, core({ plan_id: 'basic', price: '10.0' }), { current })).toMatchObject({
      ok: true,
    });
  });

  target.equality('is a ContractViolation when the answer changes the plan', () => {
    expect(runtime.executeOperation(CHANGE, { subscription_id: 's1', plan_id: 'pro', proration: 'at_period_end' }, core({ plan_id: 'pro', price: '20.00' }), { current })).toMatchObject({
      ok: false,
      kind: 'ContractViolation',
      issues: [{ message: `the handler for ${CHANGE} answered a value that breaks ensures: input.proration != 'at_period_end' or output.plan = current.plan` }],
    });
  });
});
