/**
 * The model of a manifest: its parts, with the names between them checked. A definition knows its
 * base type (one of JSON Schema's six) and its root: the definition that declares its structure. A
 * definition whose type names another definition has the structure of that definition, and adds rules.
 */
import { CelSyntaxError, parseRule, type Expr } from './cel/parse.js';
import type { Diagnostics } from './diagnostics.js';
import {
  BASE_TYPES,
  type BaseType,
  type DefinitionDecl,
  type ManifestDecl,
  type ManifestHeader,
  type OperationDecl,
  type RuleDecl,
  type RuleUse,
} from './manifest.js';

export interface Definition extends DefinitionDecl {
  /** One of JSON Schema's six types. */
  readonly base: BaseType;
  /** The definition that declares the structure: itself, or the end of the chain of `type` names. */
  readonly root: string;
}

export interface Rule extends RuleDecl {
  /** The parsed rule. */
  readonly expr: Expr;
}

export interface Model {
  readonly header: ManifestHeader;
  readonly definitions: Readonly<Record<string, Definition>>;
  readonly rules: Readonly<Record<string, Rule>>;
  readonly operations: Readonly<Record<string, OperationDecl>>;
}

/** The standard rule that lists the properties an object must have. */
export const REQUIRED = 'required';

function isBase(type: string): type is BaseType {
  return (BASE_TYPES as readonly string[]).includes(type);
}

/** The properties that a `required` use of an object definition names. */
export function requiredOf(definition: Pick<DefinitionDecl, 'rules'>): ReadonlySet<string> {
  const names = new Set<string>();
  for (const use of definition.rules) {
    if (use.rule !== REQUIRED || !use.argument || !Array.isArray(use.argument.value)) continue;
    for (const name of use.argument.value) if (typeof name === 'string') names.add(name);
  }
  return names;
}

/** Checks the names between the parts of a manifest, and gives its model. */
export function buildModel(decl: ManifestDecl, diagnostics: Diagnostics): Model {
  const declared: Record<string, DefinitionDecl> = {};
  for (const definition of decl.definitions) declared[definition.name] = definition;
  const known = (name: string): boolean => Object.hasOwn(declared, name);
  const unknown = (name: string, path: RuleUse['path']): void =>
    diagnostics.error('unknown-definition', path, `${name} is not a definition of this manifest`);

  // The base and the root of each definition: follow the chain of type names, and stop at a cycle.
  const definitions: Record<string, Definition> = {};
  for (const definition of decl.definitions) {
    const chain: string[] = [];
    let current: DefinitionDecl | undefined = definition;
    let resolved: { base: BaseType; root: string } | undefined;
    while (current) {
      if (chain.includes(current.name)) {
        diagnostics.error(
          'type-cycle',
          [...definition.path, 'type'],
          `${definition.name} has a cycle of types: ${[...chain.slice(chain.indexOf(current.name)), current.name].join(' → ')}`,
        );
        break;
      }
      chain.push(current.name);
      if (isBase(current.type)) {
        resolved = { base: current.type, root: current.name };
        break;
      }
      if (!known(current.type)) {
        if (current === definition) unknown(current.type, [...definition.path, 'type']);
        break;
      }
      current = declared[current.type];
    }
    if (resolved) definitions[definition.name] = { ...definition, ...resolved };
  }

  for (const definition of Object.values(definitions)) {
    const seen = new Set<string>();
    definition.properties?.forEach((name, index) => {
      const path = [...definition.path, 'properties', index];
      if (!known(name)) unknown(name, path);
      else if (seen.has(name)) diagnostics.error('duplicate-property', path, `${definition.name} lists ${name} two times`);
      seen.add(name);
    });
    if (definition.items !== undefined && !known(definition.items)) unknown(definition.items, [...definition.path, 'items']);
    for (const name of requiredOf(definition)) {
      if (definition.base === 'object' && !definitions[definition.root]?.properties?.includes(name)) {
        const use = definition.rules.find((u) => u.rule === REQUIRED)!;
        diagnostics.error('unknown-property', [...use.path, REQUIRED], `${name} is not a property of ${definition.name}`);
      }
    }
    if (definition.identifier !== undefined) checkIdentifier(definition, definitions, diagnostics);
  }

  const rules: Record<string, Rule> = {};
  for (const rule of decl.rules) {
    rule.parameters.forEach((name, index) => {
      if (!known(name)) unknown(name, [...rule.path, 'parameters', index]);
    });
    try {
      rules[rule.name] = { ...rule, expr: parseRule(rule.text) };
    } catch (error) {
      if (!(error instanceof CelSyntaxError)) throw error;
      diagnostics.error('rule-syntax', [...rule.path, 'rule'], `${rule.name}: ${error.message}, at column ${error.at + 1} of the rule`);
    }
  }

  const operations: Record<string, OperationDecl> = {};
  for (const operation of decl.operations) {
    const object = (name: string, path: RuleUse['path'], role: string): void => {
      if (!known(name)) return unknown(name, path);
      const base = definitions[name]?.base;
      if (base !== undefined && base !== 'object') diagnostics.error('not-an-object', path, `the ${role} of ${operation.name} must be an object; ${name} is of type ${base}`);
    };
    object(operation.input, [...operation.path, 'input'], 'input');
    const seen = new Set<string>();
    for (const output of operation.outputs) {
      object(output.object, output.path, 'output');
      if (seen.has(output.object)) diagnostics.error('duplicate-output', output.path, `${operation.name} lists the output ${output.object} two times`);
      seen.add(output.object);
    }
    operations[operation.name] = operation;
  }

  return { header: decl.header, definitions, rules, operations };
}

/** The identifier is a required property of the object, with one value: not an object or a list. */
function checkIdentifier(definition: Definition, definitions: Readonly<Record<string, Definition>>, diagnostics: Diagnostics): void {
  const name = definition.identifier!;
  const path = [...definition.path, 'identifier'];
  const why = !definition.properties?.includes(name)
    ? `is not a property of ${definition.name}`
    : !requiredOf(definition).has(name)
      ? `is optional; list it in the required rule of ${definition.name}`
      : definitions[name] && (definitions[name].base === 'object' || definitions[name].base === 'array')
        ? `is of type ${definitions[name].base}; an identifier is one value`
        : undefined;
  if (why) diagnostics.error('invalid-identifier', path, `the identifier ${name} ${why}`);
}
