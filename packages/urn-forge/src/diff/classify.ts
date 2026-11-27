/**
 * The changes between two manifests, each breaking or compatible for callers. Whether a change
 * breaks depends on the side of the value: callers send the values of an input, and receive the values
 * of an output. A rule that accepts less breaks the senders; a rule that accepts more breaks the
 * receivers. A value on both sides takes the stricter verdict.
 *
 * A rule is compared by name and by its argument. For a rule that compares the value with its one
 * parameter (`self >= bound`, `size(self) <= count`), the form of the rule gives the direction of a
 * new argument. Any other change of an argument, or of a rule's text, is breaking for both sides.
 */
import type { Expr } from '../cel/parse.js';
import { print } from '../cel/print.js';
import { variantsOf, type Model } from '../model.js';
import type { Application } from '../rules.js';
import { domainUrn, partUrn } from '../urn.js';

export type ChangeClass = 'breaking' | 'compatible';

export interface Change {
  readonly class: ChangeClass;
  /** The URN of the part that changed: `urn:demo:booking:definition:party_size`, or the domain's URN for the header. */
  readonly place: string;
  readonly message: string;
}

export interface Side {
  readonly model: Model;
  readonly applications: readonly Application[];
}

type Direction = 'narrower' | 'wider' | 'both' | 'same';

/** The definitions that callers send (input) and receive (output), through properties, items and types. */
export function sides(model: Model): { readonly sent: ReadonlySet<string>; readonly received: ReadonlySet<string> } {
  const reach = (roots: readonly string[]): Set<string> => {
    const seen = new Set<string>();
    const visit = (name: string): void => {
      const definition = model.definitions[name];
      if (!definition || seen.has(name)) return;
      seen.add(name);
      if (definition.root !== name) visit(definition.type);
      const root = model.definitions[definition.root];
      root?.properties?.forEach(visit);
      if (root?.items) visit(root.items);
      if (root?.values) visit(root.values);
      if (root?.keys) visit(root.keys);
      if (root) variantsOf(root).forEach(visit);
    };
    roots.forEach(visit);
    return seen;
  };
  const operations = Object.values(model.operations);
  return { sent: reach(operations.map((o) => o.input)), received: reach(operations.flatMap((o) => o.outputs.map((out) => out.object))) };
}

/** For a rule `self op p` or `p op self` (or `size(self) op p`): whether a larger p accepts less or more. */
function largerParameter(expr: Expr, parameter: string): 'narrower' | 'wider' | undefined {
  if (expr.kind !== 'binary' || !['<', '<=', '>', '>='].includes(expr.op)) return undefined;
  const isParameter = (e: Expr): boolean => e.kind === 'name' && e.name === parameter;
  const isValue = (e: Expr): boolean =>
    (e.kind === 'name' && e.name === 'self') || (e.kind === 'call' && e.fn === 'size' && ((e.target ?? e.args[0])?.kind === 'name'));
  // Written as `value op parameter`: a larger parameter is narrower for >= and >, wider for <= and <.
  const op = isValue(expr.left) && isParameter(expr.right) ? expr.op : isParameter(expr.left) && isValue(expr.right) ? flip(expr.op) : undefined;
  if (!op) return undefined;
  return op === '>' || op === '>=' ? 'narrower' : 'wider';
}

function flip(op: string): string {
  return ({ '<': '>', '<=': '>=', '>': '<', '>=': '<=' } as Record<string, string>)[op]!;
}

const asSet = (value: unknown): Set<string> => new Set(Array.isArray(value) ? value.map((v) => JSON.stringify(v)) : []);

/** The direction of a new argument of a rule: narrower (accepts less), wider, both, or the same. */
export function argumentDirection(application: Application, before: unknown, after: unknown): Direction {
  if (JSON.stringify(before) === JSON.stringify(after)) return 'same';
  const { rule } = application;
  // A list that the value must be in (enum), or that the object must have (required).
  if (rule.name === 'enum' || rule.name === 'required') {
    const a = asSet(before);
    const b = asSet(after);
    const subset = [...b].every((x) => a.has(x));
    const superset = [...a].every((x) => b.has(x));
    const fewer = rule.name === 'enum' ? subset : superset;
    const more = rule.name === 'enum' ? superset : subset;
    return fewer ? 'narrower' : more ? 'wider' : 'both';
  }
  if (rule.parameters.length === 1 && typeof before === 'number' && typeof after === 'number') {
    const larger = largerParameter(rule.expr, rule.parameters[0]!);
    if (larger) return after > before ? larger : larger === 'narrower' ? 'wider' : 'narrower';
  }
  return 'both';
}

/** The verdict of a change that accepts less, more or both, for a value on these sides. */
function verdict(direction: Direction, sent: boolean, received: boolean, ignoreUnknown: boolean): ChangeClass {
  // A value that no operation sends or receives breaks no caller.
  if (direction === 'same' || (!sent && !received)) return 'compatible';
  if (direction === 'both') return 'breaking';
  // Accepts less: senders may now be rejected. Accepts more: receivers may get what they do not expect,
  // unless the contract promises that they ignore what they do not know.
  if (direction === 'narrower') return sent ? 'breaking' : 'compatible';
  return received && !ignoreUnknown ? 'breaking' : 'compatible';
}

function useKey(application: Application): string {
  return application.rule.name;
}

function rulesOf(side: Side, place: (a: Application) => string | undefined): Map<string, Map<string, Application>> {
  const map = new Map<string, Map<string, Application>>();
  for (const application of side.applications) {
    const key = place(application);
    if (key === undefined) continue;
    const uses = map.get(key) ?? new Map<string, Application>();
    uses.set(useKey(application), application);
    map.set(key, uses);
  }
  return map;
}

/** The changes from the old manifest to the new one. */
export function classify(old: Side, next: Side): Change[] {
  const changes: Change[] = [];
  const add = (cls: ChangeClass, place: string, message: string): void => {
    changes.push({ class: cls, place, message });
  };
  const ignoreUnknown = next.model.header.compatibility?.callers === 'ignore-unknown';
  const urn = (kind: 'definition' | 'rule' | 'operation', name: string): string => partUrn(next.model.header, kind, name);
  const domain = domainUrn(next.model.header);

  const a = old.model.header;
  const b = next.model.header;
  if (a.namespace !== b.namespace || a.domain !== b.domain) add('breaking', domain, `the contract is now ${b.namespace}:${b.domain}, not ${a.namespace}:${a.domain}`);
  if (!a.compatibility && b.compatibility) add('compatible', domain, 'callers now promise to ignore what they do not know: compatibility callers: ignore-unknown');
  if (a.compatibility && !b.compatibility) add('breaking', domain, 'callers no longer promise to ignore what they do not know');

  const oldSides = sides(old.model);
  const newSides = sides(next.model);
  const sentIn = (name: string): boolean => oldSides.sent.has(name) || newSides.sent.has(name);
  const receivedIn = (name: string): boolean => oldSides.received.has(name) || newSides.received.has(name);

  // Rule texts: a rule of the manifest whose text changed is breaking wherever it is used.
  for (const rule of Object.values(next.model.rules)) {
    const before = old.model.rules[rule.name];
    if (!before?.expr || !rule.expr) continue;
    if (print(before.expr) !== print(rule.expr)) {
      const used = next.applications.some((app) => app.rule.name === rule.name && app.owner === next.model);
      add(used ? 'breaking' : 'compatible', urn('rule', rule.name), `the rule is now ${print(rule.expr)}, not ${print(before.expr)}`);
    }
  }

  // Definitions.
  for (const name of new Set([...Object.keys(old.model.definitions), ...Object.keys(next.model.definitions)])) {
    const before = old.model.definitions[name];
    const after = next.model.definitions[name];
    const place = urn('definition', name);
    const sent = sentIn(name);
    const received = receivedIn(name);
    const used = sent || received;
    if (!before) {
      add('compatible', place, 'the definition is new');
      continue;
    }
    if (!after) {
      add(used ? 'breaking' : 'compatible', place, 'the definition is removed');
      continue;
    }
    if (before.type !== after.type) add(used ? 'breaking' : 'compatible', place, `the type is now ${after.type}, not ${before.type}`);
    if (before.items !== after.items) add(used ? 'breaking' : 'compatible', place, `the items are now ${after.items}, not ${before.items}`);
    if (before.values !== after.values) add(used ? 'breaking' : 'compatible', place, `the values are now ${after.values}, not ${before.values}`);
    // A new variant is a value that a reader did not know; a removed one, a value that a writer can no longer give.
    const oldVariants = variantsOf(before);
    const newVariants = variantsOf(after);
    for (const v of newVariants.filter((x) => !oldVariants.includes(x))) add(used ? 'breaking' : 'compatible', place, `the variant ${v} is new`);
    for (const v of oldVariants.filter((x) => !newVariants.includes(x))) add(used ? 'breaking' : 'compatible', place, `the variant ${v} is removed`);
    if (before.tag !== after.tag) add(used ? 'breaking' : 'compatible', place, `the tag is now ${after.tag ?? 'none'}, not ${before.tag ?? 'none'}`);
    if (before.keys !== after.keys) add(used ? 'breaking' : 'compatible', place, `the keys are now ${after.keys ?? 'any string'}, not ${before.keys ?? 'any string'}`);
    if (before.identifier !== after.identifier) add(used ? 'breaking' : 'compatible', place, `the identifier is now ${after.identifier ?? 'none'}, not ${before.identifier ?? 'none'}`);
    if (!before.deprecated && after.deprecated) add('compatible', place, 'the definition is deprecated');
    const oldProps = before.properties ?? [];
    const newProps = after.properties ?? [];
    for (const property of newProps.filter((p) => !oldProps.includes(p))) {
      // Senders need not send a new property unless it is required (a rule, compared below); receivers may get it.
      add(verdict('wider', sent, received, ignoreUnknown), place, `the property ${property} is new`);
    }
    for (const property of oldProps.filter((p) => !newProps.includes(p))) add(used ? 'breaking' : 'compatible', place, `the property ${property} is removed`);
  }

  // Rules of definitions, by name and argument.
  const definitionRules = (side: Side) => rulesOf(side, (app) => (app.place.kind === 'definition' ? app.place.definition : undefined));
  const oldDefinitionRules = definitionRules(old);
  const newDefinitionRules = definitionRules(next);
  for (const name of Object.keys(next.model.definitions)) {
    if (!old.model.definitions[name]) continue;
    const before = oldDefinitionRules.get(name) ?? new Map<string, Application>();
    const after = newDefinitionRules.get(name) ?? new Map<string, Application>();
    const sent = sentIn(name);
    const received = receivedIn(name);
    const place = urn('definition', name);
    for (const [rule, application] of after) {
      const previous = before.get(rule);
      if (!previous) {
        add(verdict('narrower', sent, received, ignoreUnknown), place, `the rule ${rule} is new: it accepts less`);
        continue;
      }
      const params = application.rule.parameters;
      for (const parameter of params) {
        const direction = argumentDirection(application, previous.arguments[parameter], application.arguments[parameter]);
        if (direction === 'same') continue;
        const what = direction === 'narrower' ? 'it accepts less' : direction === 'wider' ? 'it accepts more' : 'it accepts other values';
        add(verdict(direction, sent, received, ignoreUnknown), place, `${rule} is now ${JSON.stringify(application.arguments[parameter])}, not ${JSON.stringify(previous.arguments[parameter])}: ${what}`);
      }
    }
    for (const rule of before.keys()) if (!after.has(rule)) add(verdict('wider', sent, received, ignoreUnknown), place, `the rule ${rule} is removed: it accepts more`);
  }

  // Operations.
  for (const name of new Set([...Object.keys(old.model.operations), ...Object.keys(next.model.operations)])) {
    const before = old.model.operations[name];
    const after = next.model.operations[name];
    const place = urn('operation', name);
    if (!before) {
      add('compatible', place, 'the operation is new');
      continue;
    }
    if (!after) {
      add('breaking', place, 'the operation is removed');
      continue;
    }
    if (!before.deprecated && after.deprecated) add('compatible', place, 'the operation is deprecated');
    if (before.input !== after.input) add('breaking', place, `the input is now ${after.input}, not ${before.input}`);
    const oldOutputs = before.outputs.map((o) => o.object);
    const newOutputs = after.outputs.map((o) => o.object);
    for (const output of newOutputs.filter((o) => !oldOutputs.includes(o))) {
      add(ignoreUnknown ? 'compatible' : 'breaking', place, `the output ${output} is new: callers can get an answer that they do not handle`);
    }
    for (const output of oldOutputs.filter((o) => !newOutputs.includes(o))) add('compatible', place, `the output ${output} is removed`);
  }

  // Rules of operations and outputs: a new one promises more (compatible), a removed one promises less.
  const operationRules = (side: Side) =>
    rulesOf(side, (app) => (app.place.kind === 'output' ? `operations.${app.place.operation}.${app.place.object}` : app.place.kind === 'operation' ? `operations.${app.place.operation}` : undefined));
  const oldOperationRules = operationRules(old);
  const newOperationRules = operationRules(next);
  for (const key of new Set([...oldOperationRules.keys(), ...newOperationRules.keys()])) {
    const before = oldOperationRules.get(key) ?? new Map<string, Application>();
    const after = newOperationRules.get(key) ?? new Map<string, Application>();
    const [, operation, object] = key.split('.') as [string, string, string | undefined];
    if (!old.model.operations[operation] || !next.model.operations[operation]) continue;
    const place = urn('operation', operation);
    const of = object ? ` of the output ${object}` : '';
    for (const [rule, application] of after) {
      const previous = before.get(rule);
      if (!previous) add('compatible', place, `the rule ${rule}${of} is new: the answer promises more`);
      else if (JSON.stringify(previous.arguments) !== JSON.stringify(application.arguments)) add('breaking', place, `the arguments of ${rule}${of} changed`);
    }
    for (const rule of before.keys()) if (!after.has(rule)) add('breaking', place, `the rule ${rule}${of} is removed: the answer promises less`);
  }

  // By code point, not by locale: the order is the same on every machine.
  return changes.sort((x, y) => (x.place < y.place ? -1 : x.place > y.place ? 1 : 0));
}
