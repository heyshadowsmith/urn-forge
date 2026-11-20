/**
 * IR builder: compilation passes 2–4 and 7 over a manifest that passed the meta-schema (spec §5).
 *
 *   2. Expansion: short keys become full URNs; brandIdentifier is derived.
 *   3. Uniqueness: no two atoms share a URN or a brandIdentifier.
 *   4. Referential integrity: every reference a kind declares (its `references` slots)
 *      resolves to an atom of an allowed kind.
 *   Then each kind builds its IR node from the resolved entry. Building runs the checks that
 *   belong to one kind: an entity's duplicate properties, and pass 7 (constraint coherence)
 *   for fields.
 *
 * Passes 5, 6 and 8 (cycles, rule typing, lifecycle) are not built yet.
 */
import type { ManifestLocator, ManifestPath } from '../diagnostics.js';
import { KINDS, KIND_NAMES, kind, namedKinds, referenceOccurrences, type Atom, type KindName } from '../kinds/index.js';
import { parseManifest, parseShortKey, type ValidManifest } from '../meta-schema.js';
import { toBrandIdentifier, toUrn } from '../naming.js';
import { canonicalJson, compareCodeUnits, sha256Hex } from './canonical.js';
import type { IRBuildResult, IRIssue, UniversalIR, Urn } from './types.js';

function sortedByUrn<T>(record: Map<Urn, T>): Record<Urn, T> {
  const out = {} as Record<Urn, T>;
  for (const urn of [...record.keys()].sort(compareCodeUnits)) out[urn] = record.get(urn)!;
  return out;
}

/** Runs passes 2–4 and 7 and returns the sorted IR, or every issue found. */
export function buildIr(manifest: ValidManifest): IRBuildResult {
  const { header } = manifest;
  const groups = manifest as unknown as Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  const issues: IRIssue[] = [];

  // Pass 2: expansion. Short keys were validated by the meta-schema, so parsing cannot fail here.
  const expand = (shortKey: string): Atom | undefined => {
    const parsed = parseShortKey(shortKey);
    if (!parsed.ok) return undefined;
    const { context, kind: kindName, identifier } = parsed.value;
    return {
      urn: toUrn({ namespace: header.namespace, domain: header.domain, context, kind: kindName, identifier }) as Urn,
      kind: kindName,
      context,
      identifier,
      brandIdentifier: toBrandIdentifier(context, identifier),
    };
  };

  const atoms = KIND_NAMES.flatMap((name) => Object.keys(groups[KINDS[name].group] ?? {}))
    .map(expand)
    .filter((atom): atom is Atom => atom !== undefined)
    .sort((a, b) => compareCodeUnits(a.urn, b.urn));

  // Pass 3: uniqueness of URN and brandIdentifier, reported in URN order.
  const byUrn = new Map<Urn, Atom>();
  const byBrand = new Map<string, Atom>();
  for (const atom of atoms) {
    const at = { path: [`${atom.context}.${atom.kind}.${atom.identifier}`], target: 'key' } as const;
    if (byUrn.has(atom.urn)) {
      issues.push({ code: 'duplicate-urn', urn: atom.urn, message: `${atom.urn}: declared more than once`, ...at });
      continue;
    }
    byUrn.set(atom.urn, atom);
    const first = byBrand.get(atom.brandIdentifier);
    if (first) {
      issues.push({
        code: 'duplicate-brand',
        urn: atom.urn,
        message:
          `${atom.urn}: brandIdentifier "${atom.brandIdentifier}" is already used by ${first.urn}; ` +
          'rename one of them',
        ...at,
      });
    } else {
      byBrand.set(atom.brandIdentifier, atom);
    }
  }

  const nodes = new Map<KindName, Map<Urn, unknown>>(KIND_NAMES.map((name) => [name, new Map()]));

  for (const atom of atoms) {
    if (byUrn.get(atom.urn) !== atom) continue; // duplicate, already reported
    const descriptor = kind(atom.kind);
    const shortKey = `${atom.context}.${atom.kind}.${atom.identifier}`;
    const decl = groups[descriptor.group]?.[shortKey];

    // Pass 4: resolve every reference the kind declares, to an atom of an allowed kind.
    const resolved = new Map<string, Atom>();
    for (const occurrence of referenceOccurrences(descriptor.references, decl)) {
      const path: ManifestPath = [shortKey, ...occurrence.path];
      const where = `${atom.urn}: ${occurrence.label} "${occurrence.shortKey}"`;
      const expanded = expand(occurrence.shortKey);
      const target = expanded && byUrn.get(expanded.urn);
      if (!target) {
        issues.push({
          code: 'unresolved-ref',
          urn: atom.urn,
          message: `${where} does not resolve (no atom ${expanded?.urn ?? occurrence.shortKey} in this manifest)`,
          path,
        });
      } else if (!occurrence.targets.includes(target.kind)) {
        issues.push({
          code: 'wrong-ref-kind',
          urn: atom.urn,
          message: `${where} must name ${namedKinds(occurrence.targets)}, but ${target.urn} is ${namedKinds([target.kind])}`,
          path,
        });
      } else {
        resolved.set(JSON.stringify(occurrence.path), target);
      }
    }

    const node = descriptor.build({
      atom,
      shortKey,
      decl,
      ref: (path) => resolved.get(JSON.stringify(path)),
      report: (issue) => issues.push(issue),
    });
    if (node !== undefined) nodes.get(atom.kind)!.set(atom.urn, node);
  }

  if (issues.length > 0) return { success: false, issues };

  const ir = {
    meta: {
      namespace: header.namespace,
      domain: header.domain,
      manifestVersion: header.version,
      stability: header.stability ?? 'stable',
      // Empty kind groups are left out, so the hash depends only on what the manifest says:
      // a kind added to urn-forge does not change the hash of a manifest that does not use it.
      manifestHash: sha256Hex(canonicalJson(Object.fromEntries(Object.entries(manifest).filter(([, group]) => Object.keys(group).length > 0)))),
      irSchemaVersion: 1,
    },
    ...Object.fromEntries(KIND_NAMES.map((name) => [KINDS[name].group, sortedByUrn(nodes.get(name)!)])),
  } as unknown as UniversalIR;
  return { success: true, ir };
}

/** Places each issue that has a manifest path at its line and column. */
export function locateIssues(issues: readonly IRIssue[], locator: ManifestLocator): IRIssue[] {
  return issues.map((issue) => {
    const location = issue.path && locator.locate(issue.path, issue.target);
    return location ? { ...issue, location } : issue;
  });
}

/**
 * Pass 1 (meta-schema) then passes 2–4, from manifest YAML source. Every issue carries its
 * line and column. On success the locator is returned too, so later stages (plugins) can
 * place their diagnostics.
 */
export function buildIrFromSource(source: string): IRBuildResult & { readonly locator?: ManifestLocator } {
  const validated = parseManifest(source);
  if (!validated.success) return { success: false, issues: validated.issues };
  const result = buildIr(validated.manifest);
  if (result.success) return { ...result, locator: validated.locator };
  return { success: false, issues: locateIssues(result.issues, validated.locator), locator: validated.locator };
}
