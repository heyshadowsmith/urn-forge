/**
 * What the commands load (planning/startup-plan.md): --help and --version load no compiler and no test
 * runner, and src and self have no runtime import cycle. A timing test would be flaky on a shared
 * machine; what loads is exact, and a new static import that undoes the gain fails here.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

/** A finding of the plan that is not fixed yet: it.fails until its step, then it. */
const target = { lazy: it.fails, acyclic: it.fails };

const PACKAGE = fileURLToPath(new URL('..', import.meta.url));
const BIN = join(PACKAGE, 'bin/urn-forge.js');
const work = mkdtempSync(join(tmpdir(), 'urn-forge-startup-'));
let traces = 0;
afterAll(() => rmSync(work, { recursive: true, force: true }));

/** The URL of each module that the binary resolves for these arguments, through a resolve hook. */
function loaded(args: readonly string[]): string[] {
  const trace = join(work, `trace-${(traces += 1)}.txt`);
  const hook = join(work, 'hook.mjs');
  writeFileSync(
    hook,
    "import { registerHooks } from 'node:module';\nimport { appendFileSync } from 'node:fs';\n" +
      'registerHooks({ resolve(specifier, context, next) { const result = next(specifier, context); appendFileSync(process.env.URN_FORGE_TRACE, `${result.url}\\n`); return result; } });\n',
  );
  writeFileSync(trace, '');
  spawnSync(process.execPath, ['--import', hook, BIN, ...args], { cwd: work, encoding: 'utf8', env: { ...process.env, URN_FORGE_TRACE: trace } });
  return readFileSync(trace, 'utf8').split('\n').filter((l) => l !== '');
}

const heavy = (urls: readonly string[]): string[] => [...new Set(urls.filter((u) => /\/node_modules\/(typescript|@cucumber\/cucumber)\//.test(u)).map((u) => /\/node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(u)![1]!))];

describe('what a command loads', () => {
  it('records the modules that a command loads', () => {
    expect(heavy(loaded(['verify', '--config', join(PACKAGE, 'self/urn-forge.config.ts')]))).toContain('typescript');
  });

  for (const args of [['--help'], ['--version'], [], ['build']]) {
    target.lazy(`loads no compiler and no test runner for ${args.join(' ') || 'no command'}`, () => {
      expect(heavy(loaded(args))).toEqual([]);
    });
  }
});

/** The static imports of a source file that load at run time: not `import type`, not a dynamic import. */
function runtimeImports(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const specifiers: string[] = [];
  for (const match of text.matchAll(/^(?:import|export)\s+(type\s+)?([^'";]*?)\s*from\s+['"]([^'"]+)['"]/gm)) {
    const [, typeOnly, clause, specifier] = match as unknown as [string, string | undefined, string, string];
    if (typeOnly) continue;
    // import { type A, type B } from … loads nothing either.
    const names = /^\{([^}]*)\}$/.exec(clause.trim())?.[1];
    if (names !== undefined && names.split(',').every((n) => n.trim() === '' || n.trim().startsWith('type '))) continue;
    if (specifier.startsWith('.')) specifiers.push(resolve(dirname(file), specifier.replace(/\.js$/, '.ts')));
  }
  for (const match of text.matchAll(/^import\s+['"](\.[^'"]+)['"]/gm)) specifiers.push(resolve(dirname(file), match[1]!.replace(/\.js$/, '.ts')));
  return specifiers;
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.d.ts'))
    .map((e) => join(e.parentPath, e.name))
    .filter((f) => !f.includes(`${join('self', 'features')}`));
}

describe('the import graph', () => {
  target.acyclic('has no runtime cycle in src and self', () => {
    const files = [...sources(join(PACKAGE, 'src')), ...sources(join(PACKAGE, 'self'))];
    const edges = new Map(files.map((f) => [f, runtimeImports(f).filter((t) => files.includes(t))]));
    const cycles: string[] = [];
    const state = new Map<string, 'open' | 'done'>();
    const visit = (file: string, path: string[]): void => {
      if (state.get(file) === 'done') return;
      if (state.get(file) === 'open') {
        cycles.push([...path.slice(path.indexOf(file)), file].map((f) => f.slice(PACKAGE.length)).join(' -> '));
        return;
      }
      state.set(file, 'open');
      for (const next of edges.get(file) ?? []) visit(next, [...path, file]);
      state.set(file, 'done');
    };
    for (const file of files) visit(file, []);
    expect(cycles).toEqual([]);
  });
});
