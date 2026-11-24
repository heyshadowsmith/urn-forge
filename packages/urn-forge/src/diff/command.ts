/**
 * `urn-forge diff <old> <new>`: the changes between two manifests, and whether the version allows the
 * breaking ones. By semver, a breaking change is allowed in 0.x, in a pre-release (2.0.0-alpha.1), and
 * across a new major version; within one major version, it is an error.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { CliIo } from '../cli.js';
import { compileManifest } from '../compile.js';
import { classify, type Change } from './classify.js';

interface Version {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: boolean;
}

function parseVersion(text: string): Version {
  const [core = '', pre] = text.split('+')[0]!.split(/-(.*)/s);
  const [major = 0, minor = 0, patch = 0] = core.split('.').map(Number);
  return { major, minor, patch, prerelease: pre !== undefined && pre !== '' };
}

/** Whether the versions allow a breaking change, and why. */
export function allowsBreaking(from: string, to: string): { readonly allowed: boolean; readonly why: string } {
  const a = parseVersion(from);
  const b = parseVersion(to);
  if (b.major === 0) return { allowed: true, why: `${to} is a 0.x version, where anything may change` };
  if (b.prerelease) return { allowed: true, why: `${to} is a pre-release` };
  if (b.major > a.major) return { allowed: true, why: `${to} is a new major version` };
  return { allowed: false, why: `${from} → ${to} keeps the major version ${b.major}; a breaking change needs a new major version` };
}

export async function diffCommand(io: CliIo, argv: readonly string[]): Promise<number> {
  const { positionals, values } = parseArgs({ args: [...argv], options: { report: { type: 'boolean' } }, allowPositionals: true, strict: true });
  if (positionals.length !== 2) {
    io.stderr('diff takes two manifests: urn-forge diff <old manifest> <new manifest>');
    return 2;
  }
  const sides = positionals.map((path) => {
    let text: string;
    try {
      text = readFileSync(resolve(io.cwd, path), 'utf8');
    } catch {
      io.stderr(`${path}  error  manifest-unreadable  the manifest does not exist`);
      return undefined;
    }
    const compiled = compileManifest(text);
    for (const d of compiled.diagnostics.filter((x) => x.severity === 'error')) io.stderr(`${path}  error  ${d.code}  ${d.message}`);
    return compiled.model ? { model: compiled.model, applications: compiled.applications } : undefined;
  });
  const [old, next] = sides;
  if (!old || !next) {
    io.stderr('diff failed: a manifest does not compile');
    return 1;
  }
  const changes: Change[] = classify(old, next);
  for (const change of changes) io.stdout(`${change.class.padEnd(10)}  ${change.place}  ${change.message}`);
  const breaking = changes.filter((c) => c.class === 'breaking').length;
  const from = old.model.header.version;
  const to = next.model.header.version;
  const summary = `${changes.length} change(s), ${breaking} breaking, ${from} → ${to}`;
  if (breaking === 0) {
    io.stdout(`diff passed: ${summary}`);
    return 0;
  }
  const { allowed, why } = allowsBreaking(from, to);
  if (allowed || values.report) {
    io.stdout(`diff passed: ${summary}: ${allowed ? `allowed, as ${why}` : `not allowed, as ${why} (reported only)`}`);
    return 0;
  }
  io.stderr(`diff failed: ${summary}: ${why}`);
  return 1;
}
