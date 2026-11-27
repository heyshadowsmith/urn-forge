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
