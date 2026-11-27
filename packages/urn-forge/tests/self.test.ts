/**
 * urn-forge's own contract is the source of truth of its vocabulary (decisions 6 and 13 of the plan of
 * urn-forge's own contract). Each list of self/ equals its source in the package, and each page names
 * each item of it, and no item that it does not have. The version of self/ is the version of the
 * package.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { FUNCTIONS } from '../src/cel/functions.js';
import { CODES } from '../src/codes.js';
import { STEPS } from '../src/gherkin/steps.js';
import { standard } from '../src/rules.js';
import { GATES } from '../src/verify/types.js';
import { brokenBy } from '../src/self.js';
import { check as selfCheck } from '../self/generated/domain.generated.js';
import { readdirSync } from 'node:fs';

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const self = parse(read('self/domain.manifest.yaml')) as {
  manifest: { version: string };
  definitions: Record<string, { rules?: (string | Record<string, unknown>)[] }>;
};
/** The choices of the enum of a definition of self/. */
const choices = (definition: string): string[] => {
  const rule = self.definitions[definition]?.rules?.find((r): r is { enum: string[] } => typeof r === 'object' && 'enum' in r);
  if (!rule) throw new Error(`${definition} has no enum in self/`);
  return rule.enum;
};

const AGENTS = read('AGENTS.md');
const SKILL = read('skills/urn-forge/SKILL.md');
const CLI = read('../../docs/reference/cli.md');
const SYNTAX = read('../../docs/reference/syntax.md');
const MANIFEST = read('../../docs/reference/manifest.md');

/** The part of a page from a heading to the next heading of its level. */
const section = (page: string, heading: string): string => {
  const start = page.indexOf(`\n${heading}\n`);
  if (start < 0) throw new Error(`no heading ${heading}`);
  const level = heading.split(' ')[0]!;
  const next = page.indexOf(`\n${level} `, start + heading.length + 2);
  return page.slice(start, next < 0 ? undefined : next);
};

describe('the vocabulary of self/', () => {
  it('is the vocabulary of the package', () => {
    expect(choices('code')).toEqual(Object.keys(CODES));
    expect(choices('standard_rule_name')).toEqual(Object.keys(standard().rules));
    expect(choices('function_name')).toEqual(Object.keys(FUNCTIONS));
    expect(choices('step_kind')).toEqual(Object.keys(STEPS));
    expect(choices('gate_name')).toEqual([...GATES]);
  });

  it('has the version of the package', () => {
    expect(self.manifest.version).toBe((JSON.parse(read('package.json')) as { version: string }).version);
  });

  it('is named on each page, item by item', () => {
    for (const code of choices('code')) {
      expect(AGENTS, `AGENTS.md: ${code}`).toContain(`\`${code}\``);
      expect(SKILL, `SKILL.md: ${code}`).toContain(`\`${code}\``);
      expect(CLI, `cli.md: ${code}`).toContain(`\`${code}\``);
    }
    for (const rule of choices('standard_rule_name')) {
      expect(AGENTS, `AGENTS.md: ${rule}`).toContain(`\`${rule}\``);
      expect(MANIFEST, `manifest.md: ${rule}`).toContain(`\`${rule}\``);
    }
    for (const fn of choices('function_name')) {
      const named = new RegExp(`[\`.]${fn.replace('.', '\\.')}[\`(]`);
      expect(AGENTS, `AGENTS.md: ${fn}`).toMatch(named);
      expect(SYNTAX, `syntax.md: ${fn}`).toMatch(named);
    }
    for (const gate of choices('gate_name')) expect(CLI, `cli.md: ${gate}`).toContain(gate);
  });

  it('is the only vocabulary that the pages name', () => {
    const codes = new Set(choices('code'));
    // Each row of a table of codes names one code first.
    const rows = (text: string): string[] => [...text.matchAll(/^\| `([a-z][a-z-]*)` \|/gm)].map((m) => m[1]!);
    for (const code of rows(section(AGENTS, '## The codes'))) expect(codes.has(code), `AGENTS.md names ${code}`).toBe(true);
    for (const code of rows(section(CLI, '## Diagnostics'))) expect(codes.has(code), `cli.md names ${code}`).toBe(true);
    // The skill lists the codes of each area in one row: each name with a hyphen, or a single word that is a code.
    for (const line of SKILL.split('\n').filter((l) => l.startsWith('| The ') && l.includes('`'))) {
      for (const [, name] of line.matchAll(/`([a-z][a-z-]*)`/g)) expect(codes.has(name!), `SKILL.md names ${name}`).toBe(true);
    }
  });
});

describe('urn-forge through its own harness', () => {
  // The functions of the operations of self/ that the shell of urn-forge uses. The shell calls them only
  // with decide() of src/self.ts, which runs them through the harness of self/.
  const DECLARED = ['fixOf', 'allowsWeaker', 'allowsBreaking', 'gatePasses'];
  const SHELL = ['src/cli.ts', 'src/diff/command.ts', ...readdirSync(new URL('../src/verify/', import.meta.url)).map((f) => `src/verify/${f}`)];

  it('calls no declared decision but through the harness', () => {
    const direct: string[] = [];
    for (const file of SHELL) {
      read(file)
        .split('\n')
        .forEach((line, i, lines) => {
          // A definition, and a line marked "self:" or after such a comment, is the implementation, not a call.
          if (/^\s*(export )?function /.test(line) || /\/\/ self:/.test(lines[i - 1] ?? '') || /\/\/ self:/.test(line)) return;
          for (const name of DECLARED) if (new RegExp(`(?<![\\w.])${name}\\(`).test(line)) direct.push(`${file}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(direct).toEqual([]);
  });
});

describe('the results in self/', () => {
  const booking = {
    reference: 'ABCDEFGH',
    party_size: 4,
    state: 'confirmed',
    starts_at: '2026-11-24T19:00:00Z',
    ends_at: '2026-11-24T21:00:00Z',
    contact: { email: 'ada@example.com' },
  };
  const kept = (definition: 'check_accepted' | 'check_refused' | 'call_answered' | 'call_refused', value: unknown): string[] => {
    const result = selfCheck(definition, value);
    return result.ok ? [] : result.failures.map((f) => `${f.rule} of ${f.definition} at ${f.path}`);
  };

  it('are the results of a generated file', async () => {
    const { core } = await import('./fixtures/booking/core.js');
    const generated = await import('./fixtures/booking/generated/domain.generated.js');
    expect(kept('check_accepted', generated.check('booking', booking))).toEqual([]);
    expect(kept('check_refused', generated.check('booking', { ...booking, party_size: 0 }))).toEqual([]);
    expect(kept('call_answered', generated.runOperation(core, 'seat_booking', { reference: 'ABCDEFGH', stored_booking: booking }))).toEqual([]);
    expect(kept('call_refused', generated.runOperation(core, 'seat_booking', { reference: 'ABCDEFGH' }))).toEqual([]);
    const other = { seat_booking: () => ({ output: 'receipt', value: {} }) } as never;
    expect(kept('call_refused', generated.runOperation(other, 'seat_booking', { reference: 'ABCDEFGH', stored_booking: booking }))).toEqual([]);
  });

  it('stop a report of a command that breaks them', () => {
    expect(brokenBy('verify_report', { ok: false, problems: [] })).toBeUndefined();
    const error = { code: 'drift', severity: 'error', message: 'M', fix: 'F' };
    expect(brokenBy('verify_report', { ok: true, problems: [error] })).toMatch(/^urn-forge broke its own contract: an_error_fails of verify_report/);
    expect(brokenBy('compile_report', { ok: false, problems: [{ ...error, file: null }] })).toMatch(/at problems\[0\]\.file/);
  });
});
