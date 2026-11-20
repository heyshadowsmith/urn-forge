/**
 * Structured diagnostics: stable codes, manifest line:col, URNs, and the text and JSON
 * renderings the CLI prints.
 */
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { main } from '../src/cli.js';
import { DIAGNOSTIC_CODES, diagnosticJson, formatDiagnostic, type Diagnostic } from '../src/diagnostics.js';
import { compile } from '../src/engine.js';

const repo = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const mathSource = readFileSync(repo('tests/fixtures/math.manifest.yaml'), 'utf8');

const HEADER = 'manifest:\n  namespace: demo\n  domain: math\n  version: 0.1.0\n';

/** Compiles a manifest body (after the 4-line header) and returns its diagnostics. */
function diagnose(body: string): readonly Diagnostic[] {
  return compile(`${HEADER}${body}`).diagnostics;
}

describe('manifest diagnostics', () => {
  it('place a bad short key at the key, without a URN', () => {
    expect(diagnose('Geometry.field.radius: { primitive: float }\n')).toEqual([
      expect.objectContaining({ code: 'invalid-key', location: { line: 5, column: 1 } }),
    ]);
    expect(diagnose('policy.invariant.positive: {}\n')[0]).toMatchObject({ code: 'unsupported-kind' });
    expect(diagnose('policy.widget.positive: {}\n')[0]).toMatchObject({ code: 'unknown-kind' });
  });

  it('place a bad value at the value and carry the URN', () => {
    expect(diagnose('geometry.field.radius:\n  primitive: float\n  min: abc\n')).toEqual([
      expect.objectContaining({
        code: 'invalid-value',
        urn: 'urn:demo:math:geometry:field:radius',
        location: { line: 7, column: 8 },
      }),
    ]);
    expect(diagnose('geometry.field.radius:\n  primitive: decimal\n')).toEqual([
      expect.objectContaining({ code: 'unknown-primitive', location: { line: 6, column: 14 } }),
    ]);
  });

  it('place an unknown property or constraint at its key', () => {
    expect(diagnose('geometry.field.radius:\n  primitive: float\n  minLength: 1\n')).toEqual([
      expect.objectContaining({ code: 'constraint-not-allowed', location: { line: 7, column: 3 } }),
    ]);
    const entity =
      'geometry.field.radius: { primitive: float }\n' +
      'geometry.entity.circle:\n  description: A circle\n  colour: red\n  fields: [{ ref: geometry.field.radius }]\n';
    expect(diagnose(entity)).toEqual([
      expect.objectContaining({ code: 'unknown-property', location: { line: 8, column: 3 } }),
    ]);
  });

  it('place a missing property at its entry', () => {
    expect(diagnose('geometry.field.radius: { primitive: float }\ngeometry.entity.circle:\n  fields: [{ ref: geometry.field.radius }]\n')).toEqual([
      expect.objectContaining({ code: 'invalid-value', location: { line: 6, column: 1 } }),
    ]);
  });

  it('place header problems inside the header', () => {
    expect(compile('manifest:\n  namespace: Demo\n  domain: math\n  version: 0.1.0\n').diagnostics).toEqual([
      expect.objectContaining({ code: 'invalid-value', location: { line: 2, column: 14 } }),
    ]);
    expect(compile('geometry.field.radius: { primitive: float }\n').diagnostics).toEqual([
      expect.objectContaining({ code: 'missing-header' }),
    ]);
    expect(compile('- just\n- a list\n').diagnostics).toEqual([expect.objectContaining({ code: 'not-a-mapping' })]);
  });

  it('place YAML errors, with duplicate keys as their own code', () => {
    const duplicate = diagnose('geometry.field.radius: { primitive: float }\ngeometry.field.radius: { primitive: float }\n');
    expect(duplicate).toEqual([expect.objectContaining({ code: 'duplicate-key', location: { line: 6, column: 1 } })]);
    expect(diagnose('geometry.field.radius: { primitive: float\n')[0]).toMatchObject({ code: 'yaml-syntax', location: expect.anything() });
  });

  it('place reference problems at the reference', () => {
    const body =
      'geometry.field.radius: { primitive: float }\n' +
      'geometry.entity.circle:\n' +
      '  description: A circle\n' +
      '  fields:\n' +
      '    - ref: geometry.field.radius\n' +
      '    - ref: geometry.field.diameter\n' +
      'geometry.operation.area:\n' +
      '  description: Area\n' +
      '  input: geometry.field.radius\n' +
      '  output: geometry.entity.circle\n';
    expect(diagnose(body)).toEqual([
      expect.objectContaining({ code: 'unresolved-ref', urn: 'urn:demo:math:geometry:entity:circle', location: { line: 10, column: 12 } }),
      expect.objectContaining({ code: 'wrong-ref-kind', urn: 'urn:demo:math:geometry:operation:area', location: { line: 13, column: 10 } }),
    ]);
  });

  it('place uniqueness problems at the entry key', () => {
    expect(diagnose('geo_metry.field.radius: { primitive: float }\ngeo.field.metry_radius: { primitive: float }\n')).toEqual([
      expect.objectContaining({ code: 'duplicate-brand', urn: 'urn:demo:math:geo_metry:field:radius', location: { line: 5, column: 1 } }),
    ]);
    const twice = 'geometry.field.size: { primitive: float }\ngeometry.entity.shape:\n  description: A shape\n  fields: [{ ref: geometry.field.size }, { ref: geometry.field.size }]\n';
    expect(diagnose(twice)).toEqual([expect.objectContaining({ code: 'duplicate-ref', location: { line: 8, column: 49 } })]);
  });

  it('place plugin diagnostics at the entry of their URN', () => {
    expect(diagnose('geometry.field.radius: { primitive: float }\ngeometry.field.radius_input: { primitive: float }\n')).toEqual([
      expect.objectContaining({ code: 'export-collision', location: { line: 6, column: 1 } }),
    ]);
  });

  it('leave the valid math manifest without diagnostics', () => {
    expect(compile(mathSource).diagnostics).toEqual([]);
  });
});

describe('rendering', () => {
  const diagnostic: Diagnostic = {
    code: 'unresolved-ref',
    severity: 'error',
    urn: 'urn:demo:math:geometry:entity:circle',
    location: { line: 10, column: 12 },
    message: 'urn:demo:math:geometry:entity:circle: fields[1].ref "geometry.field.diameter" does not resolve',
  };

  it('formats text as file:line:col, severity, code and message', () => {
    expect(formatDiagnostic(diagnostic, 'domain.manifest.yaml')).toBe(
      'domain.manifest.yaml:10:12  error  unresolved-ref  urn:demo:math:geometry:entity:circle: fields[1].ref "geometry.field.diameter" does not resolve',
    );
    expect(formatDiagnostic({ code: 'missing-header', severity: 'error', message: 'manifest: missing header' }, 'm.yaml')).toBe(
      'm.yaml  error  missing-header  manifest: missing header',
    );
  });

  it('formats one flat JSON object per line', () => {
    expect(JSON.parse(diagnosticJson(diagnostic, 'domain.manifest.yaml', { gate: 3 }))).toEqual({
      type: 'diagnostic',
      gate: 3,
      severity: 'error',
      code: 'unresolved-ref',
      file: 'domain.manifest.yaml',
      line: 10,
      column: 12,
      urn: 'urn:demo:math:geometry:entity:circle',
      message: diagnostic.message,
    });
  });
});

describe('--format json', () => {
  let dir: string;
  let out: string[];
  let err: string[];
  const io = () => ({ cwd: dir, stdout: (l: string) => out.push(l), stderr: (l: string) => err.push(l) });
  const lines = () => out.map((l) => JSON.parse(l) as Record<string, unknown>);

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'urn-forge-json-'));
    out = [];
    err = [];
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('compile prints files and a result line', async () => {
    await writeFile(join(dir, 'domain.manifest.yaml'), mathSource);
    expect(await main(['compile', '--format', 'json'], io())).toBe(0);
    expect(err).toEqual([]);
    expect(lines()).toEqual([
      { type: 'file', path: 'src/generated/domain.runtime.generated.ts', changed: true },
      { type: 'file', path: 'src/generated/domain.schemas.generated.ts', changed: true },
      { type: 'result', ok: true, fingerprint: expect.stringMatching(/^sha256:/) },
    ]);
  });

  it('compile prints diagnostics with their location, and exits 1', async () => {
    await writeFile(join(dir, 'bad.yaml'), `${HEADER}geometry.field.radius: { primitive: decimal }\n`);
    expect(await main(['compile', '--manifest', 'bad.yaml', '--format', 'json'], io())).toBe(1);
    expect(err).toEqual([]);
    expect(lines()).toEqual([
      expect.objectContaining({ type: 'diagnostic', code: 'unknown-primitive', file: 'bad.yaml', line: 5, column: 37 }),
      { type: 'result', ok: false },
    ]);
  });

  it('compile reports an unreadable manifest as a diagnostic', async () => {
    expect(await main(['compile', '--manifest', 'nope.yaml', '--format', 'json'], io())).toBe(1);
    expect(lines()[0]).toMatchObject({ type: 'diagnostic', code: 'manifest-unreadable', file: 'nope.yaml' });
  });

  it('verify prints manifest diagnostics and a failed result when the manifest does not compile', async () => {
    await writeFile(join(dir, 'domain.manifest.yaml'), `${HEADER}geometry.field.radius: { primitive: decimal }\n`);
    expect(await main(['verify', '--format', 'json'], io())).toBe(1);
    expect(lines()).toEqual([
      expect.objectContaining({ type: 'diagnostic', code: 'unknown-primitive' }),
      { type: 'result', ok: false, failedGates: [] },
    ]);
  });

  it('rejects an unknown format as a usage error', async () => {
    expect(await main(['compile', '--format', 'xml'], io())).toBe(2);
    expect(err[0]).toContain('--format must be text or json');
  });
});

describe('docs/reference/diagnostics.md', () => {
  it('documents every diagnostic code', () => {
    const page = readFileSync(repo('../../docs/reference/diagnostics.md'), 'utf8');
    const missing = Object.keys(DIAGNOSTIC_CODES).filter((code) => !page.includes(`\`${code}\``));
    expect(missing).toEqual([]);
  });
});
