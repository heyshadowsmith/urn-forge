/**
 * urn-forge's subset of CEL (the Common Expression Language), as Kubernetes and Buf's protovalidate
 * use it with schemas. Every rule that parses here is valid CEL. A form of CEL outside the subset is a
 * syntax error that names it, so that the subset grows only for a real need.
 *
 * The subset:
 * - names (`self`, `input`, `output`, parameters, the variable of a macro), properties: `a.b`, and an
 *   item of a list: `l[i]`;
 * - literals: integers, doubles, strings in single or double quotes (`r'…'` for raw), `true`, `false`,
 *   and lists `[a, b]`;
 * - `!`, unary `-`, `*`, `/`, `%`, `+`, `-`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `in`, `&&`, `||`,
 *   `c ? a : b`, and parentheses;
 * - the functions `has(a.b)`, `size(x)`, `timestamp(s)`, `duration(s)`, `int(x)`, `double(x)`,
 *   `string(x)`, and the methods `x.size()`, `s.matches(re)`, `s.startsWith(t)`, `s.endsWith(t)`,
 *   `s.contains(t)`, `l.sum()`, and from the strings extension `s.split(t)`, `s.lowerAscii()` and
 *   `s.upperAscii()`;
 * - the macros `l.all(x, p)`, `l.exists(x, p)`, `l.exists_one(x, p)`, `l.map(x, e)` and `l.filter(x, p)`.
 */

import { arities } from './functions.js';

export type BinaryOp = '||' | '&&' | '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | '+' | '-' | '*' | '/' | '%';
export type MacroName = 'all' | 'exists' | 'exists_one' | 'map' | 'filter';
/** `has`, `duration`, or a name of the table of functions (src/cel/functions.ts). */
export type FunctionName = string;

/** A node of a rule. `at` is its offset in the text, from 0. */
export type Expr =
  | { readonly kind: 'name'; readonly name: string; readonly at: number }
  | { readonly kind: 'int'; readonly value: number; readonly at: number }
  | { readonly kind: 'double'; readonly value: number; readonly text: string; readonly at: number }
  | { readonly kind: 'string'; readonly value: string; readonly at: number }
  | { readonly kind: 'bool'; readonly value: boolean; readonly at: number }
  | { readonly kind: 'list'; readonly items: readonly Expr[]; readonly at: number }
  | { readonly kind: 'select'; readonly operand: Expr; readonly field: string; readonly at: number }
  | { readonly kind: 'index'; readonly operand: Expr; readonly index: Expr; readonly at: number }
  | { readonly kind: 'call'; readonly fn: FunctionName; readonly target?: Expr; readonly args: readonly Expr[]; readonly at: number }
  | { readonly kind: 'macro'; readonly macro: MacroName; readonly target: Expr; readonly variable: string; readonly body: Expr; readonly at: number }
  | { readonly kind: 'unary'; readonly op: '!' | '-'; readonly operand: Expr; readonly at: number }
  | { readonly kind: 'binary'; readonly op: BinaryOp; readonly left: Expr; readonly right: Expr; readonly at: number }
  | { readonly kind: 'conditional'; readonly condition: Expr; readonly then: Expr; readonly otherwise: Expr; readonly at: number };

/** A rule that does not parse: the message, and the offset where the problem is. */
export class CelSyntaxError extends Error {
  constructor(
    message: string,
    readonly at: number,
  ) {
    super(message);
  }
}

type Token =
  | { readonly kind: 'name'; readonly text: string; readonly at: number }
  | { readonly kind: 'int'; readonly value: number; readonly text: string; readonly at: number }
  | { readonly kind: 'double'; readonly value: number; readonly text: string; readonly at: number }
  | { readonly kind: 'string'; readonly value: string; readonly at: number }
  | { readonly kind: 'symbol'; readonly text: string; readonly at: number }
  | { readonly kind: 'end'; readonly at: number };

const SYMBOLS = ['||', '&&', '==', '!=', '<=', '>=', '<', '>', '!', '+', '-', '*', '/', '%', '(', ')', '[', ']', ',', '.', '?', ':'];
const ESCAPES: Readonly<Record<string, string>> = { '\\': '\\', "'": "'", '"': '"', '`': '`', '?': '?', n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', f: '\f', v: '\v' };

/** An escape of a string, at the backslash: the text that it stands for, and its length. */
function escape(text: string, i: number): [string, number] {
  const e = text[i + 1];
  if (e !== undefined && Object.hasOwn(ESCAPES, e)) return [ESCAPES[e]!, 2];
  const code = (digits: string | undefined, base: number, length: number): [string, number] => {
    const point = digits === undefined ? NaN : parseInt(digits, base);
    if (Number.isNaN(point) || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) throw new CelSyntaxError(`the escape ${text.slice(i, i + length)} is not a character`, i);
    return [String.fromCodePoint(point), length];
  };
  if (e === 'x' || e === 'X') return code(/^[0-9a-fA-F]{2}/.exec(text.slice(i + 2))?.[0], 16, 4);
  if (e === 'u') return code(/^[0-9a-fA-F]{4}/.exec(text.slice(i + 2))?.[0], 16, 6);
  if (e === 'U') return code(/^[0-9a-fA-F]{8}/.exec(text.slice(i + 2))?.[0], 16, 10);
  if (e !== undefined && /[0-3]/.test(e)) return code(/^[0-3][0-7]{2}/.exec(text.slice(i + 1))?.[0], 8, 4);
  throw new CelSyntaxError(`the escape \\${e ?? ''} is not in CEL`, i);
}

function lex(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const at = i;
    const raw = (c === 'r' || c === 'R') && (text[i + 1] === "'" || text[i + 1] === '"');
    if (c === "'" || c === '"' || raw) {
      const start = raw ? i + 1 : i;
      const triple = text.startsWith(text[start]!.repeat(3), start);
      const quote = text[start]!.repeat(triple ? 3 : 1);
      i = start + quote.length;
      let value = '';
      for (;;) {
        if (i >= text.length || (text[i] === '\n' && !triple)) throw new CelSyntaxError('a string has no closing quote', at);
        if (text.startsWith(quote, i)) {
          i += quote.length;
          break;
        }
        const d = text[i]!;
        if (d === '\\' && !raw) {
          const [part, length] = escape(text, i);
          value += part;
          i += length;
          continue;
        }
        value += d;
        i++;
      }
      tokens.push({ kind: 'string', value, at });
      continue;
    }
    const hex = /^0[xX][0-9a-fA-F]+/.exec(text.slice(i));
    if (hex && !/^[uU]/.test(text.slice(i + hex[0].length))) {
      const value = parseInt(hex[0].slice(2), 16);
      if (!Number.isSafeInteger(value)) throw new CelSyntaxError(`the integer ${hex[0]} is too large`, at);
      tokens.push({ kind: 'int', value, text: hex[0], at });
      i += hex[0].length;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(text[i + 1] ?? ''))) {
      const match = /^([0-9]*\.[0-9]+([eE][+-]?[0-9]+)?|[0-9]+(\.[0-9]+([eE][+-]?[0-9]+)?|[eE][+-]?[0-9]+)?)/.exec(text.slice(i))!;
      const literal = match[0];
      const isInt = /^[0-9]+$/.test(literal);
      if (/^0[0-9]/.test(literal) && isInt) throw new CelSyntaxError(`the integer ${literal} starts with 0`, at);
      if (/^[uUxX]/.test(text.slice(i + literal.length))) throw new CelSyntaxError('unsigned and hexadecimal numbers are not in the subset', at);
      if (isInt) {
        const value = Number(literal);
        if (!Number.isSafeInteger(value)) throw new CelSyntaxError(`the integer ${literal} is too large`, at);
        tokens.push({ kind: 'int', value, text: literal, at });
      } else {
        tokens.push({ kind: 'double', value: Number(literal), text: literal, at });
      }
      i += literal.length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i))![0];
      tokens.push({ kind: 'name', text: name, at });
      i += name.length;
      continue;
    }
    const symbol = SYMBOLS.find((s) => text.startsWith(s, i));
    if (!symbol) {
      const why = c === '{' ? 'maps are not in the subset' : `the character ${c} is not in the subset`;
      throw new CelSyntaxError(why, at);
    }
    tokens.push({ kind: 'symbol', text: symbol, at });
    i += symbol.length;
  }
  tokens.push({ kind: 'end', at: text.length });
  return tokens;
}

const RELATIONS: readonly BinaryOp[] = ['==', '!=', '<', '<=', '>', '>=', 'in'];
const MACROS: readonly string[] = ['all', 'exists', 'exists_one', 'map', 'filter'];
/** The namespaces of functions, such as math in math.greatest(). */
const NAMESPACES: readonly string[] = ['math', 'lists', 'strings'];

const count = (n: number): string => (n === 0 ? 'no argument' : n === 1 ? 'one argument' : `${n} arguments`);
const RESERVED = new Set(['true', 'false', 'null', 'in', 'as', 'break', 'const', 'continue', 'else', 'for', 'function', 'if', 'import', 'let', 'loop', 'package', 'namespace', 'return', 'var', 'void', 'while']);

class Parser {
  private index = 0;

  constructor(private readonly tokens: readonly Token[]) {}

  private get next(): Token {
    return this.tokens[this.index]!;
  }

  private symbol(text: string): boolean {
    const token = this.next;
    if (token.kind === 'symbol' && token.text === text) {
      this.index++;
      return true;
    }
    return false;
  }

  private expect(text: string, what: string): void {
    if (!this.symbol(text)) throw new CelSyntaxError(`expected ${what}, found ${describe(this.next)}`, this.next.at);
  }

  parseRule(): Expr {
    const expr = this.expr();
    if (this.next.kind !== 'end') throw new CelSyntaxError(`expected the end of the rule, found ${describe(this.next)}`, this.next.at);
    return expr;
  }

  /** `c ? a : b`, as in CEL: the condition and the first value are below ?:, the last value can be another ?:. */
  private expr(): Expr {
    const condition = this.or();
    const at = this.next.at;
    if (!this.symbol('?')) return condition;
    const then = this.or();
    this.expect(':', ': after the first value of ?');
    return { kind: 'conditional', condition, then, otherwise: this.expr(), at };
  }

  private or(): Expr {
    let left = this.and();
    for (let at = this.next.at; this.symbol('||'); at = this.next.at) left = { kind: 'binary', op: '||', left, right: this.and(), at };
    return left;
  }

  private and(): Expr {
    let left = this.relation();
    for (let at = this.next.at; this.symbol('&&'); at = this.next.at) left = { kind: 'binary', op: '&&', left, right: this.relation(), at };
    return left;
  }

  private relationOp(): BinaryOp | undefined {
    const token = this.next;
    if (token.kind === 'name' && token.text === 'in') return 'in';
    if (token.kind === 'symbol' && (RELATIONS as readonly string[]).includes(token.text)) return token.text as BinaryOp;
    return undefined;
  }

  private relation(): Expr {
    const left = this.sum();
    const op = this.relationOp();
    if (!op) return left;
    const at = this.next.at;
    this.index++;
    const expr: Expr = { kind: 'binary', op, left, right: this.sum(), at };
    if (this.relationOp()) throw new CelSyntaxError('a chain of comparisons is not in the subset; join them with &&', this.next.at);
    return expr;
  }

  private sum(): Expr {
    let left = this.product();
    for (;;) {
      const at = this.next.at;
      if (this.symbol('+')) left = { kind: 'binary', op: '+', left, right: this.product(), at };
      else if (this.symbol('-')) left = { kind: 'binary', op: '-', left, right: this.product(), at };
      else return left;
    }
  }

  private product(): Expr {
    let left = this.unary();
    for (;;) {
      const at = this.next.at;
      const op = (['*', '/', '%'] as const).find((s) => this.symbol(s));
      if (!op) return left;
      left = { kind: 'binary', op, left, right: this.unary(), at };
    }
  }

  private unary(): Expr {
    const at = this.next.at;
    if (this.symbol('!')) return { kind: 'unary', op: '!', operand: this.unary(), at };
    if (this.symbol('-')) {
      const operand = this.unary();
      // A negative literal is a literal, as in CEL.
      if (operand.kind === 'int') return { kind: 'int', value: -operand.value, at };
      if (operand.kind === 'double') return { kind: 'double', value: -operand.value, text: `-${operand.text}`, at };
      return { kind: 'unary', op: '-', operand, at };
    }
    return this.member();
  }

  private member(): Expr {
    let expr = this.primary();
    for (;;) {
      const at = this.next.at;
      if (this.symbol('[')) {
        const index = this.expr();
        this.expect(']', '] to close the index');
        expr = { kind: 'index', operand: expr, index, at };
        continue;
      }
      if (!this.symbol('.')) return expr;
      const token = this.next;
      if (token.kind !== 'name' || RESERVED.has(token.text)) throw new CelSyntaxError(`expected a name after ., found ${describe(token)}`, token.at);
      this.index++;
      if (!this.symbol('(')) {
        expr = { kind: 'select', operand: expr, field: token.text, at: token.at };
        continue;
      }
      if (MACROS.includes(token.text)) {
        const variable = this.next;
        if (variable.kind !== 'name' || RESERVED.has(variable.text)) throw new CelSyntaxError(`the first argument of ${token.text} must be a name for each item`, variable.at);
        this.index++;
        this.expect(',', `, after ${variable.text}`);
        const body = this.expr();
        this.expect(')', `) to close ${token.text}`);
        expr = { kind: 'macro', macro: token.text as MacroName, target: expr, variable: variable.text, body, at: token.at };
        continue;
      }
      const args = this.args();
      // math.greatest(…): a function of a namespace, not a method of a name.
      const namespaced = expr.kind === 'name' && NAMESPACES.includes(expr.name) ? `${expr.name}.${token.text}` : undefined;
      const name = namespaced ?? token.text;
      const counts = arities(name, namespaced === undefined);
      if (counts.length === 0) throw new CelSyntaxError(`the ${namespaced ? 'function' : 'method'} ${name}() is not in the subset`, token.at);
      if (!counts.includes(args.length)) throw new CelSyntaxError(`${name}() takes ${counts.map(count).join(' or ')}`, token.at);
      expr = namespaced ? { kind: 'call', fn: name, args, at: expr.at } : { kind: 'call', fn: name, target: expr, args, at: token.at };
    }
  }

  private args(): Expr[] {
    const args: Expr[] = [];
    if (this.symbol(')')) return args;
    do args.push(this.expr());
    while (this.symbol(','));
    this.expect(')', ') or ,');
    return args;
  }

  private primary(): Expr {
    const token = this.next;
    const at = token.at;
    if (token.kind === 'int' || token.kind === 'double' || token.kind === 'string') {
      this.index++;
      if (token.kind === 'int') return { kind: 'int', value: token.value, at };
      if (token.kind === 'double') return { kind: 'double', value: token.value, text: token.text, at };
      return { kind: 'string', value: token.value, at };
    }
    if (token.kind === 'symbol' && token.text === '(') {
      this.index++;
      const expr = this.expr();
      this.expect(')', ')');
      return expr;
    }
    if (token.kind === 'symbol' && token.text === '[') {
      this.index++;
      const items: Expr[] = [];
      if (!this.symbol(']')) {
        do items.push(this.expr());
        while (this.symbol(','));
        this.expect(']', '] or ,');
      }
      return { kind: 'list', items, at };
    }
    if (token.kind === 'name') {
      this.index++;
      if (token.text === 'true' || token.text === 'false') return { kind: 'bool', value: token.text === 'true', at };
      if (token.text === 'null') throw new CelSyntaxError('null is not in the subset; use has() for a value that can be absent', at);
      if (RESERVED.has(token.text)) throw new CelSyntaxError(`${token.text} is a reserved word of CEL`, at);
      if (!this.symbol('(')) return { kind: 'name', name: token.text, at };
      const args = this.args();
      switch (token.text) {
        case 'has':
          if (args.length !== 1 || args[0]!.kind !== 'select') throw new CelSyntaxError('has() takes one property, such as has(self.deposit)', at);
          return { kind: 'call', fn: 'has', args, at };
        case 'duration':
          if (args.length !== 1) throw new CelSyntaxError('duration() takes one argument', at);
          return { kind: 'call', fn: 'duration', args, at };
        default: {
          const counts = arities(token.text, false);
          if (counts.length === 0) throw new CelSyntaxError(`the function ${token.text}() is not in the subset`, at);
          if (!counts.includes(args.length)) throw new CelSyntaxError(`${token.text}() takes ${counts.map(count).join(' or ')}`, at);
          return { kind: 'call', fn: token.text, args, at };
        }
      }
    }
    throw new CelSyntaxError(`expected a value, found ${describe(token)}`, at);
  }
}

function describe(token: Token): string {
  switch (token.kind) {
    case 'end':
      return 'the end of the rule';
    case 'string':
      return 'a string';
    case 'int':
    case 'double':
    case 'name':
    case 'symbol':
      return token.text;
  }
}

/** Parses a rule. Throws a CelSyntaxError when it does not parse, or is outside the subset. */
export function parseRule(text: string): Expr {
  return new Parser(lex(text)).parseRule();
}
