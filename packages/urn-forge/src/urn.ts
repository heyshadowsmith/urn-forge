/**
 * The URN of a domain and of each of its parts: `urn:<namespace>:<domain>` and
 * `urn:<namespace>:<domain>:<kind>:<name>`. The kinds are the three sections of a manifest. A part
 * is named by its URN wherever it is seen from outside its own manifest.
 */
import type { ManifestHeader } from './manifest.js';

export type UrnKind = 'definition' | 'rule' | 'operation';

/** The URN of a domain: `urn:demo:booking`. */
export function domainUrn(header: Pick<ManifestHeader, 'namespace' | 'domain'>): string {
  return `urn:${header.namespace}:${header.domain}`;
}

/** The URN of a part of a domain: `urn:demo:booking:definition:party_size`. */
export function partUrn(header: Pick<ManifestHeader, 'namespace' | 'domain'>, kind: UrnKind, name: string): string {
  return `${domainUrn(header)}:${kind}:${name}`;
}
