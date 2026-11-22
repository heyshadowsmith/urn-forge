/**
 * The plugin host: shared naming, plugin support declarations
 * checked by the engine, plugin requirements, and the config file.
 */
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main } from '../src/cli.js';
import { defineConfig, loadConfig, pluginEntries } from '../src/config.js';
import { compile, unsupportedConstructs } from '../src/engine.js';
import { buildIrFromSource } from '../src/ir/build.js';
import { handlerName, schemaNames } from '../src/naming.js';
import { DEFAULT_PLUGINS, PLUGINS } from '../src/plugins/index.js';
import type { CodegenPlugin } from '../src/plugins/plugin.interface.js';
import { PRIMITIVE_NAMES, constraintKeys } from '../src/primitives/index.js';

const repo = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const mathSource = readFileSync(repo('tests/fixtures/math/domain.manifest.yaml'), 'utf8');

function mathIr() {
  const built = buildIrFromSource(mathSource);
  if (!built.success) throw new Error('math fixture does not compile');
  return built.ir;
}

/** A plugin that emits nothing and declares the given support. */
function stub(supports: CodegenPlugin['supports'], extra: Partial<CodegenPlugin> = {}): CodegenPlugin {
  return { name: 'stub', version: '0.0.0', configSchema: PLUGINS.fcis.configSchema, supports, emit: () => ({ artifacts: [], diagnostics: [] }), ...extra };
}

describe('naming', () => {
  it('derives every generated name from the brand identifier', () => {
    expect(schemaNames('ArithmeticDivisor')).toEqual({
      schema: 'ArithmeticDivisorSchema',
      output: 'ArithmeticDivisor',
      input: 'ArithmeticDivisorInput',
    });
    expect(handlerName('ArithmeticSafeDivide')).toBe('ArithmeticSafeDivideHandler');
  });
});

describe('plugin support', () => {
  it('the valibot plugin declares exactly the registry: every primitive and constraint', () => {
    expect(PLUGINS.valibot.supports.constraints).toEqual(
      Object.fromEntries(PRIMITIVE_NAMES.map((p) => [p, constraintKeys(p)])),
    );
  });

  it('the shipped plugins handle the math fixture', () => {
    for (const { plugin } of DEFAULT_PLUGINS) expect(unsupportedConstructs(mathIr(), plugin)).toEqual([]);
  });

  it('reports each atom of a kind the plugin does not handle', () => {
    expect(unsupportedConstructs(mathIr(), stub({ kinds: ['field', 'entity'] })).map((d) => d.message)).toEqual([
      'urn:demo:math:arithmetic:operation:safe_divide: the stub plugin does not handle kind "operation"',
      'urn:demo:math:geometry:operation:compute_area: the stub plugin does not handle kind "operation"',
    ]);
  });

  it('reports primitives and constraints the plugin does not translate', () => {
    const plugin = stub({ kinds: ['field', 'entity', 'operation'], constraints: { integer: ['min'], string: [] } });
    expect(unsupportedConstructs(mathIr(), plugin).map((d) => [d.code, d.message])).toEqual(
      ['dividend', 'divisor', 'quotient', 'area', 'radius'].map(() => ['unsupported-construct', expect.stringContaining('does not handle primitive "float"')]),
    );
    const floats = stub({ kinds: ['field', 'entity', 'operation'], constraints: { float: ['min'] } });
    expect(unsupportedConstructs(mathIr(), floats).map((d) => d.message)).toEqual([
      'urn:demo:math:arithmetic:field:divisor: the stub plugin cannot translate constraint "notIn"',
    ]);
  });

  it('fails compile at the atom, before any plugin emits', () => {
    let emitted = false;
    const plugin = stub(
      { kinds: ['field', 'entity', 'operation'], constraints: { float: ['min'] } },
      { emit: () => ((emitted = true), { artifacts: [], diagnostics: [] }) },
    );
    const result = compile(mathSource, [...DEFAULT_PLUGINS, { plugin, config: {} }]);
    expect(result.files).toEqual([]);
    expect(emitted).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'unsupported-construct', urn: 'urn:demo:math:arithmetic:field:divisor', location: { line: 9, column: 1 } }),
    ]);
  });

  it('fails compile when a required plugin is not enabled', () => {
    const result = compile(mathSource, [{ plugin: PLUGINS.fcis, config: {} }]);
    expect(result.files).toEqual([]);
    expect(result.diagnostics).toEqual([
      { code: 'missing-plugin', severity: 'error', message: 'plugin fcis requires plugin valibot, which is not enabled' },
    ]);
  });
});

describe('config', () => {
  let dir: string;
  let out: string[];
  let err: string[];
  const io = () => ({ cwd: dir, stdout: (l: string) => out.push(l), stderr: (l: string) => err.push(l) });
  const write = async (path: string, content: string) => {
    await mkdir(join(dir, path, '..'), { recursive: true });
    await writeFile(join(dir, path), content);
  };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'urn-forge-config-'));
    out = [];
    err = [];
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('loads a TypeScript config written with defineConfig', async () => {
    const configModule = pathToFileURL(repo('src/config.ts')).href;
    await write('a.config.ts', `import { defineConfig } from '${configModule}';\nexport default defineConfig({ out: 'gen', plugins: ['valibot', ['fcis', {}]] });\n`);
    expect(await loadConfig(join(dir, 'a.config.ts'), 'a.config.ts')).toEqual({
      ok: true,
      config: { out: 'gen', plugins: ['valibot', ['fcis', {}]] },
    });
  });

  it('reports a config it cannot load, one with no default export, and unknown options', async () => {
    expect(await loadConfig(join(dir, 'missing.ts'), 'missing.ts')).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'config-unreadable', file: 'missing.ts' }],
    });
    await write('none.ts', 'export const config = {};\n');
    expect(await loadConfig(join(dir, 'none.ts'), 'none.ts')).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'config-invalid', message: 'config: the file must `export default` the config' }],
    });
    await write('empty.ts', 'export default { plugins: [] };\n');
    expect(await loadConfig(join(dir, 'empty.ts'), 'empty.ts')).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'config-invalid', message: 'config.plugins: must list one or more plugins' }],
    });
    await write('extra.ts', "export default { plugins: [['valibot', {}, 'extra'], 'fcis'] };\n");
    expect(await loadConfig(join(dir, 'extra.ts'), 'extra.ts')).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'config-invalid', message: 'config.plugins[0]: must be a plugin name or [name, config]' }],
    });
    await write('bad.ts', "export default { output: 'gen', manifest: 3, boundaryCoverage: 'strict' };\n");
    const bad = await loadConfig(join(dir, 'bad.ts'), 'bad.ts');
    expect(bad.ok ? [] : bad.diagnostics.map((d) => d.message)).toEqual([
      expect.stringMatching(/^config\.manifest: /),
      expect.stringMatching(/^config\.boundaryCoverage: Invalid type: Expected \("warn" \| "error"\)/),
      'config.output: unknown option "output"',
    ]);
  });

  it('turns the plugin list into engine entries, rejecting unknown and repeated plugins', () => {
    expect(pluginEntries(['valibot', ['fcis', {}]], 'c.ts')).toEqual({
      ok: true,
      entries: [
        { plugin: PLUGINS.valibot, config: {} },
        { plugin: PLUGINS.fcis, config: {} },
      ],
    });
    const bad = pluginEntries(['valibot', 'mysql' as never, 'valibot'], 'c.ts');
    expect(bad.ok ? [] : bad.diagnostics.map((d) => d.message)).toEqual([
      'config.plugins[1]: unknown plugin "mysql" (plugins: valibot, fcis, postgres)',
      'config.plugins[2]: plugin "valibot" is listed more than once',
    ]);
  });

  it('CLI: finds urn-forge.config.ts in the current directory, with paths relative to it', async () => {
    await write('domain/math.yaml', mathSource);
    await write('urn-forge.config.ts', "export default { manifest: 'domain/math.yaml', out: 'domain/gen' };\n");
    expect(await main(['compile'], io())).toBe(0);
    expect(out.slice(0, 2)).toEqual(['wrote      domain/gen/domain.runtime.generated.ts', 'wrote      domain/gen/domain.schemas.generated.ts']);
  });

  it('CLI: --config resolves paths from the config file, and flags override it', async () => {
    await write('project/math.yaml', mathSource);
    await write('project/c.ts', "export default { manifest: 'math.yaml', out: 'gen' };\n");
    expect(await main(['compile', '--config', 'project/c.ts'], io())).toBe(0);
    expect(out[0]).toBe('wrote      project/gen/domain.runtime.generated.ts');
    out.length = 0;
    expect(await main(['compile', '--config', 'project/c.ts', '--out', 'elsewhere'], io())).toBe(0);
    expect(out[0]).toBe('wrote      elsewhere/domain.runtime.generated.ts');
  });

  it('CLI: reports config problems with the config file, and exits 1', async () => {
    await write('urn-forge.config.ts', "export default { plugins: ['fcis'] };\n");
    await write('domain.manifest.yaml', mathSource);
    expect(await main(['compile'], io())).toBe(1);
    expect(err).toEqual(['urn-forge.config.ts  error  missing-plugin  plugin fcis requires plugin valibot, which is not enabled']);
    err.length = 0;
    expect(await main(['verify', '--config', 'nope.ts'], io())).toBe(1);
    expect(err[0]).toMatch(/^nope\.ts {2}error {2}config-unreadable {2}cannot load config/);
  });

  it('defineConfig types plugin names (checked by tsc)', () => {
    // @ts-expect-error mysql is not a plugin of this version
    const unknown = defineConfig({ plugins: ['mysql'] });
    expect(unknown).toBeDefined();
  });
});
