/**
 * IR builder: compilation passes 2–4 over a manifest that passed the meta-schema (spec §5).
 *
 *   2. Expansion: short keys become full URNs; brandIdentifier is derived.
 *   3. Uniqueness: no two atoms share a URN or a brandIdentifier; no entity has two
 *      properties with the same name.
 *   4. Referential integrity: every `ref` names a field, every `input`/`output` an entity.
 *
 * Passes 5–8 (cycles, rule typing, constraint coherence, lifecycle) are cut from the MVP.
 */
import type { ManifestLocator, ManifestPath } from '../diagnostics.js';
import {
  parseManifest,
  parseShortKey,
  type EntityDecl,
  type FieldDecl,
  type MvpKind,
  type OperationDecl,
  type ValidManifest,
} from '../meta-schema.js';
import { canonicalJson, compareCodeUnits, sha256Hex } from './canonical.js';
import type {
  IRBuildResult,
  IREntity,
  IRField,
  IRFieldRef,
  IRIssue,
  IROperation,
  UniversalIR,
  Urn,
} from './types.js';

interface Atom {
  readonly urn: Urn;
  readonly kind: MvpKind;
  readonly context: string;
  readonly identifier: string;
  readonly brandIdentifier: string;
}

/** PascalCase of `context` + `identifier`: (`policy`, `deductible_amount`) → `PolicyDeductibleAmount`. */
export function toBrandIdentifier(context: string, identifier: string): string {
  return `${context}_${identifier}`
    .split('_')
    .filter((part) => part.length > 0)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
}

function sortedByUrn<T>(record: Map<Urn, T>): Record<Urn, T> {
  const out = {} as Record<Urn, T>;
  for (const urn of [...record.keys()].sort(compareCodeUnits)) out[urn] = record.get(urn)!;
  return out;
}

function article(kind: MvpKind): string {
  return kind === 'entity' || kind === 'operation' ? 'an' : 'a';
}

/** Runs passes 2–4 and returns the sorted IR, or every issue found. */
export function buildIr(manifest: ValidManifest): IRBuildResult {
  const { header } = manifest;
  const prefix = `urn:${header.namespace}:${header.domain}`;
  const issues: IRIssue[] = [];

  // Pass 2: expansion. Short keys were validated by the meta-schema, so parsing cannot fail here.
  const expand = (shortKey: string): Atom | undefined => {
    const parsed = parseShortKey(shortKey);
    if (!parsed.ok) return undefined;
    const { context, kind, identifier } = parsed.value;
    return {
      urn: `${prefix}:${context}:${kind}:${identifier}` as Urn,
      kind,
      context,
      identifier,
      brandIdentifier: toBrandIdentifier(context, identifier),
    };
  };

  const declared = [
    ...Object.keys(manifest.fields),
    ...Object.keys(manifest.entities),
    ...Object.keys(manifest.operations),
  ];
  const atoms = declared
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

  // Pass 4: referential integrity, resolving a short-key reference to an atom of `expected` kind.
  // `path` locates the reference in the manifest, e.g. [`geometry.entity.circle`, 'fields', 0, 'ref'].
  const resolve = (
    from: Urn,
    where: string,
    path: ManifestPath,
    shortKey: string,
    expected: MvpKind,
  ): Atom | undefined => {
    const target = expand(shortKey);
    const atom = target && byUrn.get(target.urn);
    if (!target || !atom) {
      issues.push({
        code: 'unresolved-ref',
        urn: from,
        message: `${from}: ${where} "${shortKey}" does not resolve (no atom ${target?.urn ?? shortKey} in this manifest)`,
        path,
      });
      return undefined;
    }
    if (atom.kind !== expected) {
      issues.push({
        code: 'wrong-ref-kind',
        urn: from,
        message: `${from}: ${where} "${shortKey}" must name ${article(expected)} ${expected}, but ${atom.urn} is ${article(atom.kind)} ${atom.kind}`,
        path,
      });
      return undefined;
    }
    return atom;
  };

  const fields = new Map<Urn, IRField>();
  const entities = new Map<Urn, IREntity>();
  const operations = new Map<Urn, IROperation>();

  for (const atom of atoms) {
    if (byUrn.get(atom.urn) !== atom) continue; // duplicate, already reported
    const shortKey = `${atom.context}.${atom.kind}.${atom.identifier}`;

    if (atom.kind === 'field') {
      const { primitive, description, ...constraints } = manifest.fields[shortKey] as FieldDecl;
      fields.set(atom.urn, {
        urn: atom.urn,
        brandIdentifier: atom.brandIdentifier,
        primitive,
        constraints: constraints as Record<string, number>,
        ...(description === undefined ? {} : { description }),
      });
    } else if (atom.kind === 'entity') {
      const decl = manifest.entities[shortKey] as EntityDecl;
      const refs: IRFieldRef[] = [];
      const seenNames = new Map<string, Urn>();
      decl.fields.forEach((ref, index) => {
        const path = [shortKey, 'fields', index, 'ref'];
        const target = resolve(atom.urn, `fields[${index}].ref`, path, ref.ref, 'field');
        if (!target) return;
        const clash = seenNames.get(target.identifier);
        if (clash) {
          issues.push(
            clash === target.urn
              ? {
                  code: 'duplicate-ref',
                  urn: atom.urn,
                  message: `${atom.urn}: fields[${index}].ref lists ${target.urn} more than once`,
                  path,
                }
              : {
                  code: 'duplicate-property',
                  urn: atom.urn,
                  message: `${atom.urn}: fields[${index}].ref ${target.urn} and ${clash} both become property "${target.identifier}"`,
                  path,
                },
          );
          return;
        }
        seenNames.set(target.identifier, target.urn);
        refs.push({ field: target.urn, name: target.identifier, required: ref.required });
      });
      entities.set(atom.urn, {
        urn: atom.urn,
        brandIdentifier: atom.brandIdentifier,
        description: decl.description,
        fields: refs,
      });
    } else {
      const decl = manifest.operations[shortKey] as OperationDecl;
      const input = resolve(atom.urn, 'input', [shortKey, 'input'], decl.input, 'entity');
      const output = resolve(atom.urn, 'output', [shortKey, 'output'], decl.output, 'entity');
      if (input && output) {
        operations.set(atom.urn, {
          urn: atom.urn,
          brandIdentifier: atom.brandIdentifier,
          description: decl.description,
          input: input.urn,
          output: output.urn,
        });
      }
    }
  }

  if (issues.length > 0) return { success: false, issues };

  const ir: UniversalIR = {
    meta: {
      namespace: header.namespace,
      domain: header.domain,
      manifestVersion: header.version,
      stability: header.stability ?? 'stable',
      manifestHash: sha256Hex(canonicalJson(manifest)),
      irSchemaVersion: 1,
    },
    fields: sortedByUrn(fields),
    entities: sortedByUrn(entities),
    operations: sortedByUrn(operations),
  };
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
