/**
 * The invariant rule language.
 *
 *   or      := and ('or' and)*
 *   and     := unary ('and' unary)*
 *   unary   := 'not' unary | compare
 *   compare := sum (('<' | '<=' | '=' | '!=' | '>=' | '>') sum)?
 *   sum     := product (('+' | '-') product)*
 *   product := timed ('*' timed)*
 *   timed   := primary ('minutes' | 'hours' | 'days' | 'months')?
 *   primary := '(' or ')' | over | day | field 'is' ('present' | 'absent') | field | number | text | 'true' | 'false'
 *   over    := ('sum' | 'all' | 'any') '(' name 'in' field ':' or ')'
 *   day     := 'date' '(' sum ')'
 *
 * `parseRule` gives an AST whose nodes carry their column in the rule text; `stripColumns`
 * gives the form the IR keeps; `printRule` gives the canonical text. `checkRule` (pass 6)
 * types the AST against the fields of the invariant's entity.
 */
import { DECIMAL, isCalendarDate, isUtcTimestamp } from '../primitives/exact.js';
import type { Primitive } from '../primitives/index.js';

export type Comparison = '<' | '<=' | '=' | '!=' | '>=' | '>';
export type Arithmetic = '+' | '-';
/** The units of a time added to or taken from a timestamp; `months` also on a date. */
export type TimeUnit = 'minutes' | 'hours' | 'days' | 'months';
export const TIME_UNITS: readonly TimeUnit[] = ['minutes', 'hours', 'days', 'months'];
/** The milliseconds of one fixed unit: exact, as a timestamp is UTC. A month is a calendar month, of no fixed length. */
export const UNIT_MS: Readonly<Record<Exclude<TimeUnit, 'months'>, number>> = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 };
/** A rule over the items of a list: `sum`, `all` and `any`. */
export type OverItems = Extract<RuleExpr, { op: 'sum' | 'all' | 'any' }>;
/** The words that start a function: a word of the language only before "(". */
const FUNCTIONS = ['sum', 'all', 'any', 'date'];
/** The time of the call, in a condition: `now` (a timestamp) and `today` (its UTC date). */
export const TIME_NAMES: readonly string[] = ['now', 'today'];

/** A rule as the IR keeps it: JSON, no positions. Number literals keep their text, so a decimal stays exact. */
export type RuleExpr =
  | { readonly op: 'field'; readonly name: string }
  | { readonly op: 'number'; readonly value: string }
  | { readonly op: 'text'; readonly value: string }
  | { readonly op: 'boolean'; readonly value: boolean }
  | { readonly op: 'present' | 'absent'; readonly field: string }
  | { readonly op: 'not'; readonly operand: RuleExpr }
  /**
   * Over the items of `list`, with `item` naming one item inside `value`: the total of `value`
   * (`sum`), or whether `value`, a condition, holds for every item (`all`) or for one (`any`).
   */
  | { readonly op: 'sum' | 'all' | 'any'; readonly item: string; readonly list: string; readonly value: RuleExpr }
  /** The UTC date of a timestamp. */
  | { readonly op: 'date'; readonly value: RuleExpr }
  /** A time: an integer of minutes, hours or days, on the right of `+` or `-` on a timestamp. */
  | { readonly op: 'duration'; readonly value: RuleExpr; readonly unit: TimeUnit }
  | { readonly op: 'and' | 'or' | Comparison | Arithmetic | '*'; readonly left: RuleExpr; readonly right: RuleExpr };

/** The same AST, with the 1-based column of each node in the rule text. */
export type LocatedExpr = (
  | { readonly op: 'field'; readonly name: string }
  | { readonly op: 'number'; readonly value: string }
  | { readonly op: 'text'; readonly value: string }
  | { readonly op: 'boolean'; readonly value: boolean }
  | { readonly op: 'present' | 'absent'; readonly field: string }
  | { readonly op: 'not'; readonly operand: LocatedExpr }
  | { readonly op: 'sum' | 'all' | 'any'; readonly item: string; readonly list: string; readonly value: LocatedExpr }
  | { readonly op: 'date'; readonly value: LocatedExpr }
  | { readonly op: 'duration'; readonly value: LocatedExpr; readonly unit: TimeUnit }
  | { readonly op: 'and' | 'or' | Comparison | Arithmetic | '*'; readonly left: LocatedExpr; readonly right: LocatedExpr }
) & { readonly at: number };

export interface RuleProblem {
  readonly code: 'rule-syntax' | 'unknown-rule-field' | 'rule-type' | 'unguarded-field';
  readonly message: string;
  /** 1-based column in the rule text. */
  readonly column: number;
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

type Token =
  | { readonly kind: 'name'; readonly text: string; readonly at: number }
  | { readonly kind: 'number'; readonly text: string; readonly at: number }
  | { readonly kind: 'text'; readonly text: string; readonly at: number }
  | { readonly kind: 'symbol'; readonly text: string; readonly at: number }
  | { readonly kind: 'end'; readonly text: ''; readonly at: number };

const KEYWORDS = new Set(['and', 'or', 'not', 'is', 'present', 'absent', 'true', 'false']);
const SYMBOLS = ['<=', '>=', '!=', '<', '>', '=', '+', '-', '*', '(', ')', ':'];

class SyntaxProblem extends Error {
  constructor(
    message: string,
    readonly column: number,
  ) {
    super(message);
  }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i]!;
    const at = i + 1;
    if (/\s/u.test(c)) {
      i += 1;
      continue;
    }
    // A name, or a path: `input.party_size` in a condition, `total.amount_minor` into an embedded entity.
    const name = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*/u.exec(source.slice(i));
    if (name) {
      tokens.push({ kind: 'name', text: name[0], at });
      i += name[0].length;
      continue;
    }
    const number = /^[0-9]+(\.[0-9]+)?/u.exec(source.slice(i));
    if (number) {
      tokens.push({ kind: 'number', text: number[0], at });
      i += number[0].length;
      continue;
    }
    if (c === "'") {
      const end = source.indexOf("'", i + 1);
      if (end < 0) throw new SyntaxProblem('a text literal has no closing quote', at);
      tokens.push({ kind: 'text', text: source.slice(i + 1, end), at });
      i = end + 1;
      continue;
    }
    const symbol = SYMBOLS.find((s) => source.startsWith(s, i));
    if (symbol) {
      tokens.push({ kind: 'symbol', text: symbol, at });
      i += symbol.length;
      continue;
    }
    throw new SyntaxProblem(`unexpected character "${c}"`, at);
  }
  tokens.push({ kind: 'end', text: '', at: source.length + 1 });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const COMPARISONS: readonly string[] = ['<', '<=', '=', '!=', '>=', '>'];

export type ParseResult = { readonly ok: true; readonly expr: LocatedExpr } | { readonly ok: false; readonly problem: RuleProblem };

export function parseRule(source: string): ParseResult {
  try {
    const tokens = tokenize(source);
    let pos = 0;
    const peek = () => tokens[pos]!;
    const take = () => tokens[pos++]!;
    const isWord = (word: string) => peek().kind === 'name' && peek().text === word;
    const isSymbol = (symbol: string) => peek().kind === 'symbol' && peek().text === symbol;
    const describe = (t: Token) => (t.kind === 'end' ? 'the end of the rule' : `"${t.kind === 'text' ? `'${t.text}'` : t.text}"`);
    const expected = (what: string): never => {
      const t = peek();
      throw new SyntaxProblem(`expected ${what}, found ${describe(t)}`, t.at);
    };

    const or = (): LocatedExpr => {
      let left = and();
      while (isWord('or')) {
        take();
        left = { op: 'or', left, right: and(), at: left.at };
      }
      return left;
    };
    const and = (): LocatedExpr => {
      let left = unary();
      while (isWord('and')) {
        take();
        left = { op: 'and', left, right: unary(), at: left.at };
      }
      return left;
    };
    const unary = (): LocatedExpr => {
      if (isWord('not')) {
        const at = take().at;
        return { op: 'not', operand: unary(), at };
      }
      return compare();
    };
    const compare = (): LocatedExpr => {
      const left = sum();
      if (peek().kind === 'symbol' && COMPARISONS.includes(peek().text)) {
        const op = take().text as Comparison;
        const right = sum();
        if (peek().kind === 'symbol' && COMPARISONS.includes(peek().text)) {
          throw new SyntaxProblem('a comparison cannot follow another comparison; use and', peek().at);
        }
        return { op, left, right, at: left.at };
      }
      return left;
    };
    const sum = (): LocatedExpr => {
      let left = product();
      while (isSymbol('+') || isSymbol('-')) {
        const op = take().text as Arithmetic;
        left = { op, left, right: product(), at: left.at };
      }
      return left;
    };
    const product = (): LocatedExpr => {
      let left = timed();
      while (isSymbol('*')) {
        take();
        left = { op: '*', left, right: timed(), at: left.at };
      }
      return left;
    };
    /** A value, and a unit of time after it: `2 hours`, `input.days days`. */
    const timed = (): LocatedExpr => {
      const value = primary();
      const t = peek();
      if (t.kind === 'name' && (TIME_UNITS as readonly string[]).includes(t.text)) {
        take();
        return { op: 'duration', value, unit: t.text as TimeUnit, at: value.at };
      }
      return value;
    };
    /** `sum(<item> in <list>: <value>)`, `all(…: <condition>)` and `any(…: <condition>)`. */
    const over = (op: 'sum' | 'all' | 'any', at: number): LocatedExpr => {
      take(); // (
      const item = peek();
      if (item.kind !== 'name' || KEYWORDS.has(item.text) || item.text.includes('.')) expected('a name for one item, such as "line"');
      take();
      if (!isWord('in')) expected('"in"');
      take();
      const list = peek();
      if (list.kind !== 'name' || KEYWORDS.has(list.text)) expected(op === 'sum' ? 'the list to add up' : 'the list');
      take();
      if (!isSymbol(':')) expected('":"');
      take();
      const value = op === 'sum' ? sum() : or();
      if (!isSymbol(')')) expected('")"');
      take();
      return { op, item: item.text, list: list.text, value, at };
    };
    /** `date(<timestamp>)`. */
    const day = (at: number): LocatedExpr => {
      take(); // (
      const value = sum();
      if (!isSymbol(')')) expected('")"');
      take();
      return { op: 'date', value, at };
    };
    const primary = (): LocatedExpr => {
      const t = peek();
      if (isSymbol('(')) {
        take();
        const inner = or();
        if (!isSymbol(')')) expected('")"');
        take();
        return inner;
      }
      if (isSymbol('-') && tokens[pos + 1]?.kind === 'number') {
        take();
        const n = take();
        return { op: 'number', value: `-${n.text}`, at: t.at };
      }
      if (t.kind === 'number') return { op: 'number', value: take().text, at: t.at };
      if (t.kind === 'text') return { op: 'text', value: take().text, at: t.at };
      if (t.kind === 'name' && (t.text === 'true' || t.text === 'false')) return { op: 'boolean', value: take().text === 'true', at: t.at };
      if (t.kind === 'name' && FUNCTIONS.includes(t.text) && tokens[pos + 1]?.kind === 'symbol' && tokens[pos + 1]?.text === '(') {
        take();
        return t.text === 'date' ? day(t.at) : over(t.text as 'sum' | 'all' | 'any', t.at);
      }
      if (t.kind === 'name' && !KEYWORDS.has(t.text)) {
        take();
        if (isWord('is')) {
          take();
          if (isWord('present') || isWord('absent')) return { op: take().text as 'present' | 'absent', field: t.text, at: t.at };
          expected('"present" or "absent"');
        }
        return { op: 'field', name: t.text, at: t.at };
      }
      return expected('a field, a literal or "("');
    };

    const expr = or();
    if (peek().kind !== 'end') expected('"and", "or" or the end of the rule');
    return { ok: true, expr };
  } catch (error) {
    if (error instanceof SyntaxProblem) return { ok: false, problem: { code: 'rule-syntax', message: error.message, column: error.column } };
    throw error;
  }
}

/** The IR form: the same tree without columns. */
export function stripColumns(expr: LocatedExpr): RuleExpr {
  switch (expr.op) {
    case 'field':
      return { op: 'field', name: expr.name };
    case 'number':
    case 'text':
      return { op: expr.op, value: expr.value };
    case 'boolean':
      return { op: 'boolean', value: expr.value };
    case 'present':
    case 'absent':
      return { op: expr.op, field: expr.field };
    case 'not':
      return { op: 'not', operand: stripColumns(expr.operand) };
    case 'sum':
    case 'all':
    case 'any':
      return { op: expr.op, item: expr.item, list: expr.list, value: stripColumns(expr.value) };
    case 'date':
      return { op: 'date', value: stripColumns(expr.value) };
    case 'duration':
      return { op: 'duration', value: stripColumns(expr.value), unit: expr.unit };
    default:
      return { op: expr.op, left: stripColumns(expr.left), right: stripColumns(expr.right) };
  }
}

// ---------------------------------------------------------------------------
// Printer
// ---------------------------------------------------------------------------

/** Binding strength: a child that binds less tightly than its parent needs parentheses. */
function precedence(expr: RuleExpr): number {
  switch (expr.op) {
    case 'or':
      return 1;
    case 'and':
      return 2;
    case 'not':
      return 3;
    case '<':
    case '<=':
    case '=':
    case '!=':
    case '>=':
    case '>':
      return 4;
    case '+':
    case '-':
      return 5;
    case '*':
      return 6;
    default:
      return 7;
  }
}

/** The canonical text: one space around each operator, parentheses only where they are necessary. */
export function printRule(expr: RuleExpr): string {
  const wrap = (child: RuleExpr, min: number) => (precedence(child) < min ? `(${printRule(child)})` : printRule(child));
  switch (expr.op) {
    case 'field':
      return expr.name;
    case 'number':
      return expr.value;
    case 'text':
      return `'${expr.value}'`;
    case 'boolean':
      return String(expr.value);
    case 'present':
    case 'absent':
      return `${expr.field} is ${expr.op}`;
    case 'not':
      return `not ${wrap(expr.operand, 3)}`;
    case 'sum':
    case 'all':
    case 'any':
      return `${expr.op}(${expr.item} in ${expr.list}: ${printRule(expr.value)})`;
    case 'date':
      return `date(${printRule(expr.value)})`;
    case 'duration':
      return `${wrap(expr.value, 7)} ${expr.unit}`;
    default: {
      const p = precedence(expr);
      // and, or, + and - group to the left, so a right child of equal strength needs parentheses.
      // A comparison cannot hold a comparison, so both of its sides need them.
      const leftMin = p === 4 ? 5 : p;
      return `${wrap(expr.left, leftMin)} ${expr.op} ${wrap(expr.right, p + 1)}`;
    }
  }
}

// ---------------------------------------------------------------------------
// Type checker (pass 6)
// ---------------------------------------------------------------------------

/** `an integer`, `a date`: the word with its indefinite article. */
function article(word: string): string {
  return `${/^[aeiou]/u.test(word) ? 'an' : 'a'} ${word}`;
}

/** What a rule may know about a property of the invariant's entity. */
export interface RuleField {
  readonly primitive: Primitive;
  readonly required: boolean;
  readonly many: boolean;
  /** The names of an `enum`, to check a text literal. */
  readonly values?: readonly string[];
  /** An embedded entity: a rule can use it only in `is present` and `is absent`. */
  readonly embedded?: boolean;
  /** For a list of embedded entities: the properties of one item, which `sum` can name. */
  readonly items?: Readonly<Record<string, RuleField>>;
  /** For an embedded entity: its URN, so `=` can compare two of one entity; and whether it holds a list. */
  readonly entity?: string;
  readonly holdsList?: boolean;
}

type ValueType = { readonly kind: 'value'; readonly primitive: Primitive } | { readonly kind: 'literal'; readonly literal: 'number' | 'text' | 'boolean'; readonly text: string };
type Checked = ValueType | { readonly kind: 'condition' } | { readonly kind: 'duration'; readonly unit: TimeUnit };

const ORDERED: ReadonlySet<Primitive> = new Set(['integer', 'float', 'decimal', 'date', 'timestamp']);
const ARITHMETIC: ReadonlySet<Primitive> = new Set(['integer', 'decimal']);

/** The fields a condition proves present (`x is present`, and chains of `and` over them). */
function provesPresent(expr: LocatedExpr): string[] {
  if (expr.op === 'present') return [expr.field];
  if (expr.op === 'and') return [...provesPresent(expr.left), ...provesPresent(expr.right)];
  return [];
}

/** The fields a condition proves absent when it is false: the left side of `x is absent or …`. */
function provesAbsentIfFalse(expr: LocatedExpr): string[] {
  if (expr.op === 'absent') return [expr.field];
  if (expr.op === 'or') return [...provesAbsentIfFalse(expr.left), ...provesAbsentIfFalse(expr.right)];
  return [];
}

/**
 * Pass 6 for one rule: fields exist, both sides of each operator have one primitive, literals
 * fit that primitive, and each optional field is guarded. Returns every problem it finds.
 */
/** `owner` names what the fields belong to in a message: the entity of an invariant, or the values of a condition. */
export function checkRule(expr: LocatedExpr, fields: Readonly<Record<string, RuleField>>, owner = 'the entity'): RuleProblem[] {
  const problems: RuleProblem[] = [];
  const problem = (code: RuleProblem['code'], at: number, message: string) => problems.push({ code, message, column: at });

  /** Whether a literal fits a primitive; undefined when it does, else why not. */
  const literalProblem = (literal: Extract<ValueType, { kind: 'literal' }>, primitive: Primitive, values?: readonly string[]): string | undefined => {
    const shown = literal.literal === 'text' ? `'${literal.text}'` : literal.text;
    switch (primitive) {
      case 'integer':
        return literal.literal === 'number' && /^-?[0-9]+$/u.test(literal.text) ? undefined : `${shown} is not an integer`;
      case 'float':
        return literal.literal === 'number' ? undefined : `${shown} is not a number`;
      case 'decimal':
        return (literal.literal === 'number' || literal.literal === 'text') && DECIMAL.test(literal.text) ? undefined : `${shown} is not a decimal`;
      case 'date':
        return literal.literal === 'text' && isCalendarDate(literal.text) ? undefined : `${shown} is not a date in quotes, such as '2026-01-31'`;
      case 'timestamp':
        return literal.literal === 'text' && isUtcTimestamp(literal.text) ? undefined : `${shown} is not a timestamp in quotes, such as '2026-01-31T09:30:00Z'`;
      case 'boolean':
        return literal.literal === 'boolean' ? undefined : `${shown} is not true or false`;
      case 'string':
        return literal.literal === 'text' ? undefined : `${shown} is not text in quotes`;
      case 'enum':
        if (literal.literal !== 'text') return `${shown} is not text in quotes`;
        return values === undefined || values.includes(literal.text) ? undefined : `${shown} is not one of the values (${values.join(', ')})`;
    }
  };

  /** The primitive two sides share, reporting a mismatch; undefined after a problem. */
  const unify = (left: ValueType, right: ValueType, at: number, op: string, fieldsOf: (v: ValueType) => RuleField | undefined): Primitive | undefined => {
    if (left.kind === 'literal' && right.kind === 'literal') {
      problem('rule-type', at, `${op} compares two literals; one side must be a field`);
      return undefined;
    }
    if (left.kind === 'value' && right.kind === 'value') {
      if (left.primitive !== right.primitive) {
        problem('rule-type', at, `${op} has ${article(left.primitive)} on the left and ${article(right.primitive)} on the right; both sides must have one primitive`);
        return undefined;
      }
      return left.primitive;
    }
    const value = (left.kind === 'value' ? left : right) as Extract<ValueType, { kind: 'value' }>;
    const literal = (left.kind === 'literal' ? left : right) as Extract<ValueType, { kind: 'literal' }>;
    const why = literalProblem(literal, value.primitive, fieldsOf(value)?.values);
    if (why) {
      problem('rule-type', at, `${why}, so it cannot meet ${article(value.primitive)} in ${op}`);
      return undefined;
    }
    return value.primitive;
  };

  /**
   * Days: `date ± integer` is a date, `date - date` is an integer of days.
   * The date is on the left; a date text literal can stand for a date. 'not dates' when no side is a date.
   */
  const dateArithmetic = (op: '+' | '-', left: ValueType, right: ValueType, at: number): Checked | undefined | 'not dates' => {
    const isDate = (t: ValueType) => t.kind === 'value' && t.primitive === 'date';
    if (!isDate(left) && !isDate(right)) return 'not dates';
    if (isDate(left) && isDate(right)) {
      if (op === '-') return { kind: 'value', primitive: 'integer' };
      problem('rule-type', at, `"+" cannot add two dates; "-" of two dates gives the days between them`);
      return undefined;
    }
    if (!isDate(left)) {
      // A date text on the left of "-": the days from the field to that day.
      if (op === '-' && left.kind === 'literal') {
        const why = literalProblem(left, 'date');
        if (why) {
          problem('rule-type', at, `${why}, so it cannot meet a date in "-"`);
          return undefined;
        }
        return { kind: 'value', primitive: 'integer' };
      }
      problem('rule-type', at, `"${op}" needs the date on the left and an integer of days on the right`);
      return undefined;
    }
    // The date is on the left; the right is the days, or for "-" a date text.
    if (right.kind === 'literal') {
      if (op === '-' && right.literal === 'text') {
        const why = literalProblem(right, 'date');
        if (why) {
          problem('rule-type', at, `${why}, so it cannot meet a date in "-"`);
          return undefined;
        }
        return { kind: 'value', primitive: 'integer' };
      }
      const why = literalProblem(right, 'integer');
      if (why) {
        problem('rule-type', at, `${why}, so it cannot be the days in "${op}"`);
        return undefined;
      }
      return { kind: 'value', primitive: 'date' };
    }
    if (right.primitive !== 'integer') {
      problem('rule-type', at, `"${op}" ${op === '+' ? 'adds' : 'takes'} an integer of days ${op === '+' ? 'to' : 'from'} a date, not ${article(right.primitive)}`);
      return undefined;
    }
    return { kind: 'value', primitive: 'date' };
  };

  // The field behind a value, for enum values; only a bare field has one.
  const enumFields = new Map<ValueType, RuleField>();

  // The names that a rule can use: the fields, and inside a sum also the item.
  let scope: Readonly<Record<string, RuleField>> = fields;
  const check = (e: LocatedExpr, present: ReadonlySet<string>): Checked | undefined => {
    switch (e.op) {
      case 'field': {
        const field = Object.hasOwn(scope, e.name) ? scope[e.name] : undefined;
        if (!field && TIME_NAMES.includes(e.name)) {
          problem('rule-type', e.at, `"${e.name}" is the time of a call, which a rule on a value alone cannot read: an invariant must hold at any time; use ${e.name} in requires or ensures`);
          return undefined;
        }
        if (!field) {
          problem('unknown-rule-field', e.at, `"${e.name}" is not a field of ${owner} (fields: ${Object.keys(fields).join(', ')})`);
          return undefined;
        }
        if (field.many || field.embedded) {
          const what = field.many ? 'a list' : 'an embedded entity';
          problem('rule-type', e.at, `"${e.name}" is ${what}; a rule can use it only in "${e.name} is present" or "${e.name} is absent"`);
          return undefined;
        }
        if (!field.required && !present.has(e.name)) {
          problem('unguarded-field', e.at, `"${e.name}" is optional, so the rule must guard it: write "${e.name} is present and …" or "${e.name} is absent or …"`);
          return undefined;
        }
        const type: ValueType = { kind: 'value', primitive: field.primitive };
        enumFields.set(type, field);
        return type;
      }
      case 'number':
        return { kind: 'literal', literal: 'number', text: e.value };
      case 'text':
        return { kind: 'literal', literal: 'text', text: e.value };
      case 'boolean':
        return { kind: 'literal', literal: 'boolean', text: String(e.value) };
      case 'present':
      case 'absent': {
        const field = Object.hasOwn(scope, e.field) ? scope[e.field] : undefined;
        if (!field) {
          problem('unknown-rule-field', e.at, `"${e.field}" is not a field of ${owner} (fields: ${Object.keys(fields).join(', ')})`);
        } else if (field.required) {
          problem('rule-type', e.at, `"${e.field}" is required, so "${e.field} is ${e.op}" is always ${e.op === 'present'}`);
        }
        return { kind: 'condition' };
      }
      case 'not':
        condition(e.operand, present, 'not');
        return { kind: 'condition' };
      case 'and':
        condition(e.left, present, 'and');
        condition(e.right, new Set([...present, ...provesPresent(e.left)]), 'and');
        return { kind: 'condition' };
      case 'or':
        condition(e.left, present, 'or');
        condition(e.right, new Set([...present, ...provesAbsentIfFalse(e.left)]), 'or');
        return { kind: 'condition' };
      case 'duration': {
        const n = value(e.value, present, e.unit);
        if (!n) return undefined;
        const why = n.kind === 'literal' ? literalProblem(n, 'integer') : n.primitive === 'integer' ? undefined : `${article(n.primitive)} is not an integer`;
        if (why) {
          problem('rule-type', e.at, `${why}, so it cannot count ${e.unit}`);
          return undefined;
        }
        return { kind: 'duration', unit: e.unit };
      }
      case '+':
      case '-': {
        // A time: a timestamp on the left, minutes, hours or days on the right.
        if (e.right.op === 'duration' || e.left.op === 'duration') {
          const time = check(e.right, present);
          const left = e.left.op === 'duration' ? undefined : value(e.left, present, e.op);
          if (e.left.op === 'duration') {
            problem('rule-type', e.at, `"${e.op}" needs the timestamp on the left and the ${e.left.unit} on the right`);
            return undefined;
          }
          if (!time || !left) return undefined;
          // Calendar months: on a timestamp or a date, in UTC; the result has the primitive of the left.
          if (time.kind === 'duration' && time.unit === 'months' && left.kind === 'value' && (left.primitive === 'timestamp' || left.primitive === 'date')) return left;
          if (left.kind !== 'value' || left.primitive !== 'timestamp') {
            const what = left.kind === 'value' ? left.primitive : `${left.literal} literal`;
            const unit = (e.right as Extract<LocatedExpr, { op: 'duration' }>).unit;
            problem('rule-type', e.at, `"${e.op} ${unit}" works on a timestamp${unit === 'months' ? ' or a date' : ''}, not on ${article(what)}${what === 'date' ? '; a date counts days: write today + 1' : ''}`);
            return undefined;
          }
          return { kind: 'value', primitive: 'timestamp' };
        }
        const left = value(e.left, present, e.op);
        const right = value(e.right, present, e.op);
        if (!left || !right) return undefined;
        if ([left, right].some((t) => t.kind === 'value' && t.primitive === 'timestamp')) {
          problem('rule-type', e.at, `"${e.op}" on a timestamp needs a unit: write 2 hours, 15 minutes or 180 days`);
          return undefined;
        }
        const days = dateArithmetic(e.op, left, right, e.at);
        if (days !== 'not dates') return days;
        // Name the primitive that has no arithmetic before the literal that does not fit it.
        const valued = [left, right].find((t) => t.kind === 'value' && !ARITHMETIC.has(t.primitive));
        if (valued?.kind === 'value' && (left.kind === 'literal' || right.kind === 'literal' || left.primitive === right.primitive)) {
          problem('rule-type', e.at, `"${e.op}" works on integer, decimal and date only, not on ${valued.primitive}`);
          return undefined;
        }
        const primitive = unify(left, right, e.at, `"${e.op}"`, (v) => enumFields.get(v));
        if (primitive === undefined) return undefined;
        if (!ARITHMETIC.has(primitive)) {
          problem('rule-type', e.at, `"${e.op}" works on integer, decimal and date only, not on ${primitive}`);
          return undefined;
        }
        return { kind: 'value', primitive };
      }
      case '*': {
        const left = value(e.left, present, e.op);
        const right = value(e.right, present, e.op);
        if (!left || !right) return undefined;
        // An integer times an integer, or an integer times a decimal: exact, with no scale to choose.
        const kinds = [left, right].map((t) => (t.kind === 'value' ? t.primitive : t.literal === 'number' ? (/^-?[0-9]+$/u.test(t.text) ? 'integer' : 'decimal') : t.literal));
        if (left.kind === 'literal' && right.kind === 'literal') {
          problem('rule-type', e.at, '"*" multiplies two literals; one side must be a field');
          return undefined;
        }
        const ok = kinds.every((k) => k === 'integer' || k === 'decimal') && kinds.includes('integer');
        if (!ok) {
          problem('rule-type', e.at, `"*" multiplies an integer by an integer or by a decimal, not ${article(kinds[0]!)} by ${article(kinds[1]!)}`);
          return undefined;
        }
        return { kind: 'value', primitive: kinds.includes('decimal') ? 'decimal' : 'integer' };
      }
      case 'date': {
        const t = value(e.value, present, 'date');
        if (!t) return undefined;
        if (t.kind !== 'value' || t.primitive !== 'timestamp') {
          problem('rule-type', e.at, `date gives the date of a timestamp, not of ${article(t.kind === 'value' ? t.primitive : `${t.literal} literal`)}`);
          return undefined;
        }
        return { kind: 'value', primitive: 'date' };
      }
      case 'all':
      case 'any':
      case 'sum': {
        const list = Object.hasOwn(scope, e.list) ? scope[e.list] : undefined;
        if (!list) {
          problem('unknown-rule-field', e.at, `"${e.list}" is not a field of ${owner} (fields: ${Object.keys(scope).join(', ')})`);
          return undefined;
        }
        if (!list.many) {
          problem('rule-type', e.at, e.op === 'sum' ? `sum adds up the items of a list, and "${e.list}" is not a list` : `${e.op} reads the items of a list, and "${e.list}" is not a list`);
          return undefined;
        }
        if (Object.hasOwn(scope, e.item) || Object.keys(scope).some((n) => n.startsWith(`${e.item}.`))) {
          problem('rule-type', e.at, `"${e.item}" is already a name in the rule; give the item another name`);
          return undefined;
        }
        // Inside the sum, the item: its properties for a list of entities, the value itself for a list of values.
        const itemFields: Record<string, RuleField> = list.embedded
          ? Object.fromEntries(Object.entries(list.items ?? {}).map(([name, field]) => [`${e.item}.${name}`, field]))
          : { [e.item]: { primitive: list.primitive, required: true, many: false, ...(list.values ? { values: list.values } : {}) } };
        const outer = scope;
        scope = { ...scope, ...itemFields };
        if (e.op !== 'sum') {
          condition(e.value, present, e.op);
          scope = outer;
          return { kind: 'condition' };
        }
        const total = value(e.value, present, 'sum');
        scope = outer;
        if (!total) return undefined;
        const primitive = total.kind === 'value' ? total.primitive : total.literal === 'number' ? (/^-?[0-9]+$/u.test(total.text) ? 'integer' : 'decimal') : undefined;
        if (primitive !== 'integer' && primitive !== 'decimal') {
          problem('rule-type', e.at, `sum adds integers or decimals, not ${article(primitive ?? (total.kind === 'literal' ? `${total.literal} literal` : 'value'))}`);
          return undefined;
        }
        return { kind: 'value', primitive };
      }
      default: {
        // Two embedded entities of one entity: equal property by property.
        if ((e.op === '=' || e.op === '!=') && e.left.op === 'field' && e.right.op === 'field') {
          const sides = [e.left.name, e.right.name].map((name) => (Object.hasOwn(scope, name) ? scope[name] : undefined));
          if (sides.some((f) => f?.embedded && !f.many)) {
            const [l, r] = sides;
            if (!l?.embedded || !r?.embedded || l.many || r.many) {
              problem('rule-type', e.at, `"${e.op}" compares an embedded entity with something that is not an embedded entity`);
            } else if (l.entity !== r.entity) {
              problem('rule-type', e.at, `"${e.op}" compares two embedded entities of different entities (${l.entity} and ${r.entity})`);
            } else if (l.holdsList) {
              problem('rule-type', e.at, `"${e.op}" cannot compare ${l.entity}, which holds a list`);
            } else {
              for (const [name, field] of [[e.left.name, l], [e.right.name, r]] as const) {
                if (!field.required && !present.has(name)) problem('unguarded-field', e.at, `"${name}" is optional, so the rule must guard it: write "${name} is present and …" or "${name} is absent or …"`);
              }
            }
            return { kind: 'condition' };
          }
        }
        const left = value(e.left, present, e.op);
        const right = value(e.right, present, e.op);
        if (!left || !right) return { kind: 'condition' };
        const primitive = unify(left, right, e.at, `"${e.op}"`, (v) => enumFields.get(v));
        if (primitive !== undefined && e.op !== '=' && e.op !== '!=' && !ORDERED.has(primitive)) {
          problem('rule-type', e.at, `"${e.op}" needs an order, which ${primitive} does not have; use = or !=`);
        }
        return { kind: 'condition' };
      }
    }
  };
  const condition = (e: LocatedExpr, present: ReadonlySet<string>, where: string) => {
    const result = check(e, present);
    if (result?.kind === 'duration') {
      problem('rule-type', e.at, `${where} needs a condition, not a time of ${result.unit}`);
    } else if (result && result.kind !== 'condition') {
      problem('rule-type', e.at, `${where} needs a condition, such as a comparison, not ${article(result.kind === 'value' ? result.primitive : `${result.literal} literal`)}`);
    }
  };
  const value = (e: LocatedExpr, present: ReadonlySet<string>, where: string): ValueType | undefined => {
    const result = check(e, present);
    if (result?.kind === 'condition') {
      problem('rule-type', e.at, `"${where}" needs a value on each side, not a condition`);
      return undefined;
    }
    if (result?.kind === 'duration') {
      problem('rule-type', e.at, `a time of ${result.unit} is only the right side of + or - on a timestamp`);
      return undefined;
    }
    return result;
  };

  condition(expr, new Set(), 'a rule');
  return problems;
}

/**
 * The primitive of a value of a rule that passed pass 6: a field's, the result of `+` or `-`
 * (with days: `date ± integer` is a date, `date - date` an integer), or undefined for a literal.
 */
export function valueType(e: RuleExpr, primitiveOf: (field: string) => Primitive): Primitive | undefined {
  if (e.op === 'field') return primitiveOf(e.name);
  if (e.op === 'sum') return valueType(e.value, itemPrimitives(e, primitiveOf));
  if (e.op === 'date') return 'date';
  if (e.op === '*') {
    const side = (x: RuleExpr) => (x.op === 'number' ? (x.value.includes('.') ? 'decimal' : 'integer') : valueType(x, primitiveOf));
    return side(e.left) === 'decimal' || side(e.right) === 'decimal' ? 'decimal' : 'integer';
  }
  if (e.op !== '+' && e.op !== '-') return undefined;
  // A time on a timestamp is a timestamp; months on a date are a date.
  if (e.right.op === 'duration') return e.right.unit === 'months' ? valueType(e.left, primitiveOf) : 'timestamp';
  const [left, right] = [valueType(e.left, primitiveOf), valueType(e.right, primitiveOf)];
  if (left === 'date') return right === 'date' || (e.op === '-' && e.right.op === 'text') ? 'integer' : 'date';
  if (right === 'date') return 'integer'; // a date text minus a date (pass 6 allows nothing else)
  return left ?? right;
}

/**
 * Inside a sum, the primitive of a name: the item's properties are the list's (`line.amount` is
 * `lines.amount`), and the item of a list of values is the list's value.
 */
export function itemPrimitives(e: OverItems, primitiveOf: (field: string) => Primitive): (field: string) => Primitive {
  return (name) => (name === e.item ? primitiveOf(e.list) : name.startsWith(`${e.item}.`) ? primitiveOf(`${e.list}.${name.slice(e.item.length + 1)}`) : primitiveOf(name));
}

/** Whether a value counts days: a `+` or `-` with a date in it. */
export function hasDateArithmetic(e: RuleExpr, primitiveOf: (field: string) => Primitive): boolean {
  if (e.op === 'sum') return hasDateArithmetic(e.value, itemPrimitives(e, primitiveOf));
  if (e.op !== '+' && e.op !== '-') return false;
  if (e.right.op === 'duration') return false;
  return valueType(e.left, primitiveOf) === 'date' || valueType(e.right, primitiveOf) === 'date' || hasDateArithmetic(e.left, primitiveOf) || hasDateArithmetic(e.right, primitiveOf);
}

/** Every property that a rule names, once each, in text order: as a value or in a presence condition. */
export function namesIn(expr: RuleExpr): string[] {
  const names: string[] = [];
  const visit = (e: RuleExpr): void => {
    switch (e.op) {
      case 'field':
        names.push(e.name);
        return;
      case 'present':
      case 'absent':
        names.push(e.field);
        return;
      case 'not':
        visit(e.operand);
        return;
      case 'number':
      case 'text':
      case 'boolean':
        return;
      case 'duration':
        visit(e.value);
        return;
      case 'date':
        visit(e.value);
        return;
      case 'sum':
      case 'all':
      case 'any': {
        // The list, and the names of the value that are not the item.
        names.push(e.list);
        const inner: string[] = [];
        const before = names.length;
        visit(e.value);
        inner.push(...names.splice(before));
        names.push(...inner.filter((n) => n !== e.item && !n.startsWith(`${e.item}.`)));
        return;
      }
      default:
        visit(e.left);
        visit(e.right);
    }
  };
  visit(expr);
  return [...new Set(names)];
}

/** The same rule with each name that `rename` gives: for example, without its prefix. */
export function renameFields(expr: RuleExpr, rename: (name: string) => string): RuleExpr {
  switch (expr.op) {
    case 'field':
      return { op: 'field', name: rename(expr.name) };
    case 'present':
    case 'absent':
      return { op: expr.op, field: rename(expr.field) };
    case 'not':
      return { op: 'not', operand: renameFields(expr.operand, rename) };
    case 'number':
    case 'text':
    case 'boolean':
      return expr;
    case 'sum':
    case 'all':
    case 'any':
      return { op: expr.op, item: expr.item, list: rename(expr.list), value: renameFields(expr.value, (n) => (n === expr.item || n.startsWith(`${expr.item}.`) ? n : rename(n))) };
    case 'date':
      return { op: 'date', value: renameFields(expr.value, rename) };
    case 'duration':
      return { op: 'duration', value: renameFields(expr.value, rename), unit: expr.unit };
    default:
      return { op: expr.op, left: renameFields(expr.left, rename), right: renameFields(expr.right, rename) };
  }
}

/** The first field a rule names, in text order: where a broken invariant points. */
export function firstField(expr: RuleExpr): string | undefined {
  switch (expr.op) {
    case 'field':
      return expr.name;
    case 'present':
    case 'absent':
      return expr.field;
    case 'not':
      return firstField(expr.operand);
    case 'number':
    case 'text':
    case 'boolean':
      return undefined;
    case 'sum':
    case 'all':
    case 'any':
      return expr.list;
    case 'date':
    case 'duration':
      return firstField(expr.value);
    default:
      return firstField(expr.left) ?? firstField(expr.right);
  }
}
