/**
 * urn-forge's subset of CEL: parse, print, types and guards.
 */
import { describe, expect, it } from 'vitest';
import { CelSyntaxError, checkRule, parseRule, print, type CelType, type PropertyType } from '../src/index.js';

const INT: CelType = { kind: 'int' };
const DOUBLE: CelType = { kind: 'double' };
const STRING: CelType = { kind: 'string' };

/** A booking with a required party size and start, an optional deposit, contact and list of dishes. */
const OBJECTS: Record<string, Record<string, PropertyType>> = {
  booking: {
    party_size: { type: INT, optional: false },
    deposit: { type: INT, optional: true },
    starts_at: { type: STRING, optional: false },
    ends_at: { type: STRING, optional: false },
    contact: { type: { kind: 'object', name: 'contact' }, optional: true },
    dishes: { type: { kind: 'list', of: { kind: 'object', name: 'dish' } }, optional: true },
    tables: { type: { kind: 'list', of: INT }, optional: false },
    state: { type: STRING, optional: false },
  },
  contact: { email: { type: STRING, optional: false }, phone: { type: STRING, optional: true } },
  dish: { amount: { type: INT, optional: false }, note: { type: STRING, optional: true } },
};

function check(rule: string, names: Record<string, CelType> = { self: { kind: 'object', name: 'booking' } }) {
  return checkRule(parseRule(rule), { names, properties: (name) => OBJECTS[name] });
}

/** The type of a rule, or its first problem as `code: message`. */
function typeOf(rule: string, names?: Record<string, CelType>): string {
  const { type, problems } = check(rule, names);
  if (problems.length > 0) return `${problems[0]!.code}: ${problems[0]!.message}`;
  return type?.kind === 'list' ? `list(${type.of.kind})` : type?.kind ?? 'none';
}

function syntax(rule: string): string {
  try {
    parseRule(rule);
    return 'parses';
  } catch (error) {
    if (error instanceof CelSyntaxError) return error.message;
    throw error;
  }
}

describe('parse and print', () => {
  it.each([
    ['self.party_size<7||(has(self.deposit)&&self.deposit>0)', 'self.party_size < 7 || has(self.deposit) && self.deposit > 0'],
    ['(a || b) && c', '(a || b) && c'],
    ['a - (b - c)', 'a - (b - c)'],
    ['(a - b) - c', 'a - b - c'],
    ['-x * 2', '-x * 2'],
    ['-(a + b)', '-(a + b)'],
    ['!(a && b)', '!(a && b)'],
    ["self.state in ['confirmed', 'seated']", "self.state in ['confirmed', 'seated']"],
    ["timestamp(self.ends_at) > timestamp(self.starts_at) + duration('30m')", "timestamp(self.ends_at) > timestamp(self.starts_at) + duration('30m')"],
    ['self.dishes.map(d, d.amount).sum() == self.total', 'self.dishes.map(d, d.amount).sum() == self.total'],
    ['self.tables.all(t, self.tables.exists_one(u, u == t))', 'self.tables.all(t, self.tables.exists_one(u, u == t))'],
    ['self.words.filter(w, w != "")[0]=="a"', "self.words.filter(w, w != '')[0] == 'a'"],
    ['self.board[ 3*r+c ]', 'self.board[3 * r + c]'],
    ['(a?1:2)+(b ? 3 : c ? 4 : 5)==x', '(a ? 1 : 2) + (b ? 3 : c ? 4 : 5) == x'],
    ['a || b ? (c ? 1 : 2) : 3', 'a || b ? (c ? 1 : 2) : 3'],
    ['size(self.name) <= 64 && self.name.size() > 0', 'size(self.name) <= 64 && self.name.size() > 0'],
    [`self.code.matches(r'^[A-Z]{2}\\d$')`, `self.code.matches('^[A-Z]{2}\\\\d$')`],
    ['"it\'s"', "'it\\'s'"],
    ['1.50 + -2 + -0.5', '1.50 + -2 + -0.5'],
  ])('%s prints as %s', (rule, canonical) => {
    expect(print(parseRule(rule))).toBe(canonical);
    // The canonical text parses to the same canonical text.
    expect(print(parseRule(canonical))).toBe(canonical);
  });

  it.each([
    ['a < b < c', 'a chain of comparisons is not in the subset; join them with &&'],
    ['null', 'null is not in the subset; use has() for a value that can be absent'],
    ['{1: 2}', 'maps are not in the subset'],
    ['self.name.toUpperCase()', 'the method toUpperCase() is not in the subset'],
    ['uint(self.amount)', 'the function uint() is not in the subset'],
    ['has(self)', 'has() takes one property, such as has(self.deposit)'],
    ['self.name.padStart(3)', 'the method padStart() is not in the subset'],
    ['self.lines.all(1, true)', 'the first argument of all must be a name for each item'],
    ['a &&', 'expected a value, found the end of the rule'],
    ["'open", 'a string has no closing quote'],
    ['5u', 'unsigned and hexadecimal numbers are not in the subset'],
    ['a b', 'expected the end of the rule, found b'],
  ])('%s does not parse: %s', (rule, message) => {
    expect(syntax(rule)).toBe(message);
  });
});

describe('types', () => {
  it.each([
    ['self.party_size < 7', 'bool'],
    ['self.party_size + 1', 'int'],
    ['self.party_size >= 1.5', 'bool'],
    ['timestamp(self.ends_at) - timestamp(self.starts_at)', 'duration'],
    ["timestamp(self.starts_at) + duration('1h30m')", 'timestamp'],
    ['self.tables.map(t, t * 2)', 'list(int)'],
    ['self.tables.map(t, t).sum()', 'int'],
    ['size(self.tables) <= 4', 'bool'],
    ["'party_size' in self", 'bool'],
    ['self.tables.all(t, t > 0)', 'bool'],
  ])('%s is %s', (rule, type) => {
    expect(typeOf(rule)).toBe(type);
  });

  it.each([
    ['self.party_size + 1.5', 'rule-type: self.party_size + 1.5: + adds two ints, two doubles, two strings, two lists, two durations, or a timestamp and a duration, not int and double'],
    ["self.party_size == 'seven'", "rule-type: self.party_size == 'seven': == compares two values of one type, not int and string"],
    ['self.size < 7', 'rule-type: size is not a property of booking; the properties are party_size, deposit, starts_at, ends_at, contact, dishes, tables, state'],
    ['self.starts_at > self.ends_at + 1', 'rule-type: self.ends_at + 1: + adds two ints, two doubles, two strings, two lists, two durations, or a timestamp and a duration, not string and int'],
    ["duration('2 days')", "rule-type: '2 days' is not a duration; write hours, minutes or seconds, such as '2h', '30m' or '1h30m'"],
    ['duration(self.state)', "rule-type: duration() takes a literal string, such as duration('2h')"],
    ['self.party_size % 2.0 == 0', 'rule-type: self.party_size % 2.0: % takes two ints, not int and double'],
    ['has(self.party_size)', 'rule-type: has(self.party_size) is always true: party_size is required'],
    ['input.party_size > 0', 'rule-scope: input is not a name here; the names are self'],
    ['self.tables.all(self, self > 0)', 'rule-scope: self is already a name; give each item another name'],
    ['[1, 2.0]', 'rule-type: the items of [1, 2.0] must have one type'],
  ])('%s: %s', (rule, problem) => {
    expect(typeOf(rule)).toBe(problem);
  });
});

describe('guards', () => {
  it.each([
    'has(self.deposit) && self.deposit > 0',
    '!has(self.deposit) || self.deposit > 0',
    'self.party_size < 7 || (has(self.deposit) && self.deposit > 0)',
    'has(self.contact) && has(self.contact.phone) && self.contact.phone != self.contact.email',
    '!has(self.dishes) || self.dishes.map(d, d.amount).sum() > 0',
    '!has(self.dishes) || self.dishes.all(d, !has(d.note) || size(d.note) < 100)',
    '!(has(self.deposit) && has(self.contact)) || self.deposit > 0 && self.contact.email != ""',
  ])('%s reads only what it shows present', (rule) => {
    expect(check(rule).problems).toEqual([]);
  });

  it.each([
    ['self.deposit > 0', 'self.deposit'],
    ['self.deposit > 0 && has(self.deposit)', 'self.deposit'],
    ['has(self.deposit) || self.deposit > 0', 'self.deposit'],
    ['has(self.contact) && self.contact.phone != ""', 'self.contact.phone'],
    ['has(self.dishes) && self.dishes.all(d, size(d.note) < 100)', 'd.note'],
  ])('%s reads %s before a guard', (rule, property) => {
    const { problems } = check(rule);
    expect(problems.map((p) => p.code)).toContain('rule-guard');
    expect(problems.find((p) => p.code === 'rule-guard')?.message).toContain(`${property} can be absent`);
  });
});

it('a double parameter compares with an int value', () => {
  expect(typeOf('self >= bound', { self: INT, bound: DOUBLE })).toBe('bool');
});
