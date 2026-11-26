/**
 * Rules where they are applied. A definition, an output and an operation each list rules by name: a
 * rule of the manifest, or a standard rule. Each use gives the rule's parameters an argument, and the
 * rule is typed where it is used: `self` is the definition's value; `input` and `output` are the
 * operation's objects. A rule with a parameter's name reads the argument.
 */
import { readFileSync } from 'node:fs';
import { BOOL, checkRule, DOUBLE, INT, STRING, type CelType, type PropertyType, type Scope } from './cel/check.js';
import type { Expr } from './cel/parse.js';
import { Diagnostics, type Path } from './diagnostics.js';
import { readManifest, RULE_NAME, type RuleUse } from './manifest.js';
import { buildModel, requiredOf, type Definition, type Model, type Rule } from './model.js';

/** The standard set, loaded once, with the uses of its rules in its own definitions. A problem in it is a bug in urn-forge. */
let standardSet: { readonly model: Model; readonly applications: readonly Application[] } | undefined;

function loadStandard(): NonNullable<typeof standardSet> {
  if (standardSet) return standardSet;
  const diagnostics = new Diagnostics();
  const text = readFileSync(new URL('./standard.manifest.yaml', import.meta.url), 'utf8');
  const decl = readManifest(text, diagnostics, { ruleName: RULE_NAME });
  const model = decl ? buildModel(decl, diagnostics) : undefined;
  if (!model || diagnostics.hasErrors) throw new Error(`the standard set has problems: ${JSON.stringify(diagnostics.list)}`);
  // The standard set's own uses are checked against itself.
  const applications = checkRules(model, model, diagnostics);
  if (diagnostics.hasErrors) throw new Error(`the standard set has problems: ${JSON.stringify(diagnostics.list)}`);
  standardSet = { model, applications };
  return standardSet;
}

/** The standard set of rules: the keywords of JSON Schema. */
export function standard(): Model {
  return loadStandard().model;
}

/** The uses of rules in the standard set's own definitions, such as a count of 0 or more. */
export function standardApplications(): readonly Application[] {
  return loadStandard().applications;
}

/** The CEL type of a definition's value. */
export function celType(definition: Definition, model: Model): CelType {
  switch (definition.base) {
    case 'integer':
      return INT;
    case 'number':
      return DOUBLE;
    case 'string':
      return STRING;
    case 'boolean':
      return BOOL;
    case 'object':
      return { kind: 'object', name: definition.root };
    case 'array': {
      const root = model.definitions[definition.root]!;
      const items = model.definitions[root.items!];
      // An unknown item type is reported by the model; it types as a string here, with no more problems.
      return { kind: 'list', of: items ? celType(items, model) : STRING };
    }
  }
}

/** The properties of each object of a model, with their types and whether they can be absent. */
function propertiesOf(model: Model): Scope['properties'] {
  return (name) => {
    const root = model.definitions[name];
    if (!root?.properties) return undefined;
    const required = requiredOf(root);
    const properties: Record<string, PropertyType> = {};
    for (const property of root.properties) {
      const definition = model.definitions[property];
      if (definition) properties[property] = { type: celType(definition, model), optional: !required.has(property) };
    }
    return properties;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Why `value` is not a value of `definition`, or undefined when it is one. Rules are checked later, by the generated code. */
function notAValue(value: unknown, definition: Definition, model: Model): string | undefined {
  const root = model.definitions[definition.root]!;
  switch (definition.base) {
    case 'integer':
      return Number.isSafeInteger(value) ? undefined : `${JSON.stringify(value)} is not an integer`;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? undefined : `${JSON.stringify(value)} is not a number`;
    case 'string':
      return typeof value === 'string' ? undefined : `${JSON.stringify(value)} is not a string`;
    case 'boolean':
      return typeof value === 'boolean' ? undefined : `${JSON.stringify(value)} is not true or false`;
    case 'array': {
      if (!Array.isArray(value)) return `${JSON.stringify(value)} is not a list`;
      const items = model.definitions[root.items!];
      for (const item of value) {
        const why = items && notAValue(item, items, model);
        if (why) return why;
      }
      return undefined;
    }
    case 'object': {
      if (!isRecord(value)) return `${JSON.stringify(value)} is not a map`;
      for (const key of Object.keys(value)) if (!root.properties?.includes(key)) return `${key} is not a property of ${root.name}`;
      for (const name of requiredOf(root)) if (!Object.hasOwn(value, name)) return `it has no ${name}`;
      for (const [key, item] of Object.entries(value)) {
        const property = model.definitions[key];
        const why = property && notAValue(item, property, model);
        if (why) return why;
      }
      return undefined;
    }
  }
}

/** Where a rule is applied: a definition, an output of an operation, or an operation. */
export type Place =
  | { readonly kind: 'definition'; readonly definition: string }
  | { readonly kind: 'output'; readonly operation: string; readonly object: string }
  | { readonly kind: 'operation'; readonly operation: string };

/** A use of a rule that checks: the rule, its arguments by parameter, and the type of each node. */
export interface Application {
  readonly use: RuleUse;
  readonly rule: Rule & { readonly expr: Expr };
  /** The model that declares the rule: the manifest, or the standard set. */
  readonly owner: Model;
  readonly place: Place;
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly types: ReadonlyMap<Expr, CelType>;
}

/** Checks each use of a rule in `model`, and gives the uses that check. Rules are looked up in `model`, then in `standardSet`. */
export function checkRules(model: Model, standardSet: Model, diagnostics: Diagnostics): Application[] {
  const applications: Application[] = [];
  // A manifest's rule cannot take the name of a standard rule: a reader would not know which one applies.
  if (model !== standardSet) {
    for (const rule of Object.values(model.rules)) {
      if (Object.hasOwn(standardSet.rules, rule.name)) diagnostics.error('standard-name', rule.path, `${rule.name} is a standard rule; give this rule another name`);
    }
  }
  for (const rule of Object.values(model.rules)) checkMessage(rule, diagnostics);

  const find = (name: string): { rule: Rule; owner: Model } | undefined => {
    if (Object.hasOwn(model.rules, name)) return { rule: model.rules[name]!, owner: model };
    if (Object.hasOwn(standardSet.rules, name)) return { rule: standardSet.rules[name]!, owner: standardSet };
    return undefined;
  };
  const properties = propertiesOf(model);

  const apply = (use: RuleUse, names: Record<string, CelType>, where: string, place: Place): void => {
    const found = find(use.rule);
    if (!found) {
      diagnostics.error('unknown-rule', use.path, `${use.rule} is not a rule of this manifest or a standard rule`);
      return;
    }
    const { rule, owner } = found;
    // A rule that does not parse is reported where it is declared.
    if (!rule.expr) return;
    const parameters = checkArgument(use, rule, owner, diagnostics);
    if (!parameters) return;
    const scope: Scope = {
      names: { ...names, ...Object.fromEntries(parameters.map((p) => [p, celType(owner.definitions[p]!, owner)])) },
      properties,
    };
    const { type, problems, types } = checkRule(rule.expr, scope);
    for (const problem of problems) {
      const hint = problem.code === 'rule-scope' ? ` (applied to ${where})` : '';
      diagnostics.error(problem.code, use.path, `${rule.name}: ${problem.message}${hint}`);
    }
    if (problems.length > 0 || !type) return;
    if (type.kind !== 'bool') {
      diagnostics.error('rule-type', use.path, `${rule.name} gives the type ${type.kind}; a rule must give a bool`);
      return;
    }
    const args = parameters.length === 1 ? { [parameters[0]!]: use.argument!.value } : parameters.length === 0 ? {} : (use.argument!.value as Record<string, unknown>);
    applications.push({ use, rule: rule as Application['rule'], owner, place, arguments: args, types });
  };

  for (const definition of Object.values(model.definitions)) {
    for (const use of definition.rules) apply(use, { self: celType(definition, model) }, `the definition ${definition.name}`, { kind: 'definition', definition: definition.name });
  }
  for (const operation of Object.values(model.operations)) {
    const object = (name: string): CelType | undefined => {
      const definition = model.definitions[name];
      return definition ? celType(definition, model) : undefined;
    };
    const input = object(operation.input);
    if (!input) continue;
    for (const output of operation.outputs) {
      const type = object(output.object);
      if (!type) continue;
      for (const use of output.rules) {
        apply(use, { input, output: type }, `the output ${output.object} of ${operation.name}`, { kind: 'output', operation: operation.name, object: output.object });
      }
    }
    // The operation's own rules hold whichever output comes back: they read output only when there is one.
    const only = operation.outputs.length === 1 ? object(operation.outputs[0]!.object) : undefined;
    for (const use of operation.rules) {
      apply(use, { input, ...(only ? { output: only } : {}) }, `the operation ${operation.name}`, { kind: 'operation', operation: operation.name });
    }
  }
  return applications;
}

/** The parameters of a use, when its argument fits them: none, one value, or a map by parameter name. */
function checkArgument(use: RuleUse, rule: Rule, owner: Model, diagnostics: Diagnostics): readonly string[] | undefined {
  const at: Path = [...use.path, use.rule];
  const wrong = (path: Path, message: string): undefined => {
    diagnostics.error('rule-argument', path, `${use.rule}: ${message}`);
    return undefined;
  };
  const fits = (value: unknown, parameter: string, path: Path): boolean => {
    const why = notAValue(value, owner.definitions[parameter]!, owner);
    if (why) wrong(path, `${why}; ${parameter} is ${owner.definitions[parameter]!.description.toLowerCase()}`);
    return why === undefined;
  };
  const { parameters } = rule;
  if (parameters.length === 0) {
    return use.argument ? wrong(at, `the rule has no parameter; write - ${use.rule}`) : parameters;
  }
  if (!use.argument) return wrong(use.path, `the rule has the parameters ${parameters.join(', ')}; write - ${use.rule}: <argument>`);
  if (parameters.length === 1) return fits(use.argument.value, parameters[0]!, at) ? parameters : undefined;
  const value = use.argument.value;
  if (!isRecord(value)) return wrong(at, `the rule has the parameters ${parameters.join(', ')}; give a map of each to its value`);
  let ok = true;
  for (const key of Object.keys(value)) if (!parameters.includes(key)) ok = wrong([...at, key], `${key} is not a parameter; the parameters are ${parameters.join(', ')}`) ?? false;
  for (const parameter of parameters) {
    if (!Object.hasOwn(value, parameter)) ok = wrong(at, `the argument has no ${parameter}`) ?? false;
    else if (!fits(value[parameter], parameter, [...at, parameter])) ok = false;
  }
  return ok ? parameters : undefined;
}

/** A failure message names only the rule's parameters: `{bound}`. */
function checkMessage(rule: Rule, diagnostics: Diagnostics): void {
  for (const [, name] of rule.failureMessage.matchAll(/\{([^{}]*)\}/g)) {
    if (!rule.parameters.includes(name!)) {
      const known = rule.parameters.length === 0 ? 'the rule has no parameter' : `the parameters are ${rule.parameters.join(', ')}`;
      diagnostics.error('invalid-message', [...rule.path, 'failure_message'], `{${name}} is not a parameter of ${rule.name}; ${known}`);
    }
  }
}
