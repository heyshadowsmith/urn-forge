/**
 * The contract corpus (contracts/ at the root of the repository): each contract is a list of
 * promises, each with a status. This checks the promises against `corpus.yaml` and the
 * manifest of each contract, and gives the score: the share of promises that are declared.
 *
 *   node --import tsx scripts/corpus.ts [<corpus folder>]
 *
 * Exits 1 when a promise is not valid or the score is below the minimum of `corpus.yaml`.
 * That a declared promise is enforced is the job of `urn-forge verify` with strict coverage
 * on each contract, which CI runs next to this.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const STATUSES = ['declared', 'workaround', 'not-declarable'] as const;
export type Status = (typeof STATUSES)[number];

export interface Promise {
  readonly contract: string;
  readonly id: string;
  readonly promise: string;
  readonly status?: Status;
  readonly by: readonly string[];
  readonly hole?: string;
}

export interface CorpusReport {
  /** Each problem: `<contract>.<id>: <what is wrong>`, or a file that is not valid. */
  readonly problems: readonly string[];
  readonly promises: readonly Promise[];
  readonly minimum: number;
  readonly holes: Readonly<Record<string, string>>;
}

/** The parsed file, or a problem: a promise file that is not YAML is reported, not thrown. */
function read(file: string, name: string, problems: string[]): unknown {
  try {
    return parse(readFileSync(file, 'utf8'));
  } catch (error) {
    problems.push(`${name}: not valid YAML: ${(error as Error).message.split('\n')[0]}`);
    return undefined;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * What a promise can name in by: each part of the manifest as `<section>.<name>`, such as
 * `definitions.party_size`, `rules.large_party_pays_deposit` or `operations.seat_booking`, and each
 * key of its header as `manifest.<key>`, such as `manifest.compatibility`.
 */
function shortKeys(path: string): ReadonlySet<string> | undefined {
  if (!existsSync(path)) return undefined;
  const document: unknown = parse(readFileSync(path, 'utf8'));
  if (!isRecord(document)) return new Set();
  const keys: string[] = [];
  for (const [section, value] of Object.entries(document)) {
    if (isRecord(value)) for (const name of Object.keys(value)) keys.push(`${section}.${name}`);
  }
  return new Set(keys);
}

/** Reads and checks the corpus in `root`. */
export function checkCorpus(root: string): CorpusReport {
  const problems: string[] = [];
  const config: unknown = parse(readFileSync(join(root, 'corpus.yaml'), 'utf8'));
  const minimum = isRecord(config) && typeof config.minimum === 'number' ? config.minimum : NaN;
  if (!(minimum >= 0 && minimum <= 100)) problems.push('corpus.yaml: minimum must be a number from 0 to 100');
  const holes: Record<string, string> = {};
  if (isRecord(config) && isRecord(config.holes)) for (const [id, text] of Object.entries(config.holes)) holes[id] = String(text);
  else problems.push('corpus.yaml: holes must map each hole ID to its name');

  const promises: Promise[] = [];
  const contracts = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
  for (const contract of contracts) {
    const file = join(root, contract, 'promises.yaml');
    if (!existsSync(file)) {
      problems.push(`${contract}: promises.yaml is missing`);
      continue;
    }
    const document = read(file, `${contract}/promises.yaml`, problems);
    if (document === undefined) continue;
    if (!isRecord(document) || document.contract !== contract || !isRecord(document.promises)) {
      problems.push(`${contract}/promises.yaml: needs contract: ${contract}, and promises`);
      continue;
    }
    const keys = shortKeys(join(root, contract, 'domain.manifest.yaml'));
    for (const [id, raw] of Object.entries(document.promises)) {
      const where = `${contract}.${id}`;
      if (!/^P\d{2,}$/.test(id)) problems.push(`${where}: an ID is P and two or more digits`);
      if (!isRecord(raw) || typeof raw.promise !== 'string' || raw.promise.trim() === '') {
        problems.push(`${where}: needs promise, one sentence`);
        continue;
      }
      const status = raw.status as Status | undefined;
      const by = Array.isArray(raw.by) ? raw.by.map(String) : [];
      const hole = raw.hole === undefined ? undefined : String(raw.hole);
      promises.push({ contract, id, promise: raw.promise, ...(status ? { status } : {}), by, ...(hole ? { hole } : {}) });

      if (status === undefined) problems.push(`${where}: has no status`);
      else if (!STATUSES.includes(status)) problems.push(`${where}: status "${String(status)}" is not one of ${STATUSES.join(', ')}`);
      if (raw.by !== undefined && !Array.isArray(raw.by)) problems.push(`${where}: by must be a list of parts of the manifest, such as definitions.<name>`);
      if ((status === 'declared' || status === 'workaround') && by.length === 0) problems.push(`${where}: a ${status} promise needs by, the parts that state it`);
      if (status === 'not-declarable' && by.length > 0) problems.push(`${where}: a not-declarable promise has no by`);
      if (by.length > 0 && keys === undefined) problems.push(`${where}: by names parts, but ${contract} has no domain.manifest.yaml`);
      for (const key of by) if (keys && !keys.has(key)) problems.push(`${where}: ${key} is not a part or a header key of ${contract}/domain.manifest.yaml`);
      if ((status === 'workaround' || status === 'not-declarable') && hole === undefined) problems.push(`${where}: a ${status} promise needs hole, the hole of the roadmap that would declare it`);
      if (status === 'declared' && hole !== undefined) problems.push(`${where}: a declared promise has no hole`);
      if (hole !== undefined && !Object.hasOwn(holes, hole)) problems.push(`${where}: hole ${hole} is not in corpus.yaml`);
    }
  }
  return { problems, promises, minimum, holes };
}

/** The share of declared promises, in percent with one decimal: a workaround counts 0. */
export function score(promises: readonly Promise[]): number {
  if (promises.length === 0) return 0;
  return Math.round((promises.filter((p) => p.status === 'declared').length / promises.length) * 1000) / 10;
}

/** The lines that CI prints. */
export function summary(report: CorpusReport): readonly string[] {
  const { promises, minimum } = report;
  const count = (status: Status) => promises.filter((p) => p.status === status).length;
  const byHole = new Map<string, number>();
  for (const p of promises) if (p.hole) byHole.set(p.hole, (byHole.get(p.hole) ?? 0) + 1);
  const holes = [...byHole].sort(([a, x], [b, y]) => y - x || a.localeCompare(b)).map(([h, n]) => `${h} ${n}`);
  const contracts = [...new Set(promises.map((p) => p.contract))];
  return [
    `contract corpus: ${count('declared')} of ${promises.length} promises declared (${score(promises).toFixed(1)}%), minimum ${minimum.toFixed(1)}%`,
    `  workaround      ${count('workaround')}`,
    `  not declarable  ${count('not-declarable')}`,
    `  by hole: ${holes.length > 0 ? holes.join(', ') : 'none'}`,
    ...contracts.map((c) => {
      const own = promises.filter((p) => p.contract === c);
      return `  ${c.padEnd(15)} ${String(own.filter((p) => p.status === 'declared').length).padStart(2)} of ${String(own.length).padStart(2)} declared`;
    }),
  ];
}

/** Runs the check, prints the summary, and returns the exit code. */
export function main(root: string, print: (line: string) => void = console.log): number {
  const report = checkCorpus(root);
  for (const line of summary(report)) print(line);
  for (const problem of report.problems) print(`error: ${problem}`);
  const below = score(report.promises) < report.minimum;
  if (below) print(`error: the score ${score(report.promises).toFixed(1)}% is below the minimum ${report.minimum.toFixed(1)}% of corpus.yaml`);
  return report.problems.length > 0 || below ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(resolve(process.argv[2] ?? fileURLToPath(new URL('../../../contracts', import.meta.url))));
}
