/** The invariant rule language: parse, print and type-check. */
import { describe, expect, it } from 'vitest';
import { checkRule, firstField, namesIn, parseRule, printRule, stripColumns, type LocatedExpr, type RuleField } from '../src/rules/index.js';

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
    expect(problems('count > 1.5')).toEqual([['rule-type', 1, '1.5 is not an integer, so it cannot meet an integer in ">"']]);
    expect(problems('expiry_date > 2026')).toEqual([['rule-type', 1, "2026 is not a date in quotes, such as '2026-01-31', so it cannot meet a date in \">\""]]);
    expect(problems("tier = 'bronze'")).toEqual([['rule-type', 1, "'bronze' is not one of the values (gold, silver), so it cannot meet an enum in \"=\""]]);
    expect(problems('1 < 2')).toEqual([['rule-type', 1, '"<" compares two literals; one side must be a field']]);
  });

  it('refuses an order on a primitive without one, and arithmetic outside integer and decimal', () => {
    expect(problems("tier < 'gold'")).toEqual([['rule-type', 1, '"<" needs an order, which enum does not have; use = or !=']]);
    expect(problems('ratio + 1 > 2')).toEqual([['rule-type', 1, '"+" works on integer, decimal and date only, not on float']]);
  });

  it('needs conditions where logic is, and values where comparisons are', () => {
    expect(problems('count')).toEqual([['rule-type', 1, 'a rule needs a condition, such as a comparison, not an integer']]);
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
    expect(problems("tags = 'a'")).toEqual([['rule-type', 1, '"tags" is a list; a rule can use it only in "tags is present" or "tags is absent"']]);
    expect(problems('premium is present')).toEqual([['rule-type', 1, '"premium" is required, so "premium is present" is always true']]);
  });
});

describe('days', () => {
  it('accepts a date plus or minus days, and the days between two dates', () => {
    for (const rule of [
      'expiry_date <= effective_date + 28',
      'effective_date - 7 < expiry_date',
      'expiry_date - effective_date <= 366',
      'expiry_date <= effective_date + count',
      "effective_date - '2026-01-01' >= 0",
      "'2027-01-01' - effective_date >= 0",
      'expiry_date - effective_date - 1 >= count',
      'expiry_date <= effective_date + (expiry_date - effective_date)',
      "effective_date + 1 > '2026-01-01'",
    ]) {
      expect(problems(rule), rule).toEqual([]);
    }
  });

  it('refuses each other form, with what to write', () => {
    expect(problems('effective_date + expiry_date > effective_date')).toEqual([['rule-type', 1, '"+" cannot add two dates; "-" of two dates gives the days between them']]);
    expect(problems('28 + effective_date > expiry_date')).toEqual([['rule-type', 1, '"+" needs the date on the left and an integer of days on the right']]);
    expect(problems('count - effective_date > 0')).toEqual([['rule-type', 1, '"-" needs the date on the left and an integer of days on the right']]);
    expect(problems('effective_date + 1.5 > expiry_date')).toEqual([['rule-type', 1, '1.5 is not an integer, so it cannot be the days in "+"']]);
    expect(problems("effective_date + '7' > expiry_date")).toEqual([['rule-type', 1, '\'7\' is not an integer, so it cannot be the days in "+"']]);
    expect(problems("effective_date - 'soon' > 0")).toEqual([['rule-type', 1, "'soon' is not a date in quotes, such as '2026-01-31', so it cannot meet a date in \"-\""]]);
    expect(problems('effective_date + premium > expiry_date')).toEqual([['rule-type', 1, '"+" adds an integer of days to a date, not a decimal']]);
    expect(problems('effective_date - premium > expiry_date')).toEqual([['rule-type', 1, '"-" takes an integer of days from a date, not a decimal']]);
    expect(problems('at + 1 > at')).toEqual([['rule-type', 1, '"+" on a timestamp needs a unit: write 2 hours, 15 minutes or 180 days']]);
    // The days between two dates are an integer, not a date.
    expect(problems('expiry_date - effective_date > effective_date')).toEqual([['rule-type', 1, '">" has an integer on the left and a date on the right; both sides must have one primitive']]);
  });

  it('prints the canonical text as written', () => {
    expect(canonical('(expiry_date - effective_date) - 1 >= count')).toBe('expiry_date - effective_date - 1 >= count');
    expect(canonical('expiry_date <= (effective_date + 28)')).toBe('expiry_date <= effective_date + 28');
  });
});

describe('prefixed names, for the conditions of an operation', () => {
  const fields: Record<string, RuleField> = {
    'input.party_size': { primitive: 'integer', required: true, many: false },
    'input.deposit_token': { primitive: 'string', required: false, many: false },
    'current.version': { primitive: 'integer', required: true, many: false },
  };
  const parsed = (source: string) => {
    const result = parseRule(source);
    if (!result.ok) throw new Error(result.problem.message);
    return result.expr;
  };

  it('reads a prefix and a name as one name, and prints it back', () => {
    const rule = stripColumns(parsed('input.party_size < 7 or input.deposit_token is present'));
    expect(rule).toEqual({
      op: 'or',
      left: { op: '<', left: { op: 'field', name: 'input.party_size' }, right: { op: 'number', value: '7' } },
      right: { op: 'present', field: 'input.deposit_token' },
    });
    expect(printRule(rule)).toBe('input.party_size < 7 or input.deposit_token is present');
  });

  it('types the names against the fields of the condition, with arithmetic across prefixes', () => {
    expect(checkRule(parsed('current.version + 1 > input.party_size'), fields, 'the condition')).toEqual([]);
  });

  it('names the owner of the fields when a name is not one of them', () => {
    expect(checkRule(parsed('party_size < 13'), fields, 'the condition')).toEqual([
      { code: 'unknown-rule-field', column: 1, message: '"party_size" is not a field of the condition (fields: input.party_size, input.deposit_token, current.version)' },
    ]);
  });

  it('leaves invariants as they are: a prefixed name is not a field of the entity', () => {
    expect(checkRule(parsed('input.premium > 0'), { premium: { primitive: 'integer', required: true, many: false } })).toEqual([
      { code: 'unknown-rule-field', column: 1, message: '"input.premium" is not a field of the entity (fields: premium)' },
    ]);
  });

  it('reads a path into an embedded entity as one name', () => {
    expect(parseRule('input.total.amount_minor < 1')).toMatchObject({ ok: true, expr: { left: { op: 'field', name: 'input.total.amount_minor' } } });
  });
});

describe('sum and *', () => {
  const amount: RuleField = { primitive: 'decimal', required: true, many: false };
  const fields: Record<string, RuleField> = {
    total: amount,
    count: { primitive: 'integer', required: true, many: false },
    lines: { primitive: 'string', required: true, many: true, embedded: true, items: { amount, quantity: { primitive: 'integer', required: true, many: false }, note: { primitive: 'string', required: false, many: false } } },
    tags: { primitive: 'integer', required: true, many: true },
  };
  const parsed = (source: string) => {
    const result = parseRule(source);
    if (!result.ok) throw new Error(result.problem.message);
    return result.expr;
  };
  const problems = (source: string) => checkRule(parsed(source), fields).map((p) => p.message);

  it('reads and prints a sum with a product, and keeps * tighter than +', () => {
    const rule = stripColumns(parsed('total = sum(line in lines: line.quantity * line.amount) + 1'));
    expect(printRule(rule)).toBe('total = sum(line in lines: line.quantity * line.amount) + 1');
    expect(rule).toMatchObject({ op: '=', right: { op: '+', left: { op: 'sum', item: 'line', list: 'lines', value: { op: '*' } } } });
    expect(printRule(stripColumns(parsed('count = (count + 1) * 2')))).toBe('count = (count + 1) * 2');
  });

  it('types a sum of decimals, of integers, and of a list of values', () => {
    expect(problems('total = sum(line in lines: line.amount)')).toEqual([]);
    expect(problems('count = sum(line in lines: line.quantity)')).toEqual([]);
    expect(problems('count = sum(tag in tags: tag)')).toEqual([]);
    expect(problems('total = sum(line in lines: line.quantity * line.amount)')).toEqual([]);
  });

  it('refuses a sum over a property that is not a list, of a value that is not a number, and an item name that is taken', () => {
    expect(problems('total = sum(line in total: line)')).toEqual(['sum adds up the items of a list, and "total" is not a list']);
    expect(problems("total = sum(line in lines: line.note)")).toEqual(['"line.note" is optional, so the rule must guard it: write "line.note is present and …" or "line.note is absent or …"']);
    expect(problems('total = sum(count in lines: count.amount)')).toEqual(['"count" is already a name in the rule; give the item another name']);
  });

  it('refuses a product of two decimals', () => {
    expect(problems('total = total * total')).toEqual(['"*" multiplies an integer by an integer or by a decimal, not a decimal by a decimal']);
  });

  it('keeps the item out of the names of the rule, and points at the list', () => {
    const rule = stripColumns(parsed('total = sum(line in lines: line.amount)'));
    expect(namesIn(rule)).toEqual(['total', 'lines']);
    expect(firstField({ op: 'sum', item: 'l', list: 'lines', value: { op: 'field', name: 'l.amount' } })).toBe('lines');
  });

  it('keeps a field named sum a field', () => {
    expect(stripColumns(parsed('sum > 1'))).toEqual({ op: '>', left: { op: 'field', name: 'sum' }, right: { op: 'number', value: '1' } });
  });
});

describe('equality of embedded entities', () => {
  const plan = (entity: string, holdsList = false, required = true): RuleField => ({ primitive: 'string', required, many: false, embedded: true, entity, holdsList });
  const fields: Record<string, RuleField> = {
    'output.plan': plan('urn:a:b:plan:entity:plan'),
    'current.plan': plan('urn:a:b:plan:entity:plan'),
    'current.card': plan('urn:a:b:pay:entity:card'),
    'current.basket': plan('urn:a:b:shop:entity:basket', true),
    'output.basket': plan('urn:a:b:shop:entity:basket', true),
    'current.extra': plan('urn:a:b:plan:entity:plan', false, false),
    'current.amount': { primitive: 'decimal', required: true, many: false },
  };
  const problems = (source: string) => {
    const parsed = parseRule(source);
    if (!parsed.ok) throw new Error(parsed.problem.message);
    return checkRule(parsed.expr, fields, 'the condition').map((p) => p.message);
  };

  it('compares two embedded entities of one entity with = and !=', () => {
    expect(problems('output.plan = current.plan')).toEqual([]);
    expect(problems('output.plan != current.plan')).toEqual([]);
  });

  it('refuses another entity, a value, an entity that holds a list, and an unguarded optional entity', () => {
    expect(problems('output.plan = current.card')).toEqual(['"=" compares two embedded entities of different entities (urn:a:b:plan:entity:plan and urn:a:b:pay:entity:card)']);
    expect(problems('output.plan = current.amount')).toEqual(['"=" compares an embedded entity with something that is not an embedded entity']);
    expect(problems('output.basket = current.basket')).toEqual(['"=" cannot compare urn:a:b:shop:entity:basket, which holds a list']);
    expect(problems('output.plan = current.extra')).toEqual(['"current.extra" is optional, so the rule must guard it: write "current.extra is present and …" or "current.extra is absent or …"']);
    expect(problems('current.extra is present and output.plan = current.extra')).toEqual([]);
  });
});

describe('paths into embedded entities', () => {
  const minor: RuleField = { primitive: 'integer', required: true, many: false };
  const fields: Record<string, RuleField> = {
    'total.amount_minor': minor,
    'fee.amount_minor': { ...minor, required: false },
    total: { primitive: 'string', required: true, many: false, embedded: true, entity: 'urn:a:b:money:entity:money' },
    lines: { primitive: 'string', required: true, many: true, embedded: true, items: { amount: { primitive: 'string', required: true, many: false, embedded: true }, 'amount.amount_minor': minor } },
  };
  const problems = (source: string) => {
    const parsed = parseRule(source);
    if (!parsed.ok) throw new Error(parsed.problem.message);
    return checkRule(parsed.expr, fields).map((p) => p.message);
  };

  it('names a property inside an embedded entity, also inside a sum', () => {
    expect(problems('total.amount_minor = sum(line in lines: line.amount.amount_minor)')).toEqual([]);
  });

  it('asks for a guard on a property of an optional embedded entity', () => {
    expect(problems('fee.amount_minor > 0')).toEqual(['"fee.amount_minor" is optional, so the rule must guard it: write "fee.amount_minor is present and …" or "fee.amount_minor is absent or …"']);
    expect(problems('fee.amount_minor is absent or fee.amount_minor > 0')).toEqual([]);
  });
});
