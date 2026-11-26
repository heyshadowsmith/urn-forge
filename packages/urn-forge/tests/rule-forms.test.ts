/**
 * The target of the plan of the gaps of the rule language: each new form parses, has its type, gives
 * rule-type for a wrong type, and its generated check keeps or breaks the rule as CEL does. Where SQL
 * can state a form, the Postgres schema has it.
 */
import { describe, expect, it } from 'vitest';
import { checksOf, compileManifest } from '../src/compile.js';
import { PGlite } from '@electric-sql/pglite';
import { postgresSchema } from '../src/generate/postgres.js';

/** A manifest whose object `subject` keeps one rule, `the_rule`. */
function manifest(rule: string): string {
  return `manifest: {namespace: test, domain: forms, version: 0.1.0}
definitions:
  key: {description: A key, type: string}
  word: {description: A word, type: string}
  words: {description: Words, type: array, items: word}
  number: {description: A number, type: integer}
  numbers: {description: Numbers, type: array, items: number}
  text: {description: A text, type: string}
  flag: {description: A flag, type: boolean}
  subject:
    description: The value of the rule
    type: object
    properties: [key, words, numbers, text, flag]
    identifier: key
    rules:
      - required: [key, words, numbers, text, flag]
      - the_rule
rules:
  the_rule:
    description: The rule of the test
    rule: ${JSON.stringify(rule)}
    failure_message: The rule is broken
`;
}

const base = { key: 'k', words: ['a', 'b', 'a'], numbers: [1, 2, 3], text: '1.4.0', flag: true };

/** Whether a value keeps the rule; throws with the diagnostics when the rule does not compile. */
function holds(rule: string, change: Partial<typeof base> = {}): boolean {
  const compiled = compileManifest(manifest(rule));
  if (!compiled.model) throw new Error(compiled.diagnostics.map((d) => `${d.code}: ${d.message}`).join('\n'));
  const checks = checksOf(compiled.model, compiled.applications);
  return checks['subject']!({ ...base, ...change }, '', []);
}

/** The codes of the errors of a rule. */
function codes(rule: string): string[] {
  return compileManifest(manifest(rule)).diagnostics.filter((d) => d.severity === 'error').map((d) => d.code);
}

/** The CHECK of the rule in the Postgres schema, or undefined when it is not in SQL. */
function sql(rule: string): string | undefined {
  const compiled = compileManifest(manifest(rule));
  const schema = postgresSchema(compiled.model!, compiled.applications, { tables: ['subject'] });
  return schema.split('\n').find((line) => line.includes('subject_the_rule'));
}

describe('filter', () => {
  it('counts the items that match', () => {
    expect(holds("size(self.words.filter(w, w == 'a')) == 2")).toBe(true);
    expect(holds("size(self.words.filter(w, w == 'a')) == 2", { words: ['a', 'b'] })).toBe(false);
    expect(holds('self.numbers.filter(n, n > 1).sum() == 5')).toBe(true);
    expect(codes('size(self.words.filter(w, w)) == 1')).toEqual(['rule-type']);
    expect(sql("size(self.words.filter(w, w == 'a')) == 2")).toBeUndefined();
  });
});

describe('an index', () => {
  it('reads an item of a list, and breaks the rule out of the list', () => {
    expect(holds("self.words[1] == 'b'")).toBe(true);
    expect(holds("self.words[1] == 'b'", { words: ['a'] })).toBe(false);
    // An index out of the list breaks the rule, also where a missing item would keep it.
    expect(holds("self.words[3] != 'a'")).toBe(false);
    expect(holds("self.words[-1] != 'a'")).toBe(false);
    expect(holds('self.numbers[size(self.numbers) - 1] == 3')).toBe(true);
    expect(codes("self.words['x'] == 'a'")).toEqual(['rule-type']);
    expect(codes("self.text[0] == 'a'")).toEqual(['rule-type']);
  });
});

describe('conversions', () => {
  it('give a number from a text, and a text from a number', () => {
    expect(holds("int(self.text) == 12", { text: '12' })).toBe(true);
    expect(holds("int(self.text) == 12", { text: '1x' })).toBe(false);
    expect(holds("int(self.text) == 12", { text: '12.5' })).toBe(false);
    expect(holds('double(self.text) > 2.0', { text: '2.5' })).toBe(true);
    expect(holds("string(size(self.words)) == '3'")).toBe(true);
    expect(holds('int(2.9) == 2')).toBe(true);
    expect(codes('int(self.flag) == 1')).toEqual(['rule-type']);
    expect(sql('double(size(self.text)) > 1.0')).toContain('::DOUBLE PRECISION');
  });
});

describe('startsWith, endsWith and contains', () => {
  it('test a part of a text', () => {
    expect(holds("self.text.startsWith('1.')")).toBe(true);
    expect(holds("self.text.startsWith('2.')")).toBe(false);
    expect(holds("self.text.endsWith('.0')")).toBe(true);
    expect(holds("self.text.contains('.4.')")).toBe(true);
    expect(holds("self.text.contains('5')")).toBe(false);
    expect(codes("self.numbers.startsWith('1')")).toEqual(['rule-type']);
    expect(sql("self.text.startsWith('1.')")).toContain('starts_with(');
  });
});

describe('a conditional', () => {
  it('gives one of two values', () => {
    expect(holds('(self.flag ? 3 : 1) == size(self.words)')).toBe(true);
    expect(holds('(self.flag ? 3 : 1) == size(self.words)', { flag: false })).toBe(false);
    expect(codes("(self.flag ? 1 : 'a') == 1")).toEqual(['rule-type']);
    expect(codes('(self.text ? 1 : 2) == 1')).toEqual(['rule-type']);
    expect(sql("(self.flag ? 'yes' : 'no') == 'yes'")).toContain('CASE WHEN');
  });
});

describe('split, lowerAscii and upperAscii', () => {
  it('split a text, and change its case', () => {
    expect(holds("self.text.split('.')[0] == '1'")).toBe(true);
    expect(holds("int(self.text.split('.')[1]) == 4")).toBe(true);
    expect(holds("size(self.text.split('.')) == 3")).toBe(true);
    expect(holds("self.text.lowerAscii() == 'abc'", { text: 'AbC' })).toBe(true);
    expect(holds("self.text.upperAscii() == 'ABC'", { text: 'AbC' })).toBe(true);
    expect(codes('size(self.numbers.split(1)) == 1')).toEqual(['rule-type']);
    expect(sql("self.text.lowerAscii() == 'abc'")).toContain('translate(');
  });
});

describe('the SQL of each form', () => {
  /** Whether Postgres stores each row of the subject, with the CHECK of the rule. */
  async function stores(rule: string, rows: readonly Partial<typeof base>[]): Promise<boolean[]> {
    const compiled = compileManifest(manifest(rule));
    const db = new PGlite();
    await db.exec(postgresSchema(compiled.model!, compiled.applications, { tables: ['subject'] }));
    const stored: boolean[] = [];
    for (const [i, change] of rows.entries()) {
      const row = { ...base, ...change };
      try {
        await db.query('INSERT INTO "forms"."subject" ("key", "text", "flag") VALUES ($1, $2, $3)', [String(i), row.text, row.flag]);
        stored.push(true);
      } catch {
        stored.push(false);
      }
    }
    await db.close();
    return stored;
  }

  it.each([
    ["self.text.startsWith('1.')", ['1.4.0', '2.1', '', '1']],
    ["self.text.endsWith('.0')", ['1.4.0', '1.4.1', '.0', '']],
    ["self.text.contains('.4.')", ['1.4.0', '1.5.0', '.4.']],
    ["self.text.contains('')", ['', 'a']],
    ['int(self.text) == 12', ['12', '+12', '1x', '12.5', ' 12', '', '012']],
    ['double(self.text) > 2.0', ['2.5', '2', 'NaN', 'Infinity', ' 2.5', '1e1', '.5', 'x']],
    ["string(size(self.text)) == '3'", ['abc', 'ab']],
    ["string(self.flag) == 'true'", ['a']],
    ['int(double(size(self.text)) / 2.0) == 1', ['ab', 'abc', 'abcd']],
    ["(self.flag ? 'yes' : 'no') == self.text", ['yes', 'no']],
    ["self.text.lowerAscii() == 'abcé'", ['AbCé', 'AbCÉ', 'abcé']],
    ["self.text.upperAscii() == 'ABCé'", ['AbCé', 'ABCÉ']],
  ] as const)('%s keeps and breaks as the generated check does', async (rule, texts) => {
    const rows = texts.flatMap((text) => [true, false].map((flag) => ({ text, flag })));
    const stored = await stores(rule, rows);
    expect(rows.map((row, i) => ({ ...row, stored: stored[i] }))).toEqual(rows.map((row) => ({ ...row, stored: holds(rule, row) })));
  });
});
