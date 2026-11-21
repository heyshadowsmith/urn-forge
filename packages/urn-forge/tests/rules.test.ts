/** The invariant rule language (invariants plan, step 1): parse, print and type-check. */
import { describe, expect, it } from 'vitest';
import { checkRule, firstField, parseRule, printRule, stripColumns, type LocatedExpr, type RuleField } from '../src/rules/index.js';

const parse = (text: string): LocatedExpr => {
  const result = parseRule(text);
  if (!result.ok) throw new Error(`${result.problem.message} at ${result.problem.column}`);
  return result.expr;
};
const canonical = (text: string) => printRule(stripColumns(parse(text)));

const POLICY: Record<string, RuleField> = {
  effective_date: { primitive: 'date', required: true, many: false },
  expiry_date: { primitive: 'date', required: true, many: false },
  premium: { primitive: 'decimal', required: true, many: false },
  deductible: { primitive: 'decimal', required: false, many: false },
  count: { primitive: 'integer', required: true, many: false },
  ratio: { primitive: 'float', required: true, many: false },
  at: { primitive: 'timestamp', required: true, many: false },
  tier: { primitive: 'enum', required: true, many: false, values: ['gold', 'silver'] },
  note: { primitive: 'string', required: true, many: false },
  flag: { primitive: 'boolean', required: true, many: false },
  tags: { primitive: 'string', required: false, many: true },
};
const problems = (text: string) => checkRule(parse(text), POLICY).map((p) => [p.code, p.column, p.message]);

describe('parseRule and printRule', () => {
  it('print a canonical form that parses to the same tree', () => {
    for (const text of [
      'expiry_date > effective_date',
      'deductible is absent or deductible < premium',
      'not (count > 1 and count < 5) or tier = \'gold\'',
      'count + 1 - 2 <= 10',
      'count - (1 - 2) = 3',
      'flag = true and note != \'x\'',
      'premium >= -0.5',
    ]) {
      const printed = canonical(text);
      expect(canonical(printed), text).toBe(printed);
      expect(stripColumns(parse(printed)), text).toEqual(stripColumns(parse(text)));
    }
  });

  it('bind not, then and, then or, and remove parentheses that are not necessary', () => {
    expect(canonical('((a < b)) or (c < d and e < f)')).toBe('a < b or c < d and e < f');
    expect(canonical('(a < b or c < d) and e < f')).toBe('(a < b or c < d) and e < f');
    expect(canonical('not (a < b)')).toBe('not a < b');
    expect(canonical('not (a < b and c < d)')).toBe('not (a < b and c < d)');
  });

  it('keep number literals as text, so a decimal stays exact', () => {
    expect(stripColumns(parse('premium > 0.10'))).toEqual({ op: '>', left: { op: 'field', name: 'premium' }, right: { op: 'number', value: '0.10' } });
  });

  it('report a syntax problem with its column', () => {
    const at = (text: string) => {
      const result = parseRule(text);
      return result.ok ? undefined : [result.problem.code, result.problem.column, result.problem.message];
    };
    expect(at('expiry_date > ')).toEqual(['rule-syntax', 15, 'expected a field, a literal or "(", found the end of the rule']);
    expect(at('a < b < c')).toEqual(['rule-syntax', 7, 'a comparison cannot follow another comparison; use and']);
    expect(at("note = 'x")).toEqual(['rule-syntax', 8, 'a text literal has no closing quote']);
    expect(at('a is here')).toEqual(['rule-syntax', 6, 'expected "present" or "absent", found "here"']);
    expect(at('a < b c')).toEqual(['rule-syntax', 7, 'expected "and", "or" or the end of the rule, found "c"']);
    expect(at('a # b')).toEqual(['rule-syntax', 3, 'unexpected character "#"']);
    expect(at('(a < b')).toEqual(['rule-syntax', 7, 'expected ")", found the end of the rule']);
  });

  it('give the first field a rule names', () => {
    expect(firstField(stripColumns(parse('deductible is absent or deductible < premium')))).toBe('deductible');
    expect(firstField(stripColumns(parse("'2026-01-01' < expiry_date")))).toBe('expiry_date');
  });
});

describe('checkRule (pass 6)', () => {
  it('accepts each comparison, literal and guard that fits', () => {
    for (const text of [
      'expiry_date > effective_date',
      "effective_date >= '2026-01-01'",
      'deductible is absent or deductible < premium',
      'deductible is present and deductible >= 0',
      "premium + '0.01' > premium - 1",
      'count + 1 <= 10',
      'ratio > 0.5 and ratio < 1',
      "at < '2027-01-01T00:00:00Z'",
      "tier = 'gold' or tier != 'silver'",
      "note != ''",
      'flag = true',
      'tags is present',
      'not (count = 0)',
    ]) {
      expect(problems(text), text).toEqual([]);
    }
  });

  it('refuses a field that the entity does not have', () => {
    expect(problems('expiry > effective_date')).toEqual([['unknown-rule-field', 1, expect.stringContaining('"expiry" is not a field of the entity (fields: effective_date, expiry_date,')]]);
  });

  it('refuses sides of two primitives, and literals that do not fit', () => {
    expect(problems('premium > effective_date')).toEqual([['rule-type', 1, '">" has a decimal on the left and a date on the right; both sides must have one primitive']]);
    expect(problems('count > 1.5')).toEqual([['rule-type', 1, '1.5 is not an integer, so it cannot meet a integer in ">"']]);
    expect(problems('expiry_date > 2026')).toEqual([['rule-type', 1, "2026 is not a date in quotes, such as '2026-01-31', so it cannot meet a date in \">\""]]);
    expect(problems("tier = 'bronze'")).toEqual([['rule-type', 1, "'bronze' is not one of the values (gold, silver), so it cannot meet a enum in \"=\""]]);
    expect(problems('1 < 2')).toEqual([['rule-type', 1, '"<" compares two literals; one side must be a field']]);
  });

  it('refuses an order on a primitive without one, and arithmetic outside integer and decimal', () => {
    expect(problems("tier < 'gold'")).toEqual([['rule-type', 1, '"<" needs an order, which enum does not have; use = or !=']]);
    expect(problems('ratio + 1 > 2')).toEqual([['rule-type', 1, '"+" works on integer and decimal only, not on float']]);
  });

  it('needs conditions where logic is, and values where comparisons are', () => {
    expect(problems('count')).toEqual([['rule-type', 1, 'a rule needs a condition, such as a comparison, not a integer']]);
    expect(problems('flag and count > 1')).toEqual([['rule-type', 1, 'and needs a condition, such as a comparison, not a boolean']]);
    expect(problems('(count > 1) > 2')).toEqual([['rule-type', 2, '">" needs a value on each side, not a condition']]);
  });

  it('needs a guard for an optional field, and only where the guard holds', () => {
    expect(problems('deductible < premium')).toEqual([
      ['unguarded-field', 1, '"deductible" is optional, so the rule must guard it: write "deductible is present and …" or "deductible is absent or …"'],
    ]);
    expect(problems('deductible < premium or deductible is absent')).toEqual([['unguarded-field', 1, expect.any(String)]]);
    expect(problems('deductible is present or deductible < premium')).toEqual([['unguarded-field', 26, expect.any(String)]]);
  });

  it('refuses a list outside presence, and presence of a required field', () => {
    expect(problems("tags = 'a'")).toEqual([['rule-type', 1, '"tags" is a list; a rule can use a list only in "tags is present" or "tags is absent"']]);
    expect(problems('premium is present')).toEqual([['rule-type', 1, '"premium" is required, so "premium is present" is always true']]);
  });
});
