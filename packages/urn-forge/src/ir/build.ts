/**
 * IR builder: compilation passes 2–4 and 7 over a manifest that passed the meta-schema.
 *
 *   2. Expansion: short keys become full URNs; brandIdentifier is derived.
 *   3. Uniqueness: no two atoms share a URN or a brandIdentifier.
 *   4. Referential integrity: every reference a kind declares (its `references` slots)
 *      resolves to an atom of an allowed kind.
 *   Then each kind builds its IR node from the resolved entry. Building runs the checks that
 *   belong to one kind: an entity's duplicate properties, and pass 7 (constraint coherence)
 *   for fields.
 *
 * Pass 6 runs in the kinds' `build` (src/kinds/). Pass 5 (structure) runs once every node
 * exists (structure.ts), and pass 8 (lifecycle) last (lifecycle.ts).
 */
import type { ManifestLocator, ManifestPath } from '../diagnostics.js';
import { KINDS, KIND_NAMES, kind, namedKinds, referenceOccurrences, type Atom, type KindName } from '../kinds/index.js';
import { parseManifest, parseShortKey, splitLifecycle, type LifecycleDecl, type ValidManifest } from '../meta-schema.js';
import { toBrandIdentifier, toUrn } from '../naming.js';
import { canonicalJson, compareCodeUnits, sha256Hex } from './canonical.js';
import { checkStructure } from './structure.js';
import type { Compatibility, IRBuildResult, IRIssue, Lifecycle, UniversalIR, Urn } from './types.js';
import { checkLifecycle, checkNotice, parseNotice, type Notice, type Reference } from './lifecycle.js';

function sortedByUrn<T>(record: Map<Urn, T>): Record<Urn, T> {
  const out = {} as Record<Urn, T>;
  for (const urn of [...record.keys()].sort(compareCodeUnits)) out[urn] = record.get(urn)!;
  return out;
}

export interface BuildOptions {
  /** The day that pass 8 compares sunset dates with (YYYY-MM-DD). Without it, sunset dates are not checked. */
  readonly referenceDate?: string;
}

/** Runs passes 2–8 and returns the sorted IR, or every issue found. */
export function buildIr(manifest: ValidManifest, options: BuildOptions = {}): IRBuildResult {
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

  // Pass 3: uniqueness of URN and brandIdentifier, reported in URN order. A URN is a
  // one-to-one function of its short key, and the keys of a mapping are unique (YAML reports
  // a repeated key as duplicate-key), so two atoms with one URN is a bug, not a manifest error.
  const byUrn = new Map<Urn, Atom>();
  const byBrand = new Map<string, Atom>();
  for (const atom of atoms) {
    const at = { path: [`${atom.context}.${atom.kind}.${atom.identifier}`], target: 'key' } as const;
    if (byUrn.has(atom.urn)) throw new Error(`internal error: ${atom.urn} expanded from two keys`);
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

  // The caller entity of the header: an entity of this manifest.
  let caller: Urn | undefined;
  if (header.caller !== undefined) {
    const path: ManifestPath = ['manifest', 'caller'];
    const target = expand(header.caller);
    const atom = target && byUrn.get(target.urn);
    if (!atom) issues.push({ code: 'unresolved-ref', message: `manifest: caller "${header.caller}" does not resolve (no atom ${target?.urn ?? header.caller} in this manifest)`, path });
    else if (atom.kind !== 'entity') issues.push({ code: 'wrong-ref-kind', message: `manifest: caller "${header.caller}" must name an entity, but ${atom.urn} is ${namedKinds([atom.kind])}`, path });
    else caller = atom.urn;
  }

  // How the contract changes.
  let compatibility: Compatibility | undefined;
  let notice: { text: string; value: Notice } | undefined;
  if (header.compatibility !== undefined) {
    const { callers, notice: text } = header.compatibility;
    const problem = (key: string, message: string) => issues.push({ code: 'invalid-compatibility', message: `manifest: compatibility.${key}: ${message}`, path: ['manifest', 'compatibility', key] });
    if (callers !== undefined && callers !== 'ignore-unknown') problem('callers', `"${callers}" is not a rule; write ignore-unknown`);
    const value = text === undefined ? undefined : parseNotice(text);
    if (text !== undefined && value === undefined) problem('notice', `"${text}" is not a time; write one such as 6 months or 180 days`);
    if (text !== undefined && value !== undefined) notice = { text, value };
    compatibility = { ...(callers === 'ignore-unknown' ? { callers } : {}), ...(notice ? { notice: notice.text } : {}) };
  }

  const nodes = new Map<KindName, Map<Urn, unknown>>(KIND_NAMES.map((name) => [name, new Map()]));
  /** Every resolved reference, for pass 8. */
  const references: Reference[] = [];
  /** Every atom with a lifecycle, for the notice. */
  const retiring = new Map<Urn, { lifecycle: Lifecycle; path: ManifestPath }>();

  // A kind that reads other nodes (`after`) builds once those kinds have built: its stage is one
  // more than the highest stage of the kinds it reads. An operation reads errors, which read events.
  const depth = (name: KindName): number => Math.max(-1, ...(kind(name).after ?? []).map(depth)) + 1;
  const stage = (atom: Atom) => depth(atom.kind);
  for (const atom of [...atoms].sort((a, b) => stage(a) - stage(b))) {
    if (byUrn.get(atom.urn) !== atom) continue; // duplicate, already reported
    const descriptor = kind(atom.kind);
    const shortKey = `${atom.context}.${atom.kind}.${atom.identifier}`;
    // The lifecycle keys are the same for every kind; the kind builds from its own keys only.
    const { lifecycle: lifecycleKeys, rest: decl } = splitLifecycle(groups[descriptor.group]?.[shortKey]);
    const life = lifecycleKeys as LifecycleDecl;

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
        references.push({ from: atom.urn, to: target.urn, path, label: occurrence.label });
      }
    }

    // supersededBy names an atom of the same kind, which is not the atom itself.
    let supersededBy: Urn | undefined;
    if (life.supersededBy !== undefined) {
      const path: ManifestPath = [shortKey, 'supersededBy'];
      const where = `${atom.urn}: supersededBy "${life.supersededBy}"`;
      const expanded = expand(life.supersededBy);
      const target = expanded && byUrn.get(expanded.urn);
      if (!target) {
        issues.push({ code: 'unresolved-ref', urn: atom.urn, message: `${where} does not resolve (no atom ${expanded?.urn ?? life.supersededBy} in this manifest)`, path });
      } else if (target.kind !== atom.kind) {
        issues.push({ code: 'wrong-ref-kind', urn: atom.urn, message: `${where} must name ${namedKinds([atom.kind])}, but ${target.urn} is ${namedKinds([target.kind])}`, path });
      } else if (target.urn === atom.urn) {
        issues.push({ code: 'invalid-lifecycle', urn: atom.urn, message: `${where} names the atom itself; name the atom that replaces it`, path });
      } else {
        supersededBy = target.urn;
      }
    }

    const node = descriptor.build({
      atom,
      shortKey,
      decl,
      ref: (path) => resolved.get(JSON.stringify(path)),
      report: (issue) => issues.push(issue),
      node: (name, urn) => nodes.get(name)!.get(urn),
      ...(caller ? { caller } : {}),
    });
    if (node === undefined) continue;
    // The IR has a lifecycle only for an atom that is not plain active.
    const status = life.status ?? 'active';
    const lifecycle: Lifecycle | undefined =
      status === 'active'
        ? undefined
        : { status, ...(supersededBy ? { supersededBy } : {}), ...(life.deprecatedOn ? { deprecatedOn: life.deprecatedOn } : {}), ...(life.sunsetDate ? { sunsetDate: life.sunsetDate } : {}) };
    if (lifecycle) retiring.set(atom.urn, { lifecycle, path: [shortKey, lifecycle.sunsetDate === undefined ? 'status' : 'sunsetDate'] });
    nodes.get(atom.kind)!.set(atom.urn, lifecycle ? { ...(node as object), lifecycle } : node);
  }

  if (issues.length > 0) return { success: false, issues };

  // Pass 5: structure across entities, once every node exists.
  const structure = checkStructure({
    fields: Object.fromEntries(nodes.get('field')!) as UniversalIR['fields'],
    entities: Object.fromEntries(nodes.get('entity')!) as UniversalIR['entities'],
    events: Object.fromEntries(nodes.get('event')!) as UniversalIR['events'],
    errors: Object.fromEntries(nodes.get('error')!) as UniversalIR['errors'],
  });
  if (structure.length > 0) return { success: false, issues: structure };

  // Pass 8: lifecycle, over every reference that pass 4 resolved.
  const statuses = new Map<Urn, Lifecycle | undefined>();
  for (const group of nodes.values()) for (const [urn, node] of group) statuses.set(urn, (node as { lifecycle?: Lifecycle }).lifecycle);
  const lifecycleIssues = [...checkLifecycle(references, statuses, options.referenceDate), ...checkNotice(retiring, notice, options.referenceDate)];
  if (lifecycleIssues.some((issue) => issue.severity !== 'warning')) return { success: false, issues: lifecycleIssues };

  const ir = {
    meta: {
      namespace: header.namespace,
      domain: header.domain,
      manifestVersion: header.version,
      stability: header.stability ?? 'stable',
      ...(caller ? { caller } : {}),
      ...(compatibility ? { compatibility } : {}),
      // Empty kind groups are left out, so the hash depends only on what the manifest says:
      // a kind added to urn-forge does not change the hash of a manifest that does not use it.
      manifestHash: sha256Hex(canonicalJson(Object.fromEntries(Object.entries(manifest).filter(([, group]) => Object.keys(group).length > 0)))),
      irSchemaVersion: 1,
    },
    ...Object.fromEntries(KIND_NAMES.map((name) => [KINDS[name].group, sortedByUrn(nodes.get(name)!)])),
  } as unknown as UniversalIR;
  return { success: true, ir, warnings: lifecycleIssues };
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
export function buildIrFromSource(source: string, options: BuildOptions = {}): IRBuildResult & { readonly locator?: ManifestLocator } {
  const validated = parseManifest(source);
  if (!validated.success) return { success: false, issues: validated.issues };
  const result = buildIr(validated.manifest, options);
  if (result.success) return { ...result, warnings: locateIssues(result.warnings ?? [], validated.locator), locator: validated.locator };
  return { success: false, issues: locateIssues(result.issues, validated.locator), locator: validated.locator };
}
