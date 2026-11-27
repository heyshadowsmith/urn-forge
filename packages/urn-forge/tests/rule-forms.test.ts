/**
 * The target of the plan of the gaps of the rule language: each new form parses, has its type, gives
 * rule-type for a wrong type, and its generated check keeps or breaks the rule as CEL does.
 */
import { describe, expect, it } from 'vitest';
import { checksOf, compileManifest } from '../src/compile.js';
import { join } from 'node:path';
import ts from 'typescript';
import { generatedFile } from '../src/generate/code.js';

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
  amount: {description: An amount, type: integer}
  ratio: {description: A ratio, type: number}
  flag: {description: A flag, type: boolean}
  subject:
    description: The value of the rule
    type: object
    properties: [key, words, numbers, text, flag, amount, ratio]
    identifier: key
    rules:
      - required: [key, words, numbers, text, flag, amount, ratio]
      - the_rule
rules:
  the_rule:
    description: The rule of the test
    rule: ${JSON.stringify(rule)}
    failure_message: The rule is broken
`;
}

const base = { key: 'k', words: ['a', 'b', 'a'], numbers: [1, 2, 3], text: '1.4.0', flag: true, amount: 5, ratio: 2.5 };

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

describe('filter', () => {
  it('counts the items that match', () => {
    expect(holds("size(self.words.filter(w, w == 'a')) == 2")).toBe(true);
    expect(holds("size(self.words.filter(w, w == 'a')) == 2", { words: ['a', 'b'] })).toBe(false);
    expect(holds('self.numbers.filter(n, n > 1).sum() == 5')).toBe(true);
    expect(codes('size(self.words.filter(w, w)) == 1')).toEqual(['rule-type']);
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
    expect(holds("double(self.text) != 2.0", { text: 'NaN' })).toBe(true);
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
  });
});

describe('a conditional', () => {
  it('gives one of two values', () => {
    expect(holds('(self.flag ? 3 : 1) == size(self.words)')).toBe(true);
    expect(holds('(self.flag ? 3 : 1) == size(self.words)', { flag: false })).toBe(false);
    expect(codes("(self.flag ? 1 : 'a') == 1")).toEqual(['rule-type']);
    expect(codes('(self.text ? 1 : 2) == 1')).toEqual(['rule-type']);
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
  });
});

describe('the types of the generated code', () => {
  /** The type errors of the generated file of a rule, as gate 1 would see them. */
  function typeErrors(rule: string): string[] {
    const compiled = compileManifest(manifest(rule));
    const file = join(import.meta.dirname, '__rule__.generated.ts');
    const text = generatedFile(compiled.model!, compiled.applications, 'domain.manifest.yaml', () => 'x');
    const options: ts.CompilerOptions = { strict: true, noEmit: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, skipLibCheck: true };
    const host = ts.createCompilerHost(options);
    const read = host.getSourceFile.bind(host);
    host.getSourceFile = (name, version) => (name === file ? ts.createSourceFile(name, text, version) : read(name, version));
    const fileExists = host.fileExists.bind(host);
    host.fileExists = (name) => name === file || fileExists(name);
    const program = ts.createProgram([file], options, host);
    // Only the errors on the line of the rule: the test manifest has no operation, which the rest of the file reads.
    const lineOf = (start: number): string => text.slice(text.lastIndexOf('\n', start) + 1, text.indexOf('\n', start));
    return ts
      .getPreEmitDiagnostics(program)
      .filter((d) => d.start !== undefined && lineOf(d.start).includes('"the_rule"'))
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  }

  it('type-checks a helper that takes the item of a list', () => {
    expect(typeErrors('math.least(size(self.words), [3, 4][1]) == 3 && [self.text][0].startsWith(\'1\')')).toEqual([]);
  });
});

describe('characters outside the Basic Multilingual Plane', () => {
  // An emoji is two units of a JavaScript string, and one character of CEL.
  it.each([
    "'😀ab'.substring(1, 2) == 'a'",
    "'😀ab'.substring(1) == 'ab'",
    "'😀ab'.charAt(1) == 'a'",
    "'😀ab😀'.indexOf('b') == 2",
    "'😀ab😀b'.lastIndexOf('b') == 4",
    "size('😀ab') == 3",
    "'😀ab'.split('').size() == 3",
  ])('%s', (rule) => {
    expect(holds(rule)).toBe(true);
  });
});
