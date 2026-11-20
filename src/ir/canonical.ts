/**
 * Canonical JSON and fingerprints (spec §5, §6).
 *
 * Canonical JSON: object keys sorted by UTF-16 code unit (never locale), arrays in
 * their given order, no whitespace. Only plain JSON values are allowed, so a stray
 * `undefined`, `Map`, `Date` or non-finite number fails loudly instead of hashing
 * differently on another machine.
 */
import { createHash } from 'node:crypto';

/** Code-unit comparison, independent of locale. Use this for every sort that feeds output. */
export function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function canonicalJson(value: unknown): string {
  return serialize(value, '$');
}

function serialize(value: unknown, path: string): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`canonicalJson: non-finite number at ${path}`);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, i) => serialize(item, `${path}[${i}]`)).join(',')}]`;
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined) // absent optional properties, e.g. `description?`
      .sort(([a], [b]) => compareCodeUnits(a, b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${serialize(v, `${path}.${k}`)}`).join(',')}}`;
  }
  throw new TypeError(`canonicalJson: unsupported value of type ${typeof value} at ${path}`);
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Everything that changes generated output (spec §6). */
export interface FingerprintInputs {
  readonly ir: unknown;
  readonly config: unknown;
  readonly generatorVersion: string;
  readonly plugins: readonly { readonly name: string; readonly version: string }[];
}

/**
 * SHA-256 over the canonical IR, the resolved config, the urn-forge version and the
 * enabled plugin names and versions. Returns `sha256:<hex>` for the file header.
 */
export function fingerprint(inputs: FingerprintInputs): string {
  return `sha256:${sha256Hex(canonicalJson(inputs))}`;
}
