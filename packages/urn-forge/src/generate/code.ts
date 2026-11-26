/**
 * The generated file of a manifest, `domain.generated.ts`: a TypeScript type and a check for each
 * definition, and the harness of the operations. It has no import: the helpers of runtime.ts are
 * copied into it.
 */
import { domainUrn, partUrn } from '../urn.js';
import { readFileSync } from 'node:fs';
import type { Model } from '../model.js';
import type { Application } from '../rules.js';
import { emitRule } from './emit-cel.js';

/** `seat_booking` → `SeatBooking`. */
export function pascal(name: string): string {
  return name
    .split('_')
    .filter((part) => part !== '')
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
}

/** The names that the generated file declares itself; a definition with one of them gets `Value` after its name. */
const RESERVED = new Set(['Failure', 'RuleError', 'DomainCore', 'Operations', 'Definitions', 'OperationName', 'DefinitionName', 'OperationResult', 'CheckResult']);

export function typeName(definition: string): string {
  const name = pascal(definition);
  return RESERVED.has(name) ? `${name}Value` : name;
}

/** The text of a parameter's value in a message: a list is its items, joined. */
function showArgument(value: unknown): string {
  if (Array.isArray(value)) return value.map(showArgument).join(', ');
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/** A rule's message, with the arguments of a use in place of `{parameter}`. */
export function fillMessage(message: string, args: Readonly<Record<string, unknown>>): string {
  return message.replace(/\{([^{}]*)\}/g, (whole, name: string) => (Object.hasOwn(args, name) ? showArgument(args[name]) : whole));
}

/** The declarations of runtime.ts, each with its comment and its name. */
function runtimeDeclarations(): { readonly name: string; readonly text: string }[] {
  const text = readFileSync(new URL('./runtime.ts', import.meta.url), 'utf8')
    .replace(/^\/\*\*[\s\S]*?\*\/\n/, '')
    .replace(/^import \* as v from 'valibot';\n\n?/m, '');
  const chunks: string[][] = [];
  let inComment = false;
  let afterComment = false;
  for (const line of text.split('\n')) {
    const startsComment = line.startsWith('/**');
    const startsDeclaration = /^(export |const |function |class |interface |type )/.test(line);
    if ((startsComment || (startsDeclaration && !afterComment)) && chunks.length > 0 && !inComment) chunks.push([]);
    if (chunks.length === 0) chunks.push([]);
    chunks.at(-1)!.push(line);
    if (startsComment) inComment = true;
    afterComment = inComment && line.includes('*/');
    if (afterComment) inComment = false;
  }
  return chunks.map((lines) => {
    const body = lines.join('\n').replace(/\n+$/, '');
    const name = /^(?:export )?(?:function|class|const|interface|type)\s+([$\w]+)/m.exec(body)?.[1] ?? '';
    return { name, text: body };
  });
}

/** Whether a text refers to a name: a whole identifier, where `$` is part of a name. */
function refersTo(text: string, name: string): boolean {
  return new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(text);
}

/**
 * The helpers of runtime.ts that `uses` refers to, and the helpers that they refer to, with no
 * `export`. With no `uses`, each helper. Failure is the type of a check's result: it stays exported.
 */
function runtimeSource(uses?: string): string {
  const declarations = runtimeDeclarations();
  let kept = declarations;
  if (uses !== undefined) {
    const keep = new Set<string>();
    const queue = [uses];
    while (queue.length > 0) {
      const text = queue.pop()!;
      for (const d of declarations) {
        if (d.name === '' || keep.has(d.name) || !refersTo(text, d.name)) continue;
        keep.add(d.name);
        queue.push(d.text);
      }
    }
    kept = declarations.filter((d) => keep.has(d.name));
  }
  return `${kept.map((d) => d.text.replace(/^export (?!interface Failure)/gm, '')).join('\n\n')}\n`;
}

/** The action of one use of a rule in the pipe of a schema. */
function ruleAction(application: Application, definition: string): string {
  const args = application.arguments;
  const names: Record<string, string> = { self: 'value' };
  for (const [parameter, argument] of Object.entries(args)) names[parameter] = JSON.stringify(argument);
  const test = emitRule(application.rule.expr, application.types, names);
  const message = fillMessage(application.rule.failureMessage, args);
  return `$rule(${JSON.stringify(definition)}, ${JSON.stringify(application.rule.name)}, ${JSON.stringify(message)}, (value: any) => ${test})`;
}

/** The name of a definition's schema: `party_size` → `PartySizeSchema`. */
export function schemaName(definition: string): string {
  return `${pascal(definition)}Schema`;
}

/** The base schema of each type, with the message of a value of the wrong type. */
const BASE: Readonly<Record<string, string>> = {
  string: "v.string('Must be a string')",
  integer: "v.pipe(v.number('Must be an integer'), v.integer('Must be an integer'))",
  number: "v.pipe(v.number('Must be a number'), v.finite('Must be a number'))",
  boolean: "v.boolean('Must be true or false')",
};

/**
 * A Valibot schema for each definition, `<Name>Schema`: its structure, then its rules in a pipe. The
 * schemas come in the order of their uses; a schema that a cycle reaches again is v.lazy.
 */
export function schemasCode(model: Model, applications: readonly Application[]): string {
  const rulesOf = new Map<string, Application[]>();
  for (const application of applications) {
    if (application.place.kind !== 'definition') continue;
    const list = rulesOf.get(application.place.definition) ?? [];
    list.push(application);
    rulesOf.set(application.place.definition, list);
  }
  const lines: string[] = [];
  const done = new Set<string>();
  const active = new Set<string>();
  const ref = (name: string): string => (done.has(name) ? schemaName(name) : `v.lazy(() => ${schemaName(name)})`);
  const emit = (name: string): void => {
    if (done.has(name) || active.has(name)) return;
    active.add(name);
    const definition = model.definitions[name]!;
    let structure: string;
    if (definition.root !== name) {
      emit(definition.type);
      structure = ref(definition.type);
    } else if (definition.base === 'array') {
      emit(definition.items!);
      structure = `v.array(${ref(definition.items!)}, 'Must be a list')`;
    } else if (definition.base === 'object') {
      const required = new Set<string>();
      for (const a of rulesOf.get(name) ?? []) {
        if (a.rule.name === 'required' && a.owner !== model) for (const p of a.arguments['property_names'] as string[]) required.add(p);
      }
      for (const property of definition.properties ?? []) emit(property);
      const entries = (definition.properties ?? []).map((p) => `${p}: ${required.has(p) ? ref(p) : `v.optional(${ref(p)})`}`);
      structure = `v.strictObject({ ${entries.join(', ')} }, 'Must be an object')`;
    } else {
      structure = BASE[definition.base]!;
    }
    // required is the structure of the object; the other rules run in the pipe.
    const rules = (rulesOf.get(name) ?? []).filter((a) => !(a.rule.name === 'required' && a.owner !== model)).map((a) => ruleAction(a, name));
    const value = rules.length > 0 ? `v.pipe(${[structure, ...rules].join(',\n  ')})` : structure;
    lines.push(`/** ${definition.description}${definition.deprecated ? ' @deprecated' : ''} */`, `export const ${schemaName(name)} = ${value};`, '');
    active.delete(name);
    done.add(name);
  };
  for (const name of Object.keys(model.definitions)) emit(name);
  return lines.join('\n');
}

/** The message of the required rule of each object: what a missing property gives. */
function requiredMessages(model: Model, applications: readonly Application[]): Record<string, string> {
  const messages: Record<string, string> = {};
  for (const a of applications) {
    if (a.place.kind === 'definition' && a.rule.name === 'required' && a.owner !== model) messages[a.place.definition] = fillMessage(a.rule.failureMessage, a.arguments);
  }
  return messages;
}

/** The check of each definition, with its schema: `check_<name>(value, path, failures)`. */
export function checkFunctions(model: Model, applications: readonly Application[]): string {
  const shapes = Object.fromEntries(
    Object.values(model.definitions).map((d) => {
      const root = model.definitions[d.root]!;
      return [d.name, { base: d.base, root: d.root, ...(root.items ? { items: root.items } : {}), ...(root.properties ? { properties: root.properties } : {}) }];
    }),
  );
  return [
    schemasCode(model, applications),
    `const SHAPES: Readonly<Record<string, Shape>> = ${JSON.stringify(shapes)};`,
    '',
    `const REQUIRED: Readonly<Record<string, string>> = ${JSON.stringify(requiredMessages(model, applications))};`,
    '',
    ...Object.keys(model.definitions).map(
      (d) => `function check_${d}(value: unknown, path: string, failures: Failure[]): boolean {\n  return $validate(${schemaName(d)}, ${JSON.stringify(d)}, value, path, failures, SHAPES, REQUIRED);\n}\n`,
    ),
  ].join('\n');
}

/** The TypeScript type of each definition. */
function types(model: Model, applications: readonly Application[]): string {
  const lines: string[] = [];
  const enumOf = new Map<string, readonly string[]>();
  for (const application of applications) {
    if (application.place.kind === 'definition' && application.rule.name === 'enum' && application.owner !== model) {
      enumOf.set(application.place.definition, application.arguments['choices'] as string[]);
    }
  }
  for (const definition of Object.values(model.definitions)) {
    const doc = [`/** ${definition.description}${definition.deprecated ? ' @deprecated' : ''} */`];
    const name = typeName(definition.name);
    if (definition.root !== definition.name) {
      lines.push(...doc, `export type ${name} = ${typeName(definition.root)};`, '');
      continue;
    }
    switch (definition.base) {
      case 'string': {
        const choices = enumOf.get(definition.name);
        lines.push(...doc, `export type ${name} = ${choices ? choices.map((c) => JSON.stringify(c)).join(' | ') : 'string'};`, '');
        break;
      }
      case 'integer':
      case 'number':
        lines.push(...doc, `export type ${name} = number;`, '');
        break;
      case 'boolean':
        lines.push(...doc, `export type ${name} = boolean;`, '');
        break;
      case 'array':
        lines.push(...doc, `export type ${name} = readonly ${typeName(definition.items!)}[];`, '');
        break;
      case 'object': {
        const required = new Set<string>();
        for (const application of applications) {
          if (application.place.kind === 'definition' && application.place.definition === definition.name && application.rule.name === 'required' && application.owner !== model) {
            for (const property of application.arguments['property_names'] as string[]) required.add(property);
          }
        }
        lines.push(...doc, `export interface ${name} {`);
        for (const property of definition.properties ?? []) {
          const target = model.definitions[property]!;
          lines.push(`  /** ${target.description}${target.deprecated ? ' @deprecated' : ''} */`);
          lines.push(`  readonly ${property}${required.has(property) ? '' : '?'}: ${typeName(property)};`);
        }
        lines.push('}', '');
        break;
      }
    }
  }
  return lines.join('\n');
}

/** The metadata of the definitions, for the Gherkin steps: the base, and the parts of a list or an object. */
function definitionsTable(model: Model, applications: readonly Application[]): string {
  const entries = Object.values(model.definitions).map((definition) => {
    const root = model.definitions[definition.root]!;
    const parts: string[] = [`base: ${JSON.stringify(definition.base)}`];
    if (root.items) parts.push(`items: ${JSON.stringify(root.items)}`);
    if (root.properties) parts.push(`properties: ${JSON.stringify(root.properties)}`);
    const rules = applications.filter((a) => a.place.kind === 'definition' && a.place.definition === definition.name).map((a) => a.rule.name);
    parts.push(`rules: ${JSON.stringify(rules)}`);
    return `  ${definition.name}: { urn: ${JSON.stringify(partUrn(model.header, 'definition', definition.name))}, ${parts.join(', ')} },`;
  });
  return [
    `/** The URN of this domain. Each result of check and runOperation names it. */`,
    `export const DOMAIN = ${JSON.stringify(domainUrn(model.header))};`,
    '',
    '/** Each definition: its URN, its base type, the parts of a list or an object, and the names of its own rules. */',
    'export const Definitions = {',
    ...entries,
    '} as const;',
    '',
  ].join('\n');
}

export interface GeneratedFile {
  readonly path: string;
  readonly content: string;
}

/** The checks of a model as JavaScript, for the compiler: a check of each definition, by name. */
export function checksModule(model: Model, applications: readonly Application[]): string {
  const checks = `return { ${Object.keys(model.definitions).map((d) => `${d}: check_${d}`).join(', ')} };`;
  // Inside a function, a schema is not exported.
  const functions = checkFunctions(model, applications).replace(/^export /gm, '');
  return ['((v) => {', runtimeSource(functions), functions, checks, '})'].join('\n');
}

/** The header of a generated file: its manifest, with the URN of the domain. */
export function header(source: string, fingerprint: string, urn: string): string {
  return [
    `// Generated by urn-forge from ${source} (${urn}). Do not edit: change the manifest, then run urn-forge compile.`,
    `// fingerprint ${fingerprint}`,
    '/* eslint-disable */',
    "import * as v from 'valibot';",
    '',
  ].join('\n');
}

/** The part of the generated file for the definitions: types, checks, and `check`. */
export function definitionsCode(model: Model, applications: readonly Application[]): string {
  const names = Object.keys(model.definitions);
  return [
    types(model, applications),
    checkFunctions(model, applications),
    definitionsTable(model, applications),
    `/** The name of a definition. */`,
    `export type DefinitionName = keyof typeof Definitions;`,
    '',
    `const CHECKS: Readonly<Record<DefinitionName, (value: unknown, path: string, failures: Failure[]) => boolean>> = {`,
    ...names.map((d) => `  ${d}: check_${d},`),
    '};',
    '',
    `/** The result of a check: the value, or the rules it breaks. */`,
    `export type CheckResult<T> = { readonly ok: true; readonly domain: typeof DOMAIN; readonly value: T } | { readonly ok: false; readonly domain: typeof DOMAIN; readonly failures: readonly Failure[] };`,
    '',
    `/** The types of the definitions, by name. */`,
    `export interface DefinitionTypes {`,
    ...names.map((d) => `  readonly ${d}: ${typeName(d)};`),
    '}',
    '',
    `/** Checks a value against a definition: its structure, then each rule. */`,
    `export function check<D extends DefinitionName>(definition: D, value: unknown): CheckResult<DefinitionTypes[D]> {`,
    `  const failures: Failure[] = [];`,
    `  return CHECKS[definition](value, '', failures) ? { ok: true, domain: DOMAIN, value: value as DefinitionTypes[D] } : { ok: false, domain: DOMAIN, failures };`,
    `}`,
    '',
  ].join('\n');
}

export { runtimeSource };

/** The code of one use of a rule of an operation or an output, on its input and its output. */
function operationRuleCode(application: Application, operation: string, indent: string): string {
  const names: Record<string, string> = { input: 'input', output: 'value' };
  for (const [parameter, argument] of Object.entries(application.arguments)) names[parameter] = JSON.stringify(argument);
  const check = emitRule(application.rule.expr, application.types, names);
  const message = fillMessage(application.rule.failureMessage, application.arguments);
  return [
    `${indent}if (!$holds(() => ${check})) {`,
    `${indent}  failures.push({ definition: ${JSON.stringify(operation)}, rule: ${JSON.stringify(application.rule.name)}, path: '', failure_message: ${JSON.stringify(message)} });`,
    `${indent}  ok = false;`,
    `${indent}}`,
  ].join('\n');
}

/** The part of the generated file for the operations: the core's type, and the harness that checks each call. */
export function operationsCode(model: Model, applications: readonly Application[]): string {
  const operations = Object.values(model.operations);
  const lines: string[] = [
    `/** What an operation answers: one of its outputs, by name, and its value. */`,
    `export interface Answer<O extends string, V> {`,
    `  readonly output: O;`,
    `  readonly value: V;`,
    `}`,
    '',
    `/** An answer of the core: answer('booking', booking). */`,
    `export function answer<O extends string, V>(output: O, value: V): Answer<O, V> {`,
    `  return { output, value };`,
    `}`,
    '',
  ];
  for (const operation of operations) {
    const outputs = operation.outputs.map((o) => `Answer<${JSON.stringify(o.object)}, ${typeName(o.object)}>`);
    lines.push(`/** The answers of ${operation.name}. */`, `export type ${pascal(operation.name)}Answer = ${outputs.join(' | ')};`, '');
  }
  lines.push(`/** The core: a function for each operation, from its input to one of its answers. */`, `export interface DomainCore {`);
  for (const operation of operations) {
    lines.push(`  /** ${operation.description}${operation.deprecated ? ' @deprecated' : ''} */`);
    lines.push(`  readonly ${operation.name}: (input: ${typeName(operation.input)}) => ${pascal(operation.name)}Answer;`);
  }
  lines.push('}', '');
  lines.push(`/** Each operation: its URN, its input, and its outputs. */`, `export const Operations = {`);
  for (const operation of operations) {
    const urn = JSON.stringify(partUrn(model.header, 'operation', operation.name));
    lines.push(`  ${operation.name}: { urn: ${urn}, input: ${JSON.stringify(operation.input)}, outputs: ${JSON.stringify(operation.outputs.map((o) => o.object))} },`);
  }
  lines.push('} as const;', '', `/** The name of an operation. */`, `export type OperationName = keyof typeof Operations;`, '');

  // The rules of each operation: those of the output that came back, then the operation's own.
  lines.push(`const OPERATION_RULES: Readonly<Record<OperationName, (input: any, output: string, value: any, failures: Failure[]) => boolean>> = {`);
  for (const operation of operations) {
    lines.push(`  ${operation.name}: (input, output, value, failures) => {`);
    lines.push('    let ok = true;');
    const byOutput = operation.outputs.map((o) => ({
      object: o.object,
      rules: applications.filter((a) => a.place.kind === 'output' && a.place.operation === operation.name && a.place.object === o.object),
    }));
    if (byOutput.some((o) => o.rules.length > 0)) {
      lines.push('    switch (output) {');
      for (const output of byOutput) {
        if (output.rules.length === 0) continue;
        lines.push(`      case ${JSON.stringify(output.object)}:`);
        for (const application of output.rules) lines.push(operationRuleCode(application, operation.name, '        '));
        lines.push('        break;');
      }
      lines.push('    }');
    }
    for (const application of applications.filter((a) => a.place.kind === 'operation' && a.place.operation === operation.name)) {
      lines.push(operationRuleCode(application, operation.name, '    '));
    }
    lines.push('    return ok;', '  },');
  }
  lines.push('};', '');

  lines.push(
    `/**`,
    ` * The result of a call: the answer, or the rules that the input or the answer breaks. InputRejected:`,
    ` * the caller sent an input that breaks the contract. ContractViolation: the core answered what the`,
    ` * contract does not allow, which is a bug in the core.`,
    ` */`,
    `export type OperationResult<N extends OperationName = OperationName> =`,
    `  | ({ readonly ok: true; readonly domain: typeof DOMAIN; readonly operation: N } & ReturnType<DomainCore[N]>)`,
    `  | { readonly ok: false; readonly domain: typeof DOMAIN; readonly operation: N; readonly kind: 'InputRejected' | 'ContractViolation'; readonly failures: readonly Failure[] };`,
    '',
    `/** Runs an operation through the harness: checks the input, calls the core, then checks the answer and the rules. */`,
    `export function runOperation<N extends OperationName>(core: DomainCore, operation: N, input: unknown): OperationResult<N> {`,
    `  const contract = Operations[operation];`,
    `  const failures: Failure[] = [];`,
    `  if (!CHECKS[contract.input](input, '', failures)) return { ok: false, domain: DOMAIN, operation, kind: 'InputRejected', failures };`,
    `  const answered: unknown = (core[operation] as (input: unknown) => unknown)(input);`,
    `  const outputs: readonly string[] = contract.outputs;`,
    `  if (!$isObject(answered) || typeof answered['output'] !== 'string' || !outputs.includes(answered['output'])) {`,
    `    const message = \`Must answer one of the outputs of \${operation}: \${outputs.join(', ')}\`;`,
    `    return { ok: false, domain: DOMAIN, operation, kind: 'ContractViolation', failures: [{ definition: operation, rule: 'output', path: '', failure_message: message }] };`,
    `  }`,
    `  const output = answered['output'] as DefinitionName;`,
    `  if (!CHECKS[output](answered['value'], 'output', failures) || !OPERATION_RULES[operation](input, output, answered['value'], failures)) {`,
    `    return { ok: false, domain: DOMAIN, operation, kind: 'ContractViolation', failures };`,
    `  }`,
    `  return { ok: true, domain: DOMAIN, operation, output, value: answered['value'] } as OperationResult<N>;`,
    `}`,
    '',
  );
  return lines.join('\n');
}

/** The generated file of a model. */
export function generatedFile(model: Model, applications: readonly Application[], source: string, fingerprint: (body: string) => string): string {
  const code = [definitionsCode(model, applications), operationsCode(model, applications)].join('\n');
  const body = [runtimeSource(code), code].join('\n');
  return header(source, fingerprint(body), domainUrn(model.header)) + body;
}
