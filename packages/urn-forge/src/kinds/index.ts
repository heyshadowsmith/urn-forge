/**
 * The kind registry. To add a kind: add its name to `KindName` (types.ts), write its
 * descriptor module, add it here, and add its group to `UniversalIR` and `ValidManifest`.
 * `tsc` checks that the registry covers every name and that the groups match the IR.
 */
import type { ManifestPath } from '../diagnostics.js';
import type { UniversalIR } from '../ir/types.js';
import { entity } from './entity.js';
import { field } from './field.js';
import { operation } from './operation.js';
import type { KindDescriptor, KindName, ReferenceSlot } from './types.js';

// `any` for the entry type: it is both produced (schema) and consumed (build), so no narrower wildcard fits.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const KINDS = { field, entity, operation } as const satisfies { readonly [K in KindName]: KindDescriptor<K, any, unknown> };

/** In the order diagnostics list them. */
export const KIND_NAMES = Object.keys(KINDS) as KindName[];

/**
 * Kinds in spec v1.1 that the compiler does not support yet; their keys get "not supported
 * yet". Typed so that a kind added to `KindName` must also leave this list.
 */
export const NOT_YET_SUPPORTED_KINDS = ['invariant', 'event', 'error'] as const satisfies readonly Exclude<
  'invariant' | 'event' | 'error',
  KindName
>[];

export type KindGroup = (typeof KINDS)[KindName]['group'];

/** The validated entry type of a kind, from its descriptor's schema. */
export type DeclOf<K extends KindName> = (typeof KINDS)[K] extends KindDescriptor<K, infer D, unknown, string> ? D : never;

// The groups must be exactly the IR's node records, so the generic builder fills every one.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const groupsMatchIr: Same<KindGroup, Exclude<keyof UniversalIR, 'meta'>> = true;
void groupsMatchIr;

/** "a field", "an entity or a field". */
export function namedKinds(kinds: readonly KindName[]): string {
  return kinds.map((k) => `${KINDS[k].article} ${k}`).join(' or ');
}

export function isKindName(name: string): name is KindName {
  return Object.hasOwn(KINDS, name);
}

/** A descriptor without its entry and node types, for the generic passes. */
export function kind(name: KindName): KindDescriptor<KindName, unknown, unknown> {
  return KINDS[name] as unknown as KindDescriptor<KindName, unknown, unknown>;
}

/** One concrete reference in an entry: where it is, how messages name it, and the short key it holds. */
export interface ReferenceOccurrence {
  /** Relative to the entry, with list indexes filled in: `['fields', 0, 'ref']`. */
  readonly path: ManifestPath;
  /** `fields[0].ref`, `input`. */
  readonly label: string;
  readonly shortKey: string;
  readonly targets: readonly KindName[];
}

/** Expands each slot's `'*'` segments over the entry's lists and collects the short keys found. */
export function referenceOccurrences(slots: readonly ReferenceSlot[], decl: unknown): ReferenceOccurrence[] {
  const found: ReferenceOccurrence[] = [];
  const walk = (value: unknown, rest: readonly string[], path: (string | number)[], slot: ReferenceSlot) => {
    if (rest.length === 0) {
      if (typeof value === 'string') found.push({ path, label: referenceLabel(path), shortKey: value, targets: slot.targets });
      return;
    }
    const [head, ...tail] = rest as [string, ...string[]];
    if (head === '*') {
      if (Array.isArray(value)) value.forEach((item, i) => walk(item, tail, [...path, i], slot));
    } else if (typeof value === 'object' && value !== null && Object.hasOwn(value, head)) {
      walk((value as Record<string, unknown>)[head], tail, [...path, head], slot);
    }
  };
  for (const slot of slots) walk(decl, slot.path, [], slot);
  return found;
}

/** `['fields', 0, 'ref']` → `fields[0].ref`. */
export function referenceLabel(path: ManifestPath): string {
  return path.map((segment, i) => (typeof segment === 'number' ? `[${segment}]` : i === 0 ? segment : `.${segment}`)).join('');
}

export type { Atom, BuildContext, KindDescriptor, KindName, ReferenceSlot } from './types.js';
