/**
 * The generated file of a manifest, `domain.generated.ts`: a TypeScript type and a check for each
 * definition, and the harness of the operations. It has no import: the helpers of runtime.ts are
 * copied into it.
 */
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

/** The helpers of runtime.ts, with no `export`. */
function runtimeSource(): string {
  const text = readFileSync(new URL('./runtime.ts', import.meta.url), 'utf8');
  return text.replace(/^\/\*\*[\s\S]*?\*\/\n\n/, '').replace(/^export /gm, '');
}

/** The code of one use of a rule on `value` at `path`, which pushes a failure when it breaks. */
function ruleCode(application: Application, definition: string, indent: string): string {
  const args = application.arguments;
  const names: Record<string, string> = { self: 'value' };
  for (const [parameter, argument] of Object.entries(args)) names[parameter] = JSON.stringify(argument);
  const check = emitRule(application.rule.expr, application.types, names);
  const message = fillMessage(application.rule.message, args);
  return [
    `${indent}if (!$holds(() => ${check})) {`,
    `${indent}  failures.push({ definition: ${JSON.stringify(definition)}, rule: ${JSON.stringify(application.rule.name)}, path, message: ${JSON.stringify(message)} });`,
    `${indent}  ok = false;`,
    `${indent}}`,
  ].join('\n');
}

const STRUCTURE: Readonly<Record<string, { readonly test: string; readonly message: string }>> = {
  string: { test: "typeof value === 'string'", message: 'Must be a string' },
  integer: { test: 'Number.isSafeInteger(value)', message: 'Must be an integer' },
  number: { test: "typeof value === 'number' && Number.isFinite(value)", message: 'Must be a number' },
  boolean: { test: "typeof value === 'boolean'", message: 'Must be true or false' },
  array: { test: 'Array.isArray(value)', message: 'Must be a list' },
  object: { test: '$isObject(value)', message: 'Must be an object' },
};

/** The check of each definition: its structure, then its rules. */
export function checkFunctions(model: Model, applications: readonly Application[]): string {
  const byDefinition = new Map<string, Application[]>();
  for (const application of applications) {
    if (application.place.kind !== 'definition') continue;
    const list = byDefinition.get(application.place.definition) ?? [];
    list.push(application);
    byDefinition.set(application.place.definition, list);
  }
  const lines: string[] = [];
  for (const definition of Object.values(model.definitions)) {
    const own = byDefinition.get(definition.name) ?? [];
    const name = JSON.stringify(definition.name);
    lines.push(`function check_${definition.name}(value: unknown, path: string, failures: Failure[]): boolean {`);
    if (definition.root !== definition.name) {
      // A definition whose type names another definition: that definition's check, then its own rules.
      lines.push(`  if (!check_${definition.root}(value, path, failures)) return false;`);
    } else {
      const structure = STRUCTURE[definition.base]!;
      lines.push(`  if (!(${structure.test})) {`);
      lines.push(`    failures.push({ definition: ${name}, rule: 'type', path, message: ${JSON.stringify(structure.message)} });`);
      lines.push('    return false;');
      lines.push('  }');
      if (definition.base === 'array') {
        lines.push('  let items = true;');
        lines.push(`  (value as unknown[]).forEach((item, index) => {`);
        lines.push(`    if (!check_${definition.items}(item, $item(path, index), failures)) items = false;`);
        lines.push('  });');
        lines.push('  if (!items) return false;');
      }
      if (definition.base === 'object') {
        const properties = definition.properties ?? [];
        lines.push(`  const object = value as Record<string, unknown>;`);
        lines.push('  let properties = true;');
        lines.push('  for (const key of Object.keys(object)) {');
        lines.push(`    if (object[key] === undefined) continue;`);
        lines.push(`    switch (key) {`);
        for (const property of properties) {
          lines.push(`      case ${JSON.stringify(property)}:`);
          lines.push(`        if (!check_${property}(object[key], $at(path, key), failures)) properties = false;`);
          lines.push('        break;');
        }
        lines.push('      default:');
        lines.push(
          `        failures.push({ definition: ${name}, rule: 'properties', path: $at(path, key), message: ${JSON.stringify(`Must be one of the properties of ${definition.name}: ${properties.join(', ')}`)} });`,
        );
        lines.push('        properties = false;');
        lines.push('    }');
        lines.push('  }');
        lines.push('  if (!properties) return false;');
      }
    }
    if (own.length > 0) {
      lines.push('  let ok = true;');
      // `required` first: the other rules of an object read its required properties.
      const required = own.filter((a) => a.rule.name === 'required' && a.owner !== model);
      const others = own.filter((a) => !required.includes(a));
      for (const application of required) lines.push(ruleCode(application, definition.name, '  '));
      if (required.length > 0 && others.length > 0) lines.push('  if (!ok) return false;');
      for (const application of others) lines.push(ruleCode(application, definition.name, '  '));
      lines.push('  return ok;');
    } else {
      lines.push('  return true;');
    }
    lines.push('}', '');
  }
  return lines.join('\n');
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
    return `  ${definition.name}: { ${parts.join(', ')} },`;
  });
  return ['/** Each definition: its base type, the parts of a list or an object, and the names of its own rules. */', 'export const Definitions = {', ...entries, '} as const;', ''].join(
    '\n',
  );
}

export interface GeneratedFile {
  readonly path: string;
  readonly content: string;
}

/** The checks of a model as JavaScript, for the compiler: a check of each definition, by name. */
export function checksModule(model: Model, applications: readonly Application[]): string {
  const checks = `return { ${Object.keys(model.definitions).map((d) => `${d}: check_${d}`).join(', ')} };`;
  return ['(() => {', runtimeSource(), checkFunctions(model, applications), checks, '})()'].join('\n');
}

/** The header of a generated file. */
export function header(source: string, fingerprint: string): string {
  return [
    `// Generated by urn-forge from ${source}. Do not edit: change the manifest, then run urn-forge compile.`,
    `// fingerprint ${fingerprint}`,
    '/* eslint-disable */',
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
    `export type CheckResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly failures: readonly Failure[] };`,
    '',
    `/** The types of the definitions, by name. */`,
    `export interface DefinitionTypes {`,
    ...names.map((d) => `  readonly ${d}: ${typeName(d)};`),
    '}',
    '',
    `/** Checks a value against a definition: its structure, then each rule. */`,
    `export function check<D extends DefinitionName>(definition: D, value: unknown): CheckResult<DefinitionTypes[D]> {`,
    `  const failures: Failure[] = [];`,
    `  return CHECKS[definition](value, '', failures) ? { ok: true, value: value as DefinitionTypes[D] } : { ok: false, failures };`,
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
  const message = fillMessage(application.rule.message, application.arguments);
  return [
    `${indent}if (!$holds(() => ${check})) {`,
    `${indent}  failures.push({ definition: ${JSON.stringify(operation)}, rule: ${JSON.stringify(application.rule.name)}, path: '', message: ${JSON.stringify(message)} });`,
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
  lines.push(`/** Each operation: its input, and its outputs. */`, `export const Operations = {`);
  for (const operation of operations) {
    lines.push(`  ${operation.name}: { input: ${JSON.stringify(operation.input)}, outputs: ${JSON.stringify(operation.outputs.map((o) => o.object))} },`);
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
    `  | ({ readonly ok: true; readonly operation: N } & ReturnType<DomainCore[N]>)`,
    `  | { readonly ok: false; readonly operation: N; readonly kind: 'InputRejected' | 'ContractViolation'; readonly failures: readonly Failure[] };`,
    '',
    `/** Runs an operation through the harness: checks the input, calls the core, then checks the answer and the rules. */`,
    `export function runOperation<N extends OperationName>(core: DomainCore, operation: N, input: unknown): OperationResult<N> {`,
    `  const contract = Operations[operation];`,
    `  const failures: Failure[] = [];`,
    `  if (!CHECKS[contract.input](input, '', failures)) return { ok: false, operation, kind: 'InputRejected', failures };`,
    `  const answered: unknown = (core[operation] as (input: unknown) => unknown)(input);`,
    `  const outputs: readonly string[] = contract.outputs;`,
    `  if (!$isObject(answered) || typeof answered['output'] !== 'string' || !outputs.includes(answered['output'])) {`,
    `    const message = \`Must answer one of the outputs of \${operation}: \${outputs.join(', ')}\`;`,
    `    return { ok: false, operation, kind: 'ContractViolation', failures: [{ definition: operation, rule: 'output', path: '', message }] };`,
    `  }`,
    `  const output = answered['output'] as DefinitionName;`,
    `  if (!CHECKS[output](answered['value'], 'output', failures) || !OPERATION_RULES[operation](input, output, answered['value'], failures)) {`,
    `    return { ok: false, operation, kind: 'ContractViolation', failures };`,
    `  }`,
    `  return { ok: true, operation, output, value: answered['value'] } as OperationResult<N>;`,
    `}`,
    '',
  );
  return lines.join('\n');
}

/** The generated file of a model. */
export function generatedFile(model: Model, applications: readonly Application[], source: string, fingerprint: (body: string) => string): string {
  const body = [runtimeSource(), definitionsCode(model, applications), operationsCode(model, applications)].join('\n');
  return header(source, fingerprint(body)) + body;
}
