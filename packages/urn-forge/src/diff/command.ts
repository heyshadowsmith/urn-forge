/**
 * `urn-forge diff <old> <new>`: the changes between two manifests, and whether the version allows the
 * breaking ones. By semver, a breaking change is allowed in 0.x, in a pre-release (2.0.0-alpha.1), and
 * across a new major version; within one major version, it is an error.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { CliIo, Report } from '../cli.js';
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

export async function diffCommand(io: CliIo, report: Report, argv: readonly string[]): Promise<number> {
  const { positionals, values } = parseArgs({ args: [...argv], options: { report: { type: 'boolean' } }, allowPositionals: true, strict: true });
  if (positionals.length !== 2) {
    const message = 'diff takes two manifests: urn-forge diff <old manifest> <new manifest>';
    if (report.format === 'json') report.problem({ code: 'usage', severity: 'error', message });
    else io.stderr(message);
    return report.end(2, { changes: [] });
  }
  const sides = positionals.map((path) => {
    let text: string;
    try {
      text = readFileSync(resolve(io.cwd, path), 'utf8');
    } catch {
      report.problem({ code: 'manifest-unreadable', severity: 'error', file: path, message: 'the manifest does not exist' });
      return undefined;
    }
    const compiled = compileManifest(text);
    for (const d of compiled.diagnostics.filter((x) => x.severity === 'error')) report.problem({ code: d.code, severity: 'error', file: path, path: d.path, message: d.message });
    return compiled.model ? { model: compiled.model, applications: compiled.applications } : undefined;
  });
  const [old, next] = sides;
  if (!old || !next) {
    report.err('diff failed: a manifest does not compile');
    return report.end(1, { changes: [] });
  }
  const changes: Change[] = classify(old, next);
  for (const change of changes) report.out(`${change.class.padEnd(10)}  ${change.place}  ${change.message}`);
  const breaking = changes.filter((c) => c.class === 'breaking').length;
  const from = old.model.header.version;
  const to = next.model.header.version;
  const summary = `${changes.length} change(s), ${breaking} breaking, ${from} → ${to}`;
  const result = { from, to, breaking, changes };
  if (breaking === 0) {
    report.out(`diff passed: ${summary}`);
    return report.end(0, { ...result, allowed: true, why: 'no change is breaking' });
  }
  const { allowed, why } = allowsBreaking(from, to);
  if (allowed || values.report) {
    report.out(`diff passed: ${summary}: ${allowed ? `allowed, as ${why}` : `not allowed, as ${why} (reported only)`}`);
    return report.end(0, { ...result, allowed, why });
  }
  report.err(`diff failed: ${summary}: ${why}`);
  return report.end(1, { ...result, allowed, why });
}
