/** The lifecycle of an atom (lifecycle plan): the keys, the IR, and pass 8. */
import { describe, expect, it } from 'vitest';
import { compile, type CompileOptions } from '../src/engine.js';

const HEADER = 'manifest:\n  namespace: demo\n  domain: math\n  version: 1.0.0\n';
const run = (body: string, options: CompileOptions = {}) => compile(`${HEADER}${body}`, undefined, options);
const report = (body: string, options: CompileOptions = {}) => run(body, options).diagnostics.map((d) => `${d.severity} ${d.code}: ${d.message}`);
/** A field x with these lifecycle keys, and an entity that refers to it. */
const used = (keys: string, entity = '') => `a.field.x: { primitive: float${keys} }\na.field.y: { primitive: float }\na.entity.e:\n  description: d\n${entity}  fields:\n    - ref: a.field.x\n`;

describe('the lifecycle keys', () => {
  it('put a lifecycle in the IR only for an atom that is not plain active', () => {
    const ir = run(used(', status: deprecated, supersededBy: a.field.y, sunsetDate: 2027-06-30')).ir!;
    expect(ir.fields['urn:demo:math:a:field:x' as never]?.lifecycle).toEqual({ status: 'deprecated', supersededBy: 'urn:demo:math:a:field:y', sunsetDate: '2027-06-30' });
    expect(ir.fields['urn:demo:math:a:field:y' as never]).not.toHaveProperty('lifecycle');
    expect(run(used(', status: active')).ir!.fields['urn:demo:math:a:field:x' as never]).not.toHaveProperty('lifecycle');
  });

  it('leave the nodes of an active atom as they were (the fixtures show the same for whole IRs)', () => {
    const { meta: _a, ...plain } = run(used('')).ir!;
    const { meta: _b, ...active } = run(used(', status: active')).ir!;
    expect(active).toEqual(plain);
  });

  it('refuse supersededBy or sunsetDate on an active atom, a wrong kind, the atom itself, and bad values', () => {
    expect(report('a.field.x: { primitive: float, sunsetDate: 2027-01-01 }\n')).toEqual([
      'error invalid-lifecycle: a.field.x.sunsetDate: an active atom has no sunsetDate; set status: deprecated or status: sunset, or remove sunsetDate',
    ]);
    expect(report('a.field.x: { primitive: float, status: deprecated, supersededBy: a.field.x }\n')).toEqual([
      'error invalid-lifecycle: urn:demo:math:a:field:x: supersededBy "a.field.x" names the atom itself; name the atom that replaces it',
    ]);
    expect(report(used(', status: deprecated, supersededBy: a.entity.e'))).toEqual([
      'error wrong-ref-kind: urn:demo:math:a:field:x: supersededBy "a.entity.e" must name a field, but urn:demo:math:a:entity:e is an entity',
    ]);
    expect(report('a.field.x: { primitive: float, status: retired, sunsetDate: 2027-02-30 }\n')).toEqual([
      'error invalid-value: a.field.x.status: must be active, deprecated or sunset',
      'error invalid-value: a.field.x.sunsetDate: must be a date YYYY-MM-DD',
    ]);
  });
});

describe('pass 8', () => {
  it('warns about a reference from an active atom to a deprecated atom, with its replacement and sunset date', () => {
    expect(report(used(', status: deprecated, supersededBy: a.field.y, sunsetDate: 2027-06-30'))).toEqual([
      'warning deprecated-ref: urn:demo:math:a:entity:e: fields[0].ref refers to urn:demo:math:a:field:x, which is deprecated (superseded by urn:demo:math:a:field:y; sunset on 2027-06-30)',
    ]);
    expect(run(used(', status: deprecated')).files.length).toBeGreaterThan(0);
  });

  it('does not warn about a reference between two deprecated atoms', () => {
    expect(report(used(', status: deprecated', '  status: deprecated\n'))).toEqual([]);
  });

  it('refuses a reference to a sunset atom, from an active or a deprecated atom, but not from a sunset atom', () => {
    const message = 'error sunset-ref: urn:demo:math:a:entity:e: fields[0].ref refers to urn:demo:math:a:field:x, which is sunset; refer to its replacement';
    expect(report(used(', status: sunset'))).toEqual([message]);
    expect(report(used(', status: sunset', '  status: deprecated\n'))).toEqual([message]);
    expect(report(used(', status: sunset', '  status: sunset\n'))).toEqual([]);
  });

  it('compares a sunset date with the reference date, never with the clock', () => {
    const body = used(', status: deprecated, sunsetDate: 2027-01-01');
    expect(report(body, { referenceDate: '2026-12-31' }).map((d) => d.split(':')[0])).toEqual(['warning deprecated-ref']);
    expect(report(body, { referenceDate: '2027-01-01' })).toEqual([
      'error sunset-ref: urn:demo:math:a:entity:e: fields[0].ref refers to urn:demo:math:a:field:x, whose sunset date 2027-01-01 is on or before the reference date 2027-01-01; refer to its replacement',
    ]);
    // Without a reference date, the sunset date is not checked, however old it is.
    expect(report(used(', status: deprecated, sunsetDate: 2000-01-01')).map((d) => d.split(':')[0])).toEqual(['warning deprecated-ref']);
  });
});
