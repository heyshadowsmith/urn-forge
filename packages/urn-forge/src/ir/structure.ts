/**
 * Pass 5: structure across entities. It runs once every node is
 * built, because each check reads another entity:
 *
 * - a link names an entity that has a `key` (the link holds the key's value);
 * - a `unique` list of an embedded entity names an entity that has a `key` (uniqueness
 *   compares keys);
 * - embeddings form no cycle (the type of an object would never end). Links may form cycles.
 */
import type { IRIssue, IRPropertyRef, UniversalIR, Urn } from './types.js';

/** `policy.entity.policy` for `urn:acme:insurance:policy:entity:policy`. */
function shortKeyOf(urn: Urn): string {
  const [, , , context, kind, identifier] = urn.split(':');
  return `${context}.${kind}.${identifier}`;
}

export function checkStructure(ir: Pick<UniversalIR, 'fields' | 'entities' | 'events' | 'errors'>): IRIssue[] {
  const issues: IRIssue[] = [];
  const owners: [Urn, readonly IRPropertyRef[]][] = [
    ...Object.values(ir.entities).map((e) => [e.urn, e.fields] as [Urn, readonly IRPropertyRef[]]),
    ...Object.values(ir.events).map((e) => [e.urn, e.fields] as [Urn, readonly IRPropertyRef[]]),
    ...Object.values(ir.errors).map((e) => [e.urn, e.fields] as [Urn, readonly IRPropertyRef[]]),
  ].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  for (const [owner, refs] of owners) {
    refs.forEach((ref, index) => {
      if ('link' in ref && ir.entities[ref.link]?.key === undefined) {
        issues.push({
          code: 'missing-key',
          urn: owner,
          message: `${owner}: fields[${index}].link ${ref.link} has no key, so a link to it holds nothing; set key on it`,
          path: [shortKeyOf(owner), 'fields', index, 'link'],
        });
      }
      const unique = ref.many?.unique;
      if (Array.isArray(unique)) {
        const names = unique as readonly string[];
        const item = 'entity' in ref ? ir.entities[ref.entity] : undefined;
        const at = { code: 'invalid-unique' as const, urn: owner, path: [shortKeyOf(owner), 'fields', index, 'many', 'unique'] };
        if (!item) {
          issues.push({ ...at, message: `${owner}: fields[${index}] is a list of values; a unique list of properties is for a list of embedded entities, so write unique: true` });
        } else {
          names.forEach((name, i) => {
            const property = item.fields.find((p) => p.name === name);
            if (!property) issues.push({ ...at, message: `${owner}: fields[${index}].many.unique: "${name}" is not a property of ${item.urn} (properties: ${item.fields.map((p) => p.name).join(', ')})` });
            else if ('entity' in property || property.many) issues.push({ ...at, message: `${owner}: fields[${index}].many.unique: "${name}" holds ${property.many ? 'a list' : 'an embedded entity'}; name properties that hold one value` });
            else if (names.indexOf(name) !== i) issues.push({ ...at, message: `${owner}: fields[${index}].many.unique lists "${name}" more than once` });
          });
        }
      } else if ('entity' in ref && unique && ir.entities[ref.entity]?.key === undefined) {
        issues.push({
          code: 'missing-key',
          urn: owner,
          message: `${owner}: fields[${index}] is a unique list of ${ref.entity}, which has no key to compare; set key on it`,
          path: [shortKeyOf(owner), 'fields', index, 'many'],
        });
      }
    });
  }

  // Delivery: each property that it names is a required, single value of the right primitive.
  for (const event of Object.values(ir.events).sort((a, b) => (a.urn < b.urn ? -1 : 1))) {
    const delivery = event.delivery;
    if (!delivery) continue;
    const problem = (message: string, ...path: (string | number)[]) =>
      issues.push({ code: 'invalid-delivery', urn: event.urn, message: `${event.urn}: delivery.${message}`, path: [shortKeyOf(event.urn), 'delivery', ...path] });
    const named: string[] = [];
    const check = (name: string, primitives: readonly string[] | undefined, what: string, ...path: (string | number)[]) => {
      const property = event.fields.find((p) => p.name === name);
      const field = property && 'field' in property ? ir.fields[property.field] : undefined;
      const at = path.map((p) => (typeof p === 'number' ? `[${p}]` : p)).join('');
      if (!property) problem(`${at}: "${name}" is not a property of the event (properties: ${event.fields.map((p) => p.name).join(', ') || 'none'})`, ...path);
      else if (!property.required || property.many || 'entity' in property) problem(`${at}: "${name}" must be a required property that holds one value`, ...path);
      else if (primitives && field && !primitives.includes(field.primitive)) problem(`${at}: "${name}" is ${field.primitive}, but ${what}`, ...path);
      else if (named.includes(name)) problem(`${at}: "${name}" is named twice in delivery`, ...path);
      named.push(name);
    };
    check(delivery.id, ['string'], 'the id must be a string', 'id');
    delivery.orderBy.forEach((name, index) => check(name, undefined, '', ...(delivery.orderBy.length === 1 && index === 0 ? ['orderBy'] : ['orderBy', index])));
    if (delivery.sequence !== undefined) check(delivery.sequence, ['integer'], 'the sequence must be an integer', 'sequence');
  }

  // Embedding cycles: one report for each cycle, at its first entity in URN order.
  const embeds = (urn: Urn): Urn[] => (ir.entities[urn]?.fields ?? []).flatMap((ref) => ('entity' in ref ? [ref.entity] : []));
  const reported = new Set<string>();
  for (const start of Object.keys(ir.entities).sort() as Urn[]) {
    const walk = (urn: Urn, path: Urn[]): void => {
      for (const next of embeds(urn)) {
        if (next === start) {
          const cycle = [...path, start];
          const id = [...cycle.slice(0, -1)].sort().join(' ');
          if (reported.has(id)) continue;
          reported.add(id);
          issues.push({
            code: 'embedding-cycle',
            urn: start,
            message: `${start}: ${cycle.join(' embeds ')}, so its type would never end; use a link for one of them`,
            path: [shortKeyOf(start), 'fields'],
          });
        } else if (!path.includes(next) && next > start) {
          walk(next, [...path, next]);
        }
      }
    };
    walk(start, [start]);
  }
  return issues;
}
