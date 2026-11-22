import { describe, expect, it } from 'vitest';
import {
  assertEmits,
  assertEmitsNone,
  assertFailsWith,
  assertOutput,
  assertRejectedOn,
  coerceCell,
  operationUrnFromTags,
  tableToObject,
  type ExecuteResultLike,
  type FieldsLike,
} from '../src/gherkin/steps.js';

const URN = 'urn:demo:math:arithmetic:operation:safe_divide';
const input: FieldsLike = {
  dividend: { urn: 'urn:demo:math:arithmetic:field:dividend', primitive: 'float', required: true },
  divisor: { urn: 'urn:demo:math:arithmetic:field:divisor', primitive: 'float', required: true },
};
const strings: FieldsLike = {
  note: { urn: 'urn:demo:math:shop:field:note', primitive: 'string', required: false },
};

describe('operationUrnFromTags', () => {
  it('finds the one operation tag, ignoring other tags and duplicates', () => {
    expect(operationUrnFromTags(['@wip', `@${URN}`, `@${URN}`])).toBe(URN);
  });

  it('rejects zero or several operation tags, and non-operation URNs', () => {
    expect(() => operationUrnFromTags(['@urn:demo:math:arithmetic:field:divisor'])).toThrow('no @urn:');
    expect(() =>
      operationUrnFromTags([`@${URN}`, '@urn:demo:math:geometry:operation:compute_area']),
    ).toThrow('more than one operation tag');
  });
});

describe('coerceCell', () => {
  const float = input['divisor']!;
  it('turns number literals into numbers for numeric fields', () => {
    expect(['10', '-9', '0.5', '.5', '+3', '1e3', '-0', 'Infinity', '-Infinity'].map((c) => coerceCell(c, float))).toEqual([
      10, -9, 0.5, 0.5, 3, 1000, -0, Infinity, -Infinity,
    ]);
    expect(Number.isNaN(coerceCell('NaN', float))).toBe(true);
  });

  it('leaves non-numbers as strings so the schema rejects them', () => {
    expect(coerceCell('abc', float)).toBe('abc');
    expect(coerceCell('1,000', float)).toBe('1,000');
    expect(coerceCell(' 1', float)).toBe(' 1');
  });

  it('keeps string fields as written and treats an empty cell as absent', () => {
    expect(coerceCell('10', strings['note']!)).toBe('10');
    expect(coerceCell('', float)).toBeUndefined();
    expect(coerceCell('', strings['note']!)).toBeUndefined();
  });
});

describe('tableToObject', () => {
  it('reads a header row and one data row', () => {
    expect(tableToObject([['dividend', 'divisor'], ['10', '2']], input, 'input', URN)).toEqual({ dividend: 10, divisor: 2 });
  });

  it('omits empty cells', () => {
    expect(tableToObject([['dividend', 'divisor'], ['10', '']], input, 'input', URN)).toEqual({ dividend: 10 });
  });

  it('rejects a header that is not a field, naming the operation', () => {
    expect(() => tableToObject([['dividend', 'denominator'], ['1', '2']], input, 'input', URN)).toThrow(
      `"denominator" is not a field of the input of ${URN} (fields: dividend, divisor)`,
    );
    expect(() => tableToObject([['constructor'], ['1']], input, 'input', URN)).toThrow('"constructor" is not a field');
  });

  it('keeps an empty expected cell as "absent", so the assertion still compares it', () => {
    const output: FieldsLike = { quotient: { urn: 'urn:demo:math:arithmetic:field:quotient', primitive: 'float', required: false } };
    const expected = tableToObject([['quotient'], ['']], output, 'output', URN);
    expect(Object.hasOwn(expected, 'quotient')).toBe(true);
    expect(expected['quotient']).toBeUndefined();
  });

  it('names the error, not the operation, for a header that is not a field of the error', () => {
    const ERR = 'urn:demo:shop:order:error:price_unavailable';
    expect(() => tableToObject([['skew'], ['1']], strings, 'error', ERR)).toThrow(`"skew" is not a field of ${ERR} (fields: note)`);
  });

  it('requires exactly one data row', () => {
    expect(() => tableToObject([['dividend']], input, 'input', URN)).toThrow('got 1 row(s)');
    expect(() => tableToObject([['dividend'], ['1'], ['2']], input, 'input', URN)).toThrow('got 3 row(s)');
  });
});

describe('assertOutput', () => {
  const ok = (output: unknown): ExecuteResultLike => ({ ok: true, output });

  it('passes when every expected column matches', () => {
    expect(() => assertOutput(ok({ quotient: 5, extra: 1 }), { quotient: 5 }, URN)).not.toThrow();
    // Two texts of one UTC instant are equal; two instants are not.
    expect(() => assertOutput(ok({ at: '2026-12-04T19:00:00.000Z' }), { at: '2026-12-04T19:00:00Z' }, URN)).not.toThrow();
    expect(() => assertOutput(ok({ at: '2026-12-04T19:00:00.001Z' }), { at: '2026-12-04T19:00:00Z' }, URN)).toThrow(/at: expected/);
    expect(() => assertOutput(ok({ quotient: Number.NaN }), { quotient: Number.NaN }, URN)).not.toThrow();
  });

  it('fails when an empty expected cell meets a value (no silent pass)', () => {
    expect(() => assertOutput(ok({ quotient: 800 }), { quotient: undefined }, URN)).toThrow('quotient: expected absent, got 800');
    expect(() => assertOutput(ok({}), { quotient: undefined }, URN)).not.toThrow();
  });

  it('reports mismatches and failures', () => {
    expect(() => assertOutput(ok({ quotient: 5 }), { quotient: 6 }, URN)).toThrow('quotient: expected 6, got 5');
    expect(() => assertOutput(ok({}), { quotient: 6 }, URN)).toThrow('quotient: expected 6, got absent');
    expect(() =>
      assertOutput({ ok: false, kind: 'InputRejected', issues: [{ path: 'divisor', message: 'bad' }] }, { quotient: 5 }, URN),
    ).toThrow(`${URN} did not succeed: InputRejected (divisor: bad)`);
  });
});

describe('assertRejectedOn', () => {
  const rejected: ExecuteResultLike = {
    ok: false,
    kind: 'InputRejected',
    issues: [{ path: 'divisor', fieldUrn: 'urn:demo:math:arithmetic:field:divisor', message: 'Invalid value' }],
  };

  it('passes when an issue names the field', () => {
    expect(() => assertRejectedOn(rejected, 'divisor', input, URN)).not.toThrow();
  });

  it('fails on acceptance, the wrong field, the wrong kind and unknown fields', () => {
    expect(() => assertRejectedOn({ ok: true, output: {} }, 'divisor', input, URN)).toThrow('accepted the input');
    expect(() => assertRejectedOn(rejected, 'dividend', input, URN)).toThrow('not on "dividend"');
    expect(() =>
      assertRejectedOn({ ok: false, kind: 'ContractViolation', issues: [] }, 'divisor', input, URN),
    ).toThrow('failed with ContractViolation');
    expect(() => assertRejectedOn(rejected, 'denominator', input, URN)).toThrow('"denominator" is not a field');
  });
});

describe('assertFailsWith', () => {
  const ERR = 'urn:demo:shop:order:error:price_unavailable';
  const refused: ExecuteResultLike = {
    ok: false,
    kind: 'DomainError',
    error: { urn: ERR, message: 'No price for ABC-1234', fields: { kind: ERR, sku: 'ABC-1234' } },
  };

  it('passes on the named error, and on matching fields', () => {
    expect(() => assertFailsWith(refused, ERR, URN)).not.toThrow();
    expect(() => assertFailsWith(refused, ERR, URN, { sku: 'ABC-1234' })).not.toThrow();
  });

  it('fails on success, on another kind of failure, on another error and on different fields', () => {
    expect(() => assertFailsWith({ ok: true, output: {} }, ERR, URN)).toThrow(`${URN} succeeded; expected it to fail with ${ERR}`);
    expect(() => assertFailsWith({ ok: false, kind: 'InputRejected', issues: [{ path: 'sku', message: 'bad' }] }, ERR, URN)).toThrow(
      `${URN} failed with InputRejected (sku: bad); expected the declared error ${ERR}`,
    );
    expect(() => assertFailsWith(refused, 'urn:demo:shop:order:error:pricing_offline', URN)).toThrow(
      `${URN} failed with ${ERR} (No price for ABC-1234); expected urn:demo:shop:order:error:pricing_offline`,
    );
    expect(() => assertFailsWith(refused, ERR, URN, { sku: 'XYZ-0000' })).toThrow(`${ERR} fields differ: sku: expected XYZ-0000, got ABC-1234`);
    expect(() => assertFailsWith(refused, ERR, URN, { sku: undefined })).toThrow(`${ERR} fields differ: sku: expected absent, got ABC-1234`);
  });
});

describe('assertEmits and assertEmitsNone', () => {
  const URN = 'urn:demo:shop:order:operation:place';
  const PLACED = 'urn:demo:shop:order:event:placed';
  const ok = { ok: true as const, output: {}, events: [{ urn: PLACED, fields: { kind: PLACED, order_id: 1 } }, { urn: PLACED, fields: { kind: PLACED, order_id: 2 } }] };

  it('passes when one event of the URN has the expected fields, whatever the count and the order', () => {
    expect(() => assertEmits(ok, PLACED, URN)).not.toThrow();
    expect(() => assertEmits(ok, PLACED, URN, { order_id: 2 })).not.toThrow();
  });

  it('names what was emitted, or the fields that differ', () => {
    expect(() => assertEmits({ ok: true, output: {}, events: [] }, PLACED, URN)).toThrow(`${URN} did not emit ${PLACED} (emitted: nothing)`);
    expect(() => assertEmits(ok, PLACED, URN, { order_id: 3 })).toThrow(`${PLACED} fields differ: order_id: expected 3, got 1 | order_id: expected 3, got 2`);
  });

  it('expects no event after a success with none, or a declared refusal, but not after another failure', () => {
    expect(() => assertEmitsNone({ ok: true, output: {}, events: [] }, URN)).not.toThrow();
    expect(() => assertEmitsNone({ ok: false, kind: 'DomainError', error: { urn: 'e', message: 'm', fields: {} } }, URN)).not.toThrow();
    expect(() => assertEmitsNone(ok, URN)).toThrow(`${URN} emitted ${PLACED}, ${PLACED}; expected no event`);
    expect(() => assertEmitsNone({ ok: false, kind: 'InputRejected', issues: [] }, URN)).toThrow(`${URN} failed with InputRejected; expected it to emit no event`);
  });
});
