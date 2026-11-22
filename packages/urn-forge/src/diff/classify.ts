/**
 * `urn-forge diff`: the class of each change between two manifests (spec §3, gate 5;
 * lifecycle plan, "The model").
 *
 * A change is breaking when a consumer that worked before can fail after it, and who can
 * fail depends on the direction of use:
 *
 * - In: a value that callers send. A narrower set breaks them.
 * - Out: a value that callers receive. A wider set breaks them.
 * - Stored: a value in a table of the Postgres plugin. A narrower set breaks old rows.
 *
 * A change that is neither narrower nor wider breaks every use. A URN with no use breaks no
 * one. The uses come from the old manifest: they are the consumers that exist.
 */
import { firstField } from '../rules/index.js';
import { liveIr } from '../ir/lifecycle.js';
import { statusOf, type IRPropertyRef, type Lifecycle, type UniversalIR, type Urn } from '../ir/types.js';
import { constraintRelation, listRelation, type Relation } from './relation.js';

export type ChangeClass = 'compatible' | 'breaking' | 'lifecycle';

export interface Change {
  readonly class: ChangeClass;
  /** The URN that changed, or `urn:<namespace>:<domain>` for the manifest itself. */
  readonly urn: string;
  readonly message: string;
}

export type Use = 'in' | 'out' | 'stored';

const USE_TEXT: Readonly<Record<Use, string>> = { in: 'callers send', out: 'callers receive', stored: 'the database stores' };
/** The note on a compatible change that a table of the database does not have yet: urn-forge writes CREATE statements only. */
const MIGRATION = '; the database needs a migration for it';

/** Who a breaking change breaks, for each use. */
const BROKEN_TEXT: Readonly<Record<Use, string>> = { in: 'callers that send it', out: 'callers that receive it', stored: 'rows already stored' };

/** The uses of every atom of a manifest. */
export function usesOf(ir: UniversalIR, tables: readonly Urn[] = []): Map<Urn, Set<Use>> {
  const live = liveIr(ir);
  const uses = new Map<Urn, Set<Use>>();
  const add = (urn: Urn, use: Use) => {
    if (!uses.has(urn)) uses.set(urn, new Set());
    uses.get(urn)!.add(use);
  };
  const properties = (refs: readonly IRPropertyRef[], use: Use, seen: Set<Urn>) => {
    for (const ref of refs) {
      if ('field' in ref) add(ref.field, use);
      else if ('link' in ref) {
        // A link holds the target's key, so the key field's values travel with it.
        const key = live.entities[ref.link]?.key;
        if (key) add(key, use);
      } else entity(ref.entity, use, seen);
    }
  };
  const entity = (urn: Urn, use: Use, seen = new Set<Urn>()) => {
    if (seen.has(urn) || !live.entities[urn]) return;
    seen.add(urn);
    add(urn, use);
    properties(live.entities[urn]!.fields, use, seen);
  };
  for (const op of Object.values(live.operations)) {
    add(op.urn, 'in');
    add(op.urn, 'out');
    entity(op.input, 'in');
    entity(op.output, 'out');
    for (const urn of op.errors) {
      const error = live.errors[urn];
      if (!error) continue;
      add(urn, 'out');
      properties(error.fields, 'out', new Set());
      // The event that records the error reaches the shell's audit trail.
      if (error.recordAs && live.events[error.recordAs]) {
        add(error.recordAs, 'out');
        properties(live.events[error.recordAs]!.fields, 'out', new Set());
      }
    }
    // An event reaches whoever the shell publishes it to (events plan, decision 9).
    for (const urn of op.emits) {
      if (!live.events[urn]) continue;
      add(urn, 'out');
      properties(live.events[urn]!.fields, 'out', new Set());
    }
  }
  for (const table of tables) entity(table, 'stored');
  for (const invariant of Object.values(live.invariants)) for (const use of uses.get(invariant.on) ?? []) add(invariant.urn, use);
  return uses;
}

/** Whether a change with this relation breaks a URN with these uses. */
function breaks(relation: Relation, uses: ReadonlySet<Use>): Use[] {
  if (relation === 'equal') return [];
  return [...uses].filter((use) => (use === 'out' ? relation !== 'narrower' : relation !== 'wider')).sort();
}

const VERB: Readonly<Record<Relation, string>> = { equal: 'keeps', narrower: 'narrows', wider: 'widens', neither: 'changes' };

const show = (value: unknown) => (value === undefined ? 'none' : typeof value === 'string' ? value : JSON.stringify(value));

/** "[1, 2]" style, of a constraint value or a list rule. */
function changedKeys(old: Readonly<Record<string, unknown>>, now: Readonly<Record<string, unknown>>): string {
  const keys = [...new Set([...Object.keys(old), ...Object.keys(now)])].sort();
  return keys
    .filter((k) => JSON.stringify(old[k]) !== JSON.stringify(now[k]))
    .map((k) => `${k} ${show(old[k])} → ${show(now[k])}`)
    .join(', ');
}

const STATUS_ORDER: Readonly<Record<Lifecycle['status'], number>> = { active: 0, deprecated: 1, sunset: 2 };

export interface ClassifyOptions {
  /** The Postgres plugin's tables in the old manifest, by URN: their values have the Stored use. */
  readonly tables?: readonly Urn[];
}

/** Every change from `old` to `now`, in URN order. */
export function classify(old: UniversalIR, now: UniversalIR, options: ClassifyOptions = {}): Change[] {
  const changes: Change[] = [];
  const manifest = `urn:${old.meta.namespace}:${old.meta.domain}`;
  if (old.meta.namespace !== now.meta.namespace || old.meta.domain !== now.meta.domain) {
    return [{ class: 'breaking', urn: manifest, message: `the namespace or domain changed to urn:${now.meta.namespace}:${now.meta.domain}, so every URN changed` }];
  }
  if (old.meta.stability !== now.meta.stability) {
    changes.push(
      now.meta.stability === 'stable'
        ? { class: 'compatible', urn: manifest, message: 'stability experimental → stable: from now on, a breaking change fails' }
        : { class: 'breaking', urn: manifest, message: 'stability stable → experimental: a published manifest cannot go back to experimental' },
    );
  }

  const oldUses = usesOf(old, options.tables);
  const newUses = usesOf(now, options.tables);
  /** The uses of a URN: the old manifest's, or for a new URN the new manifest's. */
  const usesFor = (urn: Urn, existed: boolean): Set<Use> => (existed ? oldUses.get(urn) : newUses.get(urn)) ?? new Set();

  /** A change with a relation: breaking if a use breaks, else compatible. */
  const relate = (urn: Urn, relation: Relation, what: string, uses: ReadonlySet<Use>) => {
    if (relation === 'equal') return;
    const broken = breaks(relation, uses);
    const used = [...uses].sort().map((u) => USE_TEXT[u]);
    const whom = used.length === 0 ? 'nothing uses' : used.join(' and ');
    changes.push({
      class: broken.length > 0 ? 'breaking' : 'compatible',
      urn,
      message: `${what} ${VERB[relation]} a value that ${whom}${broken.length > 0 ? `, which breaks ${broken.map((u) => BROKEN_TEXT[u]).join(' and ')}` : ''}`,
    });
  };
  const compatible = (urn: Urn, message: string) => changes.push({ class: 'compatible', urn, message });
  const breaking = (urn: Urn, message: string) => changes.push({ class: 'breaking', urn, message });

  type Node = { readonly urn: Urn; readonly lifecycle?: Lifecycle; readonly description?: string };
  const groups = ['fields', 'entities', 'invariants', 'operations', 'events', 'errors'] as const;
  for (const group of groups) {
    const before = old[group] as Readonly<Record<Urn, Node>>;
    const after = now[group] as Readonly<Record<Urn, Node>>;
    for (const urn of Object.keys(before) as Urn[]) {
      const a = before[urn]!;
      const b = after[urn];
      if (b === undefined) {
        // A sunset atom stays as a tombstone, so its URN never gets a second meaning.
        breaking(urn, `is removed; ${statusOf(a) === 'sunset' ? 'keep a sunset atom in the manifest, so its URN is never used again' : 'deprecate it, and set status: sunset when no one uses it'}`);
        continue;
      }
      // Lifecycle: forward only. A change to a sunset atom is not reported: it is gone for its users.
      const [from, to] = [statusOf(a), statusOf(b)];
      if (from === 'sunset' && to === 'sunset') continue;
      if (STATUS_ORDER[to] < STATUS_ORDER[from]) {
        breaking(urn, `status ${from} → ${to}: a status only moves forward; declare a new URN instead`);
        continue;
      }
      if (from !== to) changes.push({ class: 'lifecycle', urn, message: `status ${from} → ${to}` });
      if (to === 'sunset') continue;
      if (JSON.stringify(a.lifecycle?.supersededBy) !== JSON.stringify(b.lifecycle?.supersededBy) || a.lifecycle?.sunsetDate !== b.lifecycle?.sunsetDate) {
        if (from === to) changes.push({ class: 'lifecycle', urn, message: changedKeys({ supersededBy: a.lifecycle?.supersededBy, sunsetDate: a.lifecycle?.sunsetDate }, { supersededBy: b.lifecycle?.supersededBy, sunsetDate: b.lifecycle?.sunsetDate }) });
      }
      if (a.description !== b.description) compatible(urn, 'description changed');
    }
    for (const urn of Object.keys(after) as Urn[]) {
      if (before[urn] !== undefined) continue;
      // A new invariant narrows its entity; every other new atom is new to everyone.
      // An invariant on a new entity narrows nothing that a caller sent or a row holds (fourth blind trial).
      if (group === 'invariants') {
        const on = now.invariants[urn]!.on;
        if (old.entities[on] === undefined) compatible(urn, `is new, on the new entity ${on}`);
        else relate(urn, 'narrower', 'a new invariant', usesFor(on, true));
      } else compatible(urn, 'is new');
    }
  }

  const live = (node: { readonly lifecycle?: Lifecycle } | undefined) => node !== undefined && statusOf(node) !== 'sunset';

  // Fields: the primitive, then the constraints.
  for (const urn of Object.keys(old.fields) as Urn[]) {
    const [a, b] = [old.fields[urn]!, now.fields[urn]];
    if (!live(a) || !live(b)) continue;
    const uses = usesFor(urn, true);
    if (a.primitive !== b!.primitive) relate(urn, 'neither', `primitive ${a.primitive} → ${b!.primitive}`, uses);
    else relate(urn, constraintRelation(a.primitive, a.constraints, b!.constraints), changedKeys(a.constraints, b!.constraints), uses);
  }

  /** The target of a property in the old manifest, if that target was deprecated there. */
  const deprecatedTarget = (ref: IRPropertyRef): Urn | undefined => {
    const urn = 'field' in ref ? ref.field : 'link' in ref ? ref.link : ref.entity;
    const node = old.fields[urn] ?? old.entities[urn];
    return node !== undefined && statusOf(node) === 'deprecated' ? urn : undefined;
  };

  /**
   * A required list that may be empty does not break stored rows: a row with no child rows holds
   * the empty list, which is valid (blind trial 2). Callers still have to send it.
   */
  const withoutEmptyRows = (ref: IRPropertyRef, uses: ReadonlySet<Use>): ReadonlySet<Use> =>
    ref.many !== undefined && (ref.many.minItems ?? 0) === 0 ? new Set([...uses].filter((u) => u !== 'stored')) : uses;
  /** The properties of an entity or an error, compared by name. */
  const properties = (urn: Urn, before: readonly IRPropertyRef[], after: readonly IRPropertyRef[], uses: ReadonlySet<Use>) => {
    const target = (ref: IRPropertyRef) => ('field' in ref ? `ref ${ref.field}` : 'link' in ref ? `link ${ref.link}` : `ref ${ref.entity}`);
    for (const a of before) {
      const b = after.find((p) => p.name === a.name);
      if (!b) {
        // A property whose target was deprecated retires on its announced path: callers were
        // warned (deprecated-ref, @deprecated) and had until the sunset date to move.
        const retired = deprecatedTarget(a);
        if (retired !== undefined) changes.push({ class: 'lifecycle', urn, message: `removes the property "${a.name}", whose target ${retired} was deprecated` });
        else relate(urn, 'wider', `removing the ${a.required ? 'required' : 'optional'} property "${a.name}"`, uses);
        continue;
      }
      if (target(a) !== target(b) || (a.many === undefined) !== (b.many === undefined)) {
        relate(urn, 'neither', `the property "${a.name}" (${target(a)}${a.many ? ', a list' : ''} → ${target(b)}${b.many ? ', a list' : ''})`, uses);
        continue;
      }
      if (a.required !== b.required) relate(urn, b.required ? 'narrower' : 'wider', `the property "${a.name}" (${a.required ? 'required → optional' : 'optional → required'})`, b.required ? withoutEmptyRows(b, uses) : uses);
      if (a.many && b.many) relate(urn, listRelation(a.many, b.many), `the list "${a.name}" (${changedKeys({ ...a.many }, { ...b.many })})`, uses);
    }
    for (const b of after) {
      if (before.some((p) => p.name === b.name)) continue;
      // An optional property is new to everyone; a required one narrows what callers may send.
      if (b.required) {
        const rest = withoutEmptyRows(b, uses);
        if (rest.size === 0 && uses.size > 0) compatible(urn, `adds the required list "${b.name}", which rows already stored hold as an empty list${MIGRATION}`);
        else relate(urn, 'narrower', `the new required property "${b.name}"`, rest);
      }
      // Compatible for callers, but a stored entity has a table that does not have it yet (fourth blind trial).
      else compatible(urn, `adds the optional property "${b.name}"${uses.has('stored') ? MIGRATION : ''}`);
    }
  };

  for (const urn of Object.keys(old.entities) as Urn[]) {
    const [a, b] = [old.entities[urn]!, now.entities[urn]];
    if (!live(a) || !live(b)) continue;
    const uses = usesFor(urn, true);
    if (a.key !== b!.key) relate(urn, 'neither', `key ${show(a.key)} → ${show(b!.key)}`, uses);
    properties(urn, a.fields, b!.fields, uses);
  }

  for (const urn of Object.keys(old.invariants) as Urn[]) {
    const [a, b] = [old.invariants[urn]!, now.invariants[urn]];
    if (!live(a) || !live(b)) continue;
    const uses = usesFor(urn, true);
    // A rule cannot be compared with another rule in general, so a new rule is neither.
    if (a.on !== b!.on) relate(urn, 'neither', `on ${a.on} → ${b!.on}`, uses);
    else if (a.ruleText !== b!.ruleText) relate(urn, 'neither', `rule ${a.ruleText} → ${b!.ruleText}`, uses);
    if (a.message !== b!.message) compatible(urn, 'message changed');
    // reportOn moves the issue, not the set of values that the rule accepts (reportOn plan, decision 7).
    const [fromField, toField] = [a.reportOn ?? firstField(a.rule), b!.reportOn ?? firstField(b!.rule)];
    if (fromField !== toField) compatible(urn, `reports its issue on "${fromField}" → "${toField}"`);
  }

  for (const urn of Object.keys(old.errors) as Urn[]) {
    const [a, b] = [old.errors[urn]!, now.errors[urn]];
    if (!live(a) || !live(b)) continue;
    const uses = usesFor(urn, true);
    if (a.category !== b!.category) relate(urn, 'neither', `category ${a.category} → ${b!.category}`, uses);
    if (a.retryable !== b!.retryable) relate(urn, 'neither', `retryable ${a.retryable} → ${b!.retryable}`, uses);
    if (JSON.stringify(a.message) !== JSON.stringify(b!.message)) compatible(urn, 'message changed');
    // A record is extra information on a refusal: a new one is compatible; removing or changing one breaks its audit consumers.
    if (a.recordAs === undefined && b!.recordAs !== undefined) compatible(urn, `adds the record ${b!.recordAs}`);
    else if (a.recordAs !== undefined && b!.recordAs === undefined) relate(urn, 'wider', `removing the record ${a.recordAs}`, uses);
    else if (a.recordAs !== b!.recordAs) relate(urn, 'neither', `recordAs ${show(a.recordAs)} → ${show(b!.recordAs)}`, uses);
    properties(urn, a.fields, b!.fields, uses);
  }

  for (const urn of Object.keys(old.events) as Urn[]) {
    const [a, b] = [old.events[urn]!, now.events[urn]];
    if (!live(a) || !live(b)) continue;
    properties(urn, a.fields, b!.fields, usesFor(urn, true));
  }

  for (const urn of Object.keys(old.operations) as Urn[]) {
    const [a, b] = [old.operations[urn]!, now.operations[urn]];
    if (!live(a) || !live(b)) continue;
    if (a.input !== b!.input) breaking(urn, `input ${a.input} → ${b!.input}: callers send another entity`);
    if (a.output !== b!.output) breaking(urn, `output ${a.output} → ${b!.output}: callers receive another entity`);
    const added = b!.errors.filter((e) => !a.errors.includes(e));
    const removed = a.errors.filter((e) => !b!.errors.includes(e));
    // A new declared error is a new kind of result, which a caller that handles each kind does not know.
    for (const e of added) relate(urn, 'wider', `the new declared error ${e}`, new Set<Use>(['out']));
    for (const e of removed) relate(urn, 'narrower', `removing the declared error ${e}`, new Set<Use>(['out']));
    // A new event is a new kind of fact, which a consumer that handles each kind does not know.
    for (const e of b!.emits.filter((x) => !a.emits.includes(x))) relate(urn, 'wider', `the new event ${e}`, new Set<Use>(['out']));
    for (const e of a.emits.filter((x) => !b!.emits.includes(x))) relate(urn, 'narrower', `removing the event ${e}`, new Set<Use>(['out']));
  }

  return changes.sort((x, y) => (x.urn < y.urn ? -1 : x.urn > y.urn ? 1 : 0));
}

