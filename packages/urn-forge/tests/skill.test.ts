/**
 * The target of the plan of the Claude Code skill: the package ships skills/urn-forge/SKILL.md, init
 * writes it to .claude/skills/urn-forge/, and the skill names only commands, options, codes and paths
 * that exist. Each test is it.fails until its step.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { afterAll, describe, expect, it } from 'vitest';
import { main } from '../src/cli.js';
import { CODES } from '../src/codes.js';

/** A test of the target that does not pass yet: it.fails until its step is built, then it. */
const target = { skill: it, init: it.fails };

const PACKAGE = fileURLToPath(new URL('..', import.meta.url));
const SKILL = join(PACKAGE, 'skills/urn-forge/SKILL.md');
const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

async function run(cwd: string, argv: string[]): Promise<{ code: number; out: string[]; err: string[] }> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd, stdout: (t) => out.push(t), stderr: (t) => err.push(t) });
  return { code, out, err };
}

/** A new project made by init and compiled, with urn-forge linked as a dependency. */
async function project(): Promise<string> {
  const dir = mkdtempSync(join(PACKAGE, '.skill-'));
  dirs.push(dir);
  expect((await run(dir, ['init'])).code).toBe(0);
  mkdirSync(join(dir, 'node_modules'));
  symlinkSync(PACKAGE, join(dir, 'node_modules', 'urn-forge'), 'dir');
  expect((await run(dir, ['compile'])).code).toBe(0);
  return dir;
}

/** The frontmatter and the body of a SKILL.md. */
function split(text: string): { front: Record<string, unknown>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!m) throw new Error('SKILL.md does not start with a frontmatter between --- lines');
  return { front: parse(m[1]!) as Record<string, unknown>, body: m[2]! };
}

/** Names in backticks that are not codes, but have the shape of one. */
const NOT_CODES = new Set(['urn-forge', 'cucumber-js', 'date-time']);

describe('the skill', () => {
  target.skill('has a frontmatter that Claude Code can load', () => {
    const { front } = split(readFileSync(SKILL, 'utf8'));
    expect(front['name']).toBe('urn-forge');
    expect(typeof front['description']).toBe('string');
    expect((front['description'] as string).length).toBeLessThanOrEqual(1536);
    expect(front['description']).not.toMatch(/[<>]/);
    const pkg = JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf8')) as { files: string[] };
    expect(pkg.files).toContain('skills');
  });

  target.skill('names only commands, options and codes that exist, and each code', async () => {
    const text = readFileSync(SKILL, 'utf8');
    const usage = (await run(PACKAGE, ['--help'])).out.join('\n');
    for (const m of text.matchAll(/npx urn-forge (\w+)/g)) expect(usage, m[0]).toContain(`urn-forge ${m[1]}`);
    for (const m of text.matchAll(/(?<![\w-])--([a-z]+)\b/g)) expect(usage, m[0]).toContain(`--${m[1]}`);
    const named = new Set([...text.matchAll(/`([a-z]+(?:-[a-z]+)+)`/g)].map((m) => m[1]!).filter((name) => !NOT_CODES.has(name)));
    for (const name of named) expect(Object.keys(CODES), name).toContain(name);
    for (const code of Object.keys(CODES)) expect(text, code).toContain(`\`${code}\``);
  });

  target.skill('names only paths that exist in a project made by init', async () => {
    const dir = await project();
    const text = readFileSync(SKILL, 'utf8');
    const paths = [...text.matchAll(/`([^`\s*<]+)`/g)].map((m) => m[1]!).filter((p) => p.includes('/') || /\.(md|ts|yaml|json|feature)$/.test(p));
    expect(paths.length).toBeGreaterThan(3);
    for (const path of paths) expect(existsSync(join(dir, path)), path).toBe(true);
  });
});

describe('init', () => {
  target.init('writes the skill, and keeps one that exists', async () => {
    const dir = await project();
    expect(readFileSync(join(dir, '.claude/skills/urn-forge/SKILL.md'), 'utf8')).toBe(readFileSync(SKILL, 'utf8'));

    const own = mkdtempSync(join(PACKAGE, '.skill-'));
    dirs.push(own);
    mkdirSync(join(own, '.claude/skills/urn-forge'), { recursive: true });
    writeFileSync(join(own, '.claude/skills/urn-forge/SKILL.md'), 'our own\n');
    const { code, out } = await run(own, ['init']);
    expect(code).toBe(0);
    expect(out).toContain('kept       .claude/skills/urn-forge/SKILL.md (it exists: compare it with node_modules/urn-forge/skills/urn-forge/SKILL.md)');
    expect(readFileSync(join(own, '.claude/skills/urn-forge/SKILL.md'), 'utf8')).toBe('our own\n');
  });
});
