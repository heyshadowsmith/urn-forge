import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { buildIr, buildIrFromSource } from '../src/ir/build.js';
import type { UniversalIR } from '../src/ir/types.js';
import { validateManifest } from '../src/meta-schema.js';
import { VALIBOT_SCHEMAS_FILE, valibotPlugin } from '../src/plugins/valibot.plugin.js';
// The golden file is the plugin's output for the math fixture (asserted below), so
// exercising it at runtime and in `tsc` exercises the generated code.
import * as schemas from './golden/math/domain.schemas.generated.js';

const mathSource = readFileSync(
  fileURLToPath(new URL('./fixtures/math.manifest.yaml', import.meta.url)),
  'utf8',
);

function irFrom(doc: Record<string, unknown>): UniversalIR {
  const validated = validateManifest({ manifest: { namespace: 'demo', domain: 'math', version: '0.1.0' }, ...doc });
  if (!validated.success) throw new Error(validated.issues.map((i) => i.message).join('\n'));
  const built = buildIr(validated.manifest);
  if (!built.success) throw new Error(built.issues.map((i) => i.message).join('\n'));
  return built.ir;
}

function mathIr(): UniversalIR {
  const built = buildIrFromSource(mathSource);
  if (!built.success) throw new Error(built.issues.map((i) => i.message).join('\n'));
  return built.ir;
}

describe('valibot plugin', () => {
  it('matches the golden schemas file for the math fixture', async () => {
    const { artifacts, diagnostics } = valibotPlugin.emit(mathIr(), {});
    expect(diagnostics).toEqual([]);
    expect(artifacts.map((a) => a.relativePath)).toEqual([VALIBOT_SCHEMAS_FILE]);
    await expect(artifacts[0]!.content).toMatchFileSnapshot(`./golden/math/${VALIBOT_SCHEMAS_FILE}`);
  });

  it('is deterministic', () => {
    expect(valibotPlugin.emit(mathIr(), {})).toEqual(valibotPlugin.emit(mathIr(), {}));
  });

  it('rejects divisor: 0 and accepts divisor: 2', () => {
    const rejected = v.safeParse(schemas.ArithmeticDivisionSchema, { dividend: 1, divisor: 0 });
    expect(rejected.success).toBe(false);
    expect(rejected.issues?.map((issue) => v.getDotPath(issue))).toEqual(['divisor']);

    const accepted = v.safeParse(schemas.ArithmeticDivisionSchema, { dividend: 1, divisor: 2 });
    expect(accepted).toMatchObject({ success: true, output: { dividend: 1, divisor: 2 } });
  });

  it('enforces min, finiteness and required keys', () => {
    expect(v.safeParse(schemas.GeometryCircleSchema, { radius: -1 }).success).toBe(false);
    expect(v.safeParse(schemas.GeometryCircleSchema, { radius: Infinity }).success).toBe(false);
    expect(v.safeParse(schemas.GeometryCircleSchema, {}).success).toBe(false);
    expect(v.safeParse(schemas.GeometryCircleSchema, { radius: 0 }).success).toBe(true);
  });

  it('brands outputs so plain values are not assignable', () => {
    const parsed = v.parse(schemas.ArithmeticDivisorSchema, 2);
    const ok: schemas.ArithmeticDivisor = parsed;
    // @ts-expect-error a plain number is not a branded ArithmeticDivisor
    const bad: schemas.ArithmeticDivisor = 2;
    // Input types stay unbranded.
    const input: schemas.ArithmeticDivisionInput = { dividend: 1, divisor: 2 };
    expect([ok, bad, input]).toBeDefined();
  });

  it('translates integer, string and optional refs', () => {
    const ir = irFrom({
      'shop.field.quantity': { primitive: 'integer', min: 1, max: 99 },
      'shop.field.note': { primitive: 'string', minLength: 1, maxLength: 140, description: 'Free text' },
      'shop.entity.line': {
        description: 'An order line',
        fields: [{ ref: 'shop.field.quantity' }, { ref: 'shop.field.note', required: false }],
      },
    });
    const content = valibotPlugin.emit(ir, {}).artifacts[0]!.content;
    expect(content).toContain(
      [
        'export const ShopQuantitySchema = v.pipe(',
        '  v.number(),',
        '  v.safeInteger(),',
        '  v.minValue(1),',
        '  v.maxValue(99),',
        '  v.brand("urn:demo:math:shop:field:quantity"),',
        ');',
      ].join('\n'),
    );
    expect(content).toContain('/** urn:demo:math:shop:field:note — Free text */');
    expect(content).toContain('  v.minLength(1),\n  v.maxLength(140),\n');
    expect(content).toContain('  quantity: ShopQuantitySchema,\n  note: v.optional(ShopNoteSchema),\n');
  });

  it('reports a generated export name collision, naming the URN', () => {
    const { artifacts, diagnostics } = valibotPlugin.emit(
      irFrom({
        'geometry.field.radius': { primitive: 'float' },
        'geometry.field.radius_input': { primitive: 'float' },
      }),
      {},
    );
    expect(artifacts).toEqual([]);
    expect(diagnostics).toEqual([
      {
        code: 'export-collision',
        severity: 'error',
        urn: 'urn:demo:math:geometry:field:radius_input',
        message:
          'urn:demo:math:geometry:field:radius_input: generated export "GeometryRadiusInput" collides ' +
          'with an export of urn:demo:math:geometry:field:radius; rename one of them',
      },
    ]);
  });
});
