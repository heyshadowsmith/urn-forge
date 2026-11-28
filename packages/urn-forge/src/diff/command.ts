/**
 * `urn-forge diff <old> <new>`: the changes between two manifests, and whether the version allows the
 * breaking ones. By semver, a breaking change is allowed in 0.x, in a pre-release (2.0.0-alpha.1), and
 * across a new major version; within one major version, it is an error.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseOptions } from '../options.js';
import type { CliIo, Report } from '../cli.js';
import { compileManifest } from '../compile.js';
import { decide } from '../self.js';
import { classify, type Change } from './classify.js';

export { allowsBreaking } from './versions.js';
import { allowsBreaking } from './versions.js';

export async function diffCommand(io: CliIo, report: Report, argv: readonly string[]): Promise<number> {
  const { positionals, values } = parseOptions('diff', argv);
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
  const verdict = decide('judge_version_change', { from_version: from, to_version: to });
  const allowed = verdict.output === 'breaking_allowed';
  const why = verdict.value.reason;
  if (allowed || values.report) {
    report.out(`diff passed: ${summary}: ${allowed ? `allowed, as ${why}` : `not allowed, as ${why} (reported only)`}`);
    return report.end(0, { ...result, allowed, why });
  }
  report.err(`diff failed: ${summary}: ${why}`);
  return report.end(1, { ...result, allowed, why });
}
