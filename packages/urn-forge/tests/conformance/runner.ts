/**
 * The conformance tests of cel-spec, run with urn-forge's own parser, type checker and generated code.
 * Each test is in scope, or out of scope for a reason: a type or a feature that a manifest does not
 * have. A test in scope passes or fails; a failure is a gap of the rule language.
 */
import { readdirSync, readFileSync } from 'node:fs';
import ts from 'typescript';
import { checkRule, type CelType } from '../../src/cel/check.js';
import { parseRule } from '../../src/cel/parse.js';
import { runtimeSource } from '../../src/generate/code.js';
import { emitRule } from '../../src/generate/emit-cel.js';
import { first, isMessage, messages, parseTextproto, text, type Message } from './textproto.js';

/** The reasons for a test to be out of scope. Each is a type or a feature that a manifest does not have. */
export const REASONS = {
  bytes: 'bytes',
  uint: 'unsigned integers',
  map: 'maps',
  null: 'null',
  optional: 'optional values',
  proto: 'protocol buffers',
  type: 'type values',
  dyn: 'needs dynamic types',
  int: 'an int outside ±2^53',
  nanos: 'nanoseconds',
} as const;
export type Reason = keyof typeof REASONS;

export type Outcome =
  | { readonly id: string; readonly result: 'out'; readonly reason: Reason }
  | { readonly id: string; readonly result: 'pass' }
  | { readonly id: string; readonly result: 'fail'; readonly why: string };

const MAX = Number.MAX_SAFE_INTEGER;

/** A value of the test: its type and its JavaScript value, or the reason it is out of scope. */
type Expected = { readonly type: CelType; readonly value: unknown } | { readonly out: Reason };

const WELL_KNOWN_DURATION = '[type.googleapis.com/google.protobuf.Duration]';
const WELL_KNOWN_TIMESTAMP = '[type.googleapis.com/google.protobuf.Timestamp]';

function number(word: string): number {
  if (word === 'inf' || word === 'infinity') return Infinity;
  if (word === '-inf' || word === '-infinity') return -Infinity;
  if (word === 'nan') return NaN;
  return Number(word);
}

/** A cel.expr.Value as a type and a value. */
function expected(value: Message): Expected {
  const [kind, fields] = [...value.entries()][0] ?? [];
  const field = fields?.[0];
  const scalar = field !== undefined && !isMessage(field) ? (field.kind === 'string' ? field.value : field.text) : undefined;
  switch (kind) {
    case 'bool_value':
      return { type: { kind: 'bool' }, value: scalar === 'true' };
    case 'string_value':
      return { type: { kind: 'string' }, value: scalar };
    case 'int64_value': {
      const n = Number(scalar);
      return Math.abs(n) > MAX ? { out: 'int' } : { type: { kind: 'int' }, value: n };
    }
    case 'double_value':
      return { type: { kind: 'double' }, value: number(scalar!) };
    case 'list_value': {
      const items = messages(field as Message, 'values').map(expected);
      const out = items.find((i) => 'out' in i);
      if (out) return out;
      const typed = items as { type: CelType; value: unknown }[];
      return { type: { kind: 'list', of: typed[0]?.type ?? { kind: 'int' } }, value: typed.map((i) => i.value) };
    }
    case 'object_value': {
      const object = field as Message;
      const time = (first(object, WELL_KNOWN_DURATION) ?? first(object, WELL_KNOWN_TIMESTAMP)) as Message | undefined;
      if (!time) return { out: 'proto' };
      const seconds = Number(text(time, 'seconds') ?? '0');
      const nanos = Number(text(time, 'nanos') ?? '0');
      if (nanos % 1_000_000 !== 0) return { out: 'nanos' };
      return { type: { kind: object.has(WELL_KNOWN_DURATION) ? 'duration' : 'timestamp' }, value: seconds * 1000 + nanos / 1_000_000 };
    }
    case 'bytes_value':
      return { out: 'bytes' };
    case 'uint64_value':
      return { out: 'uint' };
    case 'map_value':
      return { out: 'map' };
    case 'null_value':
      return { out: 'null' };
    case 'type_value':
      return { out: 'type' };
    default:
      return { out: 'proto' };
  }
}

/** A declared type of type_env. */
function declared(type: Message): CelType | Reason {
  const primitive = text(type, 'primitive');
  if (primitive !== undefined) {
    const kinds: Record<string, CelType | Reason> = { INT64: { kind: 'int' }, DOUBLE: { kind: 'double' }, STRING: { kind: 'string' }, BOOL: { kind: 'bool' }, UINT64: 'uint', BYTES: 'bytes' };
    return kinds[primitive] ?? 'proto';
  }
  const wellKnown = text(type, 'well_known');
  if (wellKnown === 'DURATION') return { kind: 'duration' };
  if (wellKnown === 'TIMESTAMP') return { kind: 'timestamp' };
  const list = first(type, 'list_type');
  if (isMessage(list)) {
    const of = declared(first(list, 'elem_type') as Message);
    return typeof of === 'string' ? of : { kind: 'list', of };
  }
  if (type.has('map_type')) return 'map';
  if (type.has('null')) return 'null';
  if (type.has('dyn')) return 'dyn';
  return 'proto';
}

/** The expression with the content of each string literal removed, so that a search sees only the code. */
function code(expr: string): string {
  return expr.replace(/(r|R)?('''[\s\S]*?'''|"""[\s\S]*?"""|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/g, (_, raw: string | undefined) => `${raw ?? ''}S`);
}

/** The reason of an expression to be out of scope, from its code. */
function reasonOfExpr(expr: string): Reason | undefined {
  const c = code(expr);
  if (/\bb(?=S)|\bB(?=S)|\bbytes\(/.test(c)) return 'bytes';
  if (/\b\d+[uU]\b|\b0x[0-9a-fA-F]+[uU]\b|\buint\(/.test(c)) return 'uint';
  if (/\bnull\b/.test(c)) return 'null';
  if (/\boptional\b|\.\?|\[\?|\.(hasValue|orValue|optMap|optFlatMap|value)\(/.test(c)) return 'optional';
  if (/google\.protobuf|TestAllTypes|\bproto\.|\bcel\.expr\b/.test(c)) return 'proto';
  if (/\btype\(|\bdyn\(|\b(int|uint|double|string|bool|bytes|list|map|null_type|type)\b(?!\s*\()/.test(c)) return 'type';
  if (/\{/.test(c)) return 'map';
  for (const literal of c.match(/\b\d+\b/g) ?? []) if (Number(literal) > MAX) return 'int';
  return undefined;
}

/** The TypeScript of the runtime helpers, compiled once. */
let runtime: string | undefined;
function runtimeJs(): string {
  runtime ??= ts
    .transpileModule(runtimeSource(), { compilerOptions: { target: ts.ScriptTarget.ES2022 } })
    .outputText.replace(/^export \{\};?$/gm, '')
    .replace(/^export /gm, '');
  return runtime;
}

function same(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return (Number.isNaN(a) && Number.isNaN(b)) || a === b;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
  return a === b;
}

function sameType(a: CelType, b: CelType): boolean {
  if (a.kind === 'any' || b.kind === 'any') return true;
  if (a.kind !== b.kind) return false;
  return a.kind === 'list' ? sameType(a.of, (b as typeof a).of) : true;
}

const OUT_DYN = 'out: needs dynamic types';

/** Runs one test that is in scope. */
function run(test: Message, names: Record<string, CelType>, bindings: Record<string, unknown>, want: Expected | 'error'): string | undefined {
  const expr = text(test, 'expr')!;
  let parsed;
  try {
    parsed = parseRule(expr);
  } catch (error) {
    return `does not parse: ${(error as Error).message}`;
  }
  const { type, problems, types } = checkRule(parsed, { names, properties: () => undefined });
  // A list of items of more than one type needs dynamic types (decision 7 of the plan).
  if (problems.length > 0 && problems.some((p) => p.message.includes('must have one type'))) return OUT_DYN;
  if (problems.length > 0) {
    // A rule that the checker refuses at compile time cannot give a wrong value: an error is what CEL wants.
    if (want === 'error' && problems.every((p) => p.code === 'rule-type')) return undefined;
    return `does not check: ${problems.map((p) => `${p.code}: ${p.message}`).join('; ')}`;
  }
  const emitted = emitRule(parsed, types, Object.fromEntries(Object.keys(names).map((n) => [n, `$b[${JSON.stringify(n)}]`])));
  let result: unknown;
  try {
    const body = ts.transpileModule(`const $result = (${emitted});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    // The helpers of the generated file, then the expression: v is Valibot, which no rule uses.
    result = new Function('v', '$b', `${runtimeJs()}\n${body}\nreturn $result;`)(undefined, bindings);
  } catch (error) {
    if (want === 'error') return undefined;
    return `gives an error: ${(error as Error).message}`;
  }
  if (want === 'error') return `gives ${JSON.stringify(result)}, not an error`;
  if ('out' in want) throw new Error('a test out of scope was run');
  if (!sameType(type!, want.type)) return `gives the type ${type!.kind}, not ${want.type.kind}`;
  if (!same(result, want.value)) return `gives ${JSON.stringify(result)}, not ${JSON.stringify(want.value)}`;
  return undefined;
}

/** The outcome of each test of a file of cel-spec. */
export function runFile(path: string): Outcome[] {
  const file = parseTextproto(readFileSync(path, 'utf8'));
  const fileName = text(file, 'name')!;
  const outcomes: Outcome[] = [];
  for (const section of messages(file, 'section')) {
    for (const test of messages(section, 'test')) {
      const id = `${fileName}/${text(section, 'name')}/${text(test, 'name')}`;
      const out = (reason: Reason): void => void outcomes.push({ id, result: 'out', reason });
      const expr = text(test, 'expr')!;
      if (text(test, 'disable_check') === 'true') {
        out('dyn');
        continue;
      }
      if (test.has('container')) {
        out('proto');
        continue;
      }
      const reason = reasonOfExpr(expr);
      if (reason) {
        out(reason);
        continue;
      }
      const names: Record<string, CelType> = {};
      let skipped: Reason | undefined;
      for (const decl of messages(test, 'type_env')) {
        const ident = first(decl, 'ident');
        const type = isMessage(ident) ? declared(first(ident, 'type') as Message) : 'proto';
        if (typeof type === 'string') skipped ??= type;
        else names[text(decl, 'name')!] = type;
      }
      const bindings: Record<string, unknown> = {};
      for (const binding of messages(test, 'bindings')) {
        const value = expected(first(first(binding, 'value') as Message, 'value') as Message);
        if ('out' in value) skipped ??= value.out;
        else bindings[text(binding, 'key')!] = value.value;
      }
      let want: Expected | 'error';
      if (test.has('eval_error')) want = 'error';
      else if (test.has('value')) want = expected(first(test, 'value') as Message);
      else want = { type: { kind: 'bool' }, value: true };
      if (want !== 'error' && 'out' in want) skipped ??= want.out;
      if (skipped) {
        out(skipped);
        continue;
      }
      const why = run(test, names, bindings, want);
      if (why === OUT_DYN) {
        out('dyn');
        continue;
      }
      outcomes.push(why === undefined ? { id, result: 'pass' } : { id, result: 'fail', why });
    }
  }
  return outcomes;
}

/** The files in scope, as decision 2 of the plan lists them. */
export const FILES = [
  'basic',
  'comparisons',
  'conversions',
  'fp_math',
  'integer_math',
  'logic',
  'string',
  'lists',
  'macros',
  'macros2',
  'string_ext',
  'math_ext',
  'lists_ext',
  'timestamps',
  'bindings_ext',
] as const;

export const TESTDATA = new URL('./testdata/', import.meta.url);

/** The outcome of each test of each file in scope. */
export function runAll(): Outcome[] {
  const present = new Set(readdirSync(TESTDATA));
  return FILES.flatMap((file) => (present.has(`${file}.textproto`) ? runFile(new URL(`${file}.textproto`, TESTDATA).pathname) : []));
}
