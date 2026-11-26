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
 *   `s.contains(t)`, `l.sum()`;
 * - the macros `l.all(x, p)`, `l.exists(x, p)`, `l.exists_one(x, p)`, `l.map(x, e)` and `l.filter(x, p)`.
 */

export type BinaryOp = '||' | '&&' | '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | '+' | '-' | '*' | '/' | '%';
export type MacroName = 'all' | 'exists' | 'exists_one' | 'map' | 'filter';
export type FunctionName =
  | 'has'
  | 'size'
  | 'timestamp'
  | 'duration'
  | 'int'
  | 'double'
  | 'string'
  | 'matches'
  | 'startsWith'
  | 'endsWith'
  | 'contains'
  | 'sum';

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
const ESCAPES: Readonly<Record<string, string>> = { '\\': '\\', "'": "'", '"': '"', n: '\n', t: '\t', r: '\r' };

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
      const quote = raw ? text[i + 1]! : c;
      if (text.startsWith(quote.repeat(3), raw ? i + 1 : i)) throw new CelSyntaxError('a string in triple quotes is not in the subset', at);
      i += raw ? 2 : 1;
      let value = '';
      for (;;) {
        if (i >= text.length || text[i] === '\n') throw new CelSyntaxError('a string has no closing quote', at);
        const d = text[i]!;
        if (d === quote) {
          i++;
          break;
        }
        if (d === '\\' && !raw) {
          const e = text[i + 1];
          if (e === undefined || !Object.hasOwn(ESCAPES, e)) throw new CelSyntaxError(`the escape \\${e ?? ''} is not in the subset; the escapes are \\\\ \\' \\" \\n \\t \\r`, i);
          value += ESCAPES[e];
          i += 2;
          continue;
        }
        value += d;
        i++;
      }
      tokens.push({ kind: 'string', value, at });
      continue;
    }
    if (/[0-9]/.test(c)) {
      const match = /^[0-9]+(\.[0-9]+([eE][+-]?[0-9]+)?|[eE][+-]?[0-9]+)?/.exec(text.slice(i))!;
      const literal = match[0];
      if (/^0[0-9]/.test(literal) && match[1] === undefined) throw new CelSyntaxError(`the integer ${literal} starts with 0`, at);
      if (/^[uUxX]/.test(text.slice(i + literal.length))) throw new CelSyntaxError('unsigned and hexadecimal numbers are not in the subset', at);
      if (match[1] === undefined) {
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
/** The methods of the subset, and the number of the arguments of each. */
const METHODS: Readonly<Record<string, number>> = { size: 0, sum: 0, matches: 1, startsWith: 1, endsWith: 1, contains: 1 };
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
      if (!Object.hasOwn(METHODS, token.text)) throw new CelSyntaxError(`the method ${token.text}() is not in the subset`, token.at);
      const count = METHODS[token.text]!;
      if (args.length !== count) throw new CelSyntaxError(`${token.text}() takes ${count === 0 ? 'no argument' : 'one argument'}`, token.at);
      expr = { kind: 'call', fn: token.text as FunctionName, target: expr, args, at: token.at };
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
        case 'size':
        case 'timestamp':
        case 'duration':
        case 'int':
        case 'double':
        case 'string':
          if (args.length !== 1) throw new CelSyntaxError(`${token.text}() takes one argument`, at);
          return { kind: 'call', fn: token.text, args, at };
        default:
          throw new CelSyntaxError(`the function ${token.text}() is not in the subset`, at);
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
