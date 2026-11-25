/**
 * `urn-forge init`: writes a starter project into a directory, from templates/starter/. The starter is
 * a small domain (split a bill) whose scenarios cover every operation, output and rule, so `verify`
 * passes with no warning before the first change. It writes no file when a starter file exists
 * already, except AGENTS.md and the skill, the instructions for coding agents: it keeps these when
 * they exist. It makes package.json an ES module package with three scripts, and keeps the rest of it.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAME } from './manifest.js';

const TEMPLATE_DIR = fileURLToPath(new URL('../templates/starter/', import.meta.url));
const SKILL = fileURLToPath(new URL('../skills/urn-forge/SKILL.md', import.meta.url));
const SKILL_FILE = '.claude/skills/urn-forge/SKILL.md';

/**
 * The instructions of a project for coding agents: init keeps a file that exists, and writes the
 * others. The value is what init says when it keeps the file.
 */
const INSTRUCTIONS = new Map([
  ['AGENTS.md', 'point it at node_modules/urn-forge/AGENTS.md'],
  [SKILL_FILE, 'compare it with node_modules/urn-forge/skills/urn-forge/SKILL.md'],
]);

export const STARTER_SCRIPTS = { compile: 'urn-forge compile', verify: 'urn-forge verify', 'test:features': 'cucumber-js' } as const;

export function nameProblem(flag: string, value: string): string | undefined {
  return NAME.test(value) ? undefined : `${flag} "${value}" must be lowercase snake_case that starts with a letter (at most 63 characters)`;
}

/** The files of the starter, by their path in the project, with their source: the templates, and the skill of the package. */
async function templateFiles(): Promise<Map<string, string>> {
  const entries = await readdir(TEMPLATE_DIR, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => [relative(TEMPLATE_DIR, join(e.parentPath, e.name)).split('\\').join('/'), join(e.parentPath, e.name)] as const);
  return new Map([...files, [SKILL_FILE, SKILL] as const].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

const exists = (path: string): Promise<boolean> => readFile(path).then(() => true, () => false);

export async function initProject(options: { readonly cwd: string; readonly namespace: string; readonly domain: string }): Promise<{ ok: true; lines: string[] } | { ok: false; message: string }> {
  const files = await templateFiles();
  const at = (path: string): string => join(options.cwd, ...path.split('/'));
  const present: string[] = [];
  for (const file of files.keys()) if (!INSTRUCTIONS.has(file) && (await exists(at(file)))) present.push(file);
  if (present.length > 0) return { ok: false, message: `init writes no file: these exist already: ${present.join(', ')}` };
  const lines: string[] = [];
  for (const [file, source] of files) {
    if (INSTRUCTIONS.has(file) && (await exists(at(file)))) {
      lines.push(`kept       ${file} (it exists: ${INSTRUCTIONS.get(file)})`);
      continue;
    }
    const text = (await readFile(source, 'utf8')).replaceAll('{{namespace}}', options.namespace).replaceAll('{{domain}}', options.domain);
    await mkdir(dirname(at(file)), { recursive: true });
    await writeFile(at(file), text);
    lines.push(`wrote      ${file}`);
  }
  const packagePath = at('package.json');
  const existing = await readFile(packagePath, 'utf8').then((t) => JSON.parse(t) as Record<string, unknown>, () => undefined);
  const pkg: Record<string, unknown> = existing ?? { name: basename(options.cwd).toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'app', private: true };
  pkg['type'] = 'module';
  pkg['scripts'] = { ...((pkg['scripts'] as Record<string, string> | undefined) ?? {}), ...STARTER_SCRIPTS };
  await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  lines.push(`${existing ? 'updated   ' : 'wrote     '} package.json`);
  return { ok: true, lines };
}
