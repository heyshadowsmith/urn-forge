import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { core } from '../example/core.js';
import { buildIrFromSource } from '../src/ir/build.js';
import type { UniversalIR } from '../src/ir/types.js';
import { FCIS_RUNTIME_FILE, fcisPlugin } from '../src/plugins/fcis.plugin.js';
// The math fixture's expected output (checked byte for byte by tests/fixtures.test.ts), so
// exercising it at runtime and in `tsc` exercises the generated code.
import {
  DispatchMap,
  executeOperation,
  ok,
  type DomainCoreImplementation,
} from './fixtures/math/expected/domain.runtime.generated.js';

const mathSource = readFileSync(
  fileURLToPath(new URL('./fixtures/math/domain.manifest.yaml', import.meta.url)),
  'utf8',
);

function mathIr(): UniversalIR {
  const built = buildIrFromSource(mathSource);
  if (!built.success) throw new Error(built.issues.map((i) => i.message).join('\n'));
  return built.ir;
}

const SAFE_DIVIDE = 'urn:demo:math:arithmetic:operation:safe_divide';
const COMPUTE_AREA = 'urn:demo:math:geometry:operation:compute_area';

describe('fcis plugin', () => {
  it('writes one runtime file (its exact content is checked by the fixture harness)', () => {
    const { artifacts, diagnostics } = fcisPlugin.emit(mathIr(), {});
    expect(diagnostics).toEqual([]);
    expect(artifacts.map((a) => a.relativePath)).toEqual([FCIS_RUNTIME_FILE]);
  });

  it('is deterministic', () => {
    expect(fcisPlugin.emit(mathIr(), {})).toEqual(fcisPlugin.emit(mathIr(), {}));
  });

  it('lists field metadata per operation in declaration order', () => {
    expect(Object.keys(DispatchMap)).toEqual([SAFE_DIVIDE, COMPUTE_AREA]);
    expect(DispatchMap[SAFE_DIVIDE].input.fields).toEqual({
      dividend: { urn: 'urn:demo:math:arithmetic:field:dividend', primitive: 'float', required: true },
      divisor: { urn: 'urn:demo:math:arithmetic:field:divisor', primitive: 'float', required: true },
    });
    expect(Object.keys(DispatchMap[SAFE_DIVIDE].output.fields)).toEqual(['quotient']);
  });
});

describe('executeOperation (generated) with example/core.ts', () => {
  it('runs safe_divide and returns parsed output', () => {
    expect(executeOperation(SAFE_DIVIDE, { dividend: 10, divisor: 2 }, core)).toEqual({
      ok: true,
      urn: SAFE_DIVIDE,
      output: { quotient: 5 },
      events: [],
    });
    expect(executeOperation(COMPUTE_AREA, { radius: 2 }, core)).toEqual({
      ok: true,
      urn: COMPUTE_AREA,
      output: { area: Math.PI * 4 },
      events: [],
    });
  });

  it('types the output by operation', () => {
    const result = executeOperation(SAFE_DIVIDE, { dividend: 10, divisor: 2 }, core);
    if (result.ok) {
      const quotient: number = result.output.quotient;
      // @ts-expect-error safe_divide has no `area` output
      expect([quotient, result.output.area]).toBeDefined();
    }
  });

  it('rejects a zero divisor at the boundary, tagged with the field URN', () => {
    const result = executeOperation(SAFE_DIVIDE, { dividend: 1, divisor: 0 }, core);
    expect(result).toMatchObject({ ok: false, kind: 'InputRejected', urn: SAFE_DIVIDE });
    expect(!result.ok && 'issues' in result && result.issues.map(({ path, fieldUrn }) => ({ path, fieldUrn }))).toEqual([
      { path: 'divisor', fieldUrn: 'urn:demo:math:arithmetic:field:divisor' },
    ]);
  });

  it('never calls the handler on rejected input', () => {
    let calls = 0;
    const spy = { ...core, [SAFE_DIVIDE]: () => (calls++, ok({ quotient: 0 })) } satisfies DomainCoreImplementation;
    executeOperation(SAFE_DIVIDE, { dividend: 1, divisor: 0 }, spy);
    expect(calls).toBe(0);
  });

  it('reports output that breaks the contract as a ContractViolation', () => {
    const broken = { ...core, [COMPUTE_AREA]: () => ok({ area: -1 }) } satisfies DomainCoreImplementation;
    const result = executeOperation(COMPUTE_AREA, { radius: 1 }, broken);
    expect(result).toMatchObject({
      ok: false,
      kind: 'ContractViolation',
      issues: [{ path: 'area', fieldUrn: 'urn:demo:math:geometry:field:area' }],
    });
  });

  it('reports a handler that does not return a Result as a ContractViolation', () => {
    const plain = { ...core, [COMPUTE_AREA]: () => ({ area: 1 }) } as unknown as DomainCoreImplementation;
    expect(executeOperation(COMPUTE_AREA, { radius: 1 }, plain)).toMatchObject({
      ok: false,
      kind: 'ContractViolation',
      issues: [{ path: '', message: expect.stringContaining('did not return a Result') }],
    });
  });

  it('reports unknown operations, including prototype keys', () => {
    for (const urn of ['urn:demo:math:arithmetic:operation:multiply', 'toString', '__proto__']) {
      expect(executeOperation(urn, {}, core)).toMatchObject({ ok: false, kind: 'UnknownOperation', urn });
    }
  });
});

describe('DomainCoreImplementation (type level, checked by tsc)', () => {
  it('rejects a missing handler, a mistyped output, a plain return and an extra handler', () => {
    const area = core[COMPUTE_AREA];
    // @ts-expect-error the safe_divide handler is missing
    const missing = { [COMPUTE_AREA]: area } satisfies DomainCoreImplementation;
    const mistyped = {
      [COMPUTE_AREA]: area,
      // @ts-expect-error quotient must be a number
      [SAFE_DIVIDE]: () => ok({ quotient: 'five' }),
    } satisfies DomainCoreImplementation;
    const plain = {
      [COMPUTE_AREA]: area,
      // @ts-expect-error a handler returns a Result: ok(…) or fail(…), not its output
      [SAFE_DIVIDE]: () => ({ quotient: 1 }),
    } satisfies DomainCoreImplementation;
    const extra = {
      ...core,
      // @ts-expect-error multiply is not an operation of this domain
      'urn:demo:math:arithmetic:operation:multiply': area,
    } satisfies DomainCoreImplementation;
    expect([missing, mistyped, plain, extra]).toBeDefined();
  });
});
