/**
 * Pass 5: structure across entities (spec pass 5; structure plan). It runs once every node is
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

export function checkStructure(ir: Pick<UniversalIR, 'entities' | 'errors'>): IRIssue[] {
  const issues: IRIssue[] = [];
  const owners: [Urn, readonly IRPropertyRef[]][] = [
    ...Object.values(ir.entities).map((e) => [e.urn, e.fields] as [Urn, readonly IRPropertyRef[]]),
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
      if ('entity' in ref && ref.many?.unique && ir.entities[ref.entity]?.key === undefined) {
        issues.push({
          code: 'missing-key',
          urn: owner,
          message: `${owner}: fields[${index}] is a unique list of ${ref.entity}, which has no key to compare; set key on it`,
          path: [shortKeyOf(owner), 'fields', index, 'many'],
        });
      }
    });
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
