/**
 * `urn-forge init`: writes a starter project into the current directory, from
 * templates/starter/. The starter is a small domain (split a bill) with a field, entities,
 * an operation, a declared error and scenarios that cover every boundary, so `verify`
 * passes with no warning before the first change.
 *
 * It writes no file when a starter file exists already. It makes package.json an ES module
 * package with three scripts, and keeps every other value of an existing package.json.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEGMENT_PATTERN } from './grammar.js';

const TEMPLATE_DIR = fileURLToPath(new URL('../templates/starter/', import.meta.url));

export const STARTER_SCRIPTS = {
  compile: 'urn-forge compile',
  verify: 'urn-forge verify',
  'test:features': 'cucumber-js',
} as const;

export interface InitOptions {
  readonly cwd: string;
  readonly namespace: string;
  readonly domain: string;
}

export type InitResult =
  | { readonly ok: true; readonly lines: readonly string[] }
  | { readonly ok: false; readonly message: string };

/** Why a `--namespace` or `--domain` value is not a URN segment, or undefined. */
export function segmentProblem(flag: string, value: string): string | undefined {
  return SEGMENT_PATTERN.test(value)
    ? undefined
    : `${flag} "${value}" must be lowercase snake_case that starts with a letter (max 63 characters)`;
}

/** The template files, as sorted POSIX paths relative to the template directory. */
async function templateFiles(): Promise<string[]> {
  const entries = await readdir(TEMPLATE_DIR, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => relative(TEMPLATE_DIR, join(e.parentPath, e.name)).split('\\').join('/'))
    .sort();
}

async function exists(path: string): Promise<boolean> {
  return readFile(path).then(
    () => true,
    () => false,
  );
}

export async function initProject(options: InitOptions): Promise<InitResult> {
  const files = await templateFiles();
  const at = (path: string) => join(options.cwd, ...path.split('/'));

  const present = [];
  for (const path of files) if (await exists(at(path))) present.push(path);
  if (present.length > 0) {
    return { ok: false, message: `init writes no file, because these files exist: ${present.join(', ')}` };
  }

  // package.json: an ES module package, with the starter scripts where the names are free.
  const packagePath = at('package.json');
  const existing = await readFile(packagePath, 'utf8').catch(() => undefined);
  let pkg: Record<string, unknown>;
  if (existing === undefined) {
    pkg = { name: basename(options.cwd).toLowerCase(), private: true };
  } else {
    try {
      pkg = JSON.parse(existing) as Record<string, unknown>;
    } catch (error) {
      return { ok: false, message: `init cannot read package.json: ${(error as Error).message}` };
    }
  }
  if (pkg['type'] !== undefined && pkg['type'] !== 'module') {
    return {
      ok: false,
      message: `init needs an ES module package, but package.json has "type": ${JSON.stringify(pkg['type'])}; the generated code and the steps use import`,
    };
  }
  pkg['type'] = 'module';
  const scripts = (pkg['scripts'] ?? {}) as Record<string, string>;
  for (const [name, command] of Object.entries(STARTER_SCRIPTS)) scripts[name] ??= command;
  pkg['scripts'] = scripts;

  const lines: string[] = [];
  for (const path of files) {
    const text = (await readFile(join(TEMPLATE_DIR, ...path.split('/')), 'utf8'))
      .replaceAll('{{namespace}}', options.namespace)
      .replaceAll('{{domain}}', options.domain);
    await mkdir(dirname(at(path)), { recursive: true });
    await writeFile(at(path), text, 'utf8');
    lines.push(`wrote      ${path}`);
  }
  await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  lines.push(`${existing === undefined ? 'wrote     ' : 'updated   '} package.json`);
  return { ok: true, lines };
}
