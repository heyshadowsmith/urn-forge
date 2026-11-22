/**
 * Compatibility: the header `compatibility` states that callers ignore what they do not know,
 * and the notice before a removal. `diff` and pass 8 check both. The target is
 * tests/fixtures/compatibility.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classify } from '../src/diff/classify.js';
import { DEFAULT_PLUGINS, compile } from '../src/engine.js';
import type { Urn } from '../src/ir/types.js';

const dir = new URL('./fixtures/compatibility/', import.meta.url);
const source = readFileSync(new URL('domain.manifest.yaml', dir), 'utf8');
const BIN = 'urn:demo:compat:stock:field:bin_code';
const GET = 'urn:demo:compat:stock:operation:get_stock';

const diagnostics = (text: string, referenceDate?: string) =>
  compile(text, DEFAULT_PLUGINS, referenceDate === undefined ? {} : { referenceDate })
    .diagnostics.map((d) => [d.code, d.message]);
/** Each change from the target to the target with one edit, as "<class> <urn>: <message>". */
const diff = (edit: (text: string) => string, base = source) => {
  const [old, now] = [compile(base).ir!, compile(edit(base)).ir!];
  expect(now, compile(edit(base)).diagnostics.map((d) => d.message).join('\n')).toBeDefined();
  return classify(old, now).map((c) => `${c.class} ${c.urn}: ${c.message}`);
};
const withoutHeader = source.replace('  compatibility:\n    callers: ignore-unknown\n    notice: 6 months\n', '');

describe('the compatibility target compiles', () => {
  it('with no diagnostics, and the IR holds the rules and the day of the announcement', () => {
    const result = compile(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.ir?.meta.compatibility).toEqual({ callers: 'ignore-unknown', notice: '6 months' });
    expect(result.ir?.fields[BIN as Urn]?.lifecycle).toEqual({
      status: 'deprecated',
      supersededBy: 'urn:demo:compat:stock:field:location',
      deprecatedOn: '2026-11-22',
      sunsetDate: '2027-05-22',
    });
  });

  it('refuses a rule that is not ignore-unknown, and a notice that is not a time', () => {
    expect(diagnostics(source.replace('callers: ignore-unknown', 'callers: ignore'))).toEqual([
      ['invalid-compatibility', 'manifest: compatibility.callers: "ignore" is not a rule; write ignore-unknown'],
    ]);
    expect(diagnostics(source.replace('notice: 6 months', 'notice: half a year'))).toEqual([
      ['invalid-compatibility', 'manifest: compatibility.notice: "half a year" is not a time; write one such as 6 months or 180 days'],
    ]);
  });

  it('refuses deprecatedOn on an active atom', () => {
    expect(diagnostics(source.replace('  status: deprecated\n  supersededBy: stock.field.location\n  deprecatedOn: 2026-11-22\n  sunsetDate: 2027-05-22\n', '  deprecatedOn: 2026-11-22\n'))).toEqual([
      ['invalid-lifecycle', 'stock.field.bin_code.deprecatedOn: an active atom has no deprecatedOn; set status: deprecated or status: sunset, or remove deprecatedOn'],
    ]);
  });
});

describe('the notice before a removal', () => {
  it('refuses a sunset date less than the notice after the announcement', () => {
    expect(diagnostics(source.replace('sunsetDate: 2027-05-22', 'sunsetDate: 2027-05-21'))).toEqual([
      ['short-notice', `${BIN}: sunsetDate 2027-05-21 is less than 6 months after deprecatedOn 2026-11-22; set it on or after 2027-05-22`],
    ]);
  });

  it('counts months on the calendar: the last day of a shorter month', () => {
    const late = source.replace('deprecatedOn: 2026-11-22', 'deprecatedOn: 2026-08-31');
    expect(diagnostics(late.replace('sunsetDate: 2027-05-22', 'sunsetDate: 2027-02-28'))).toEqual([]);
    expect(diagnostics(late.replace('sunsetDate: 2027-05-22', 'sunsetDate: 2027-02-27'))[0]?.[1]).toMatch(/set it on or after 2027-02-28$/);
  });

  it('refuses a sunset date without the day of the announcement, and a sunset atom without a sunset date', () => {
    expect(diagnostics(source.replace('  deprecatedOn: 2026-11-22\n', ''))).toEqual([
      ['short-notice', `${BIN}: sunsetDate 2027-05-22 has no deprecatedOn; the notice of 6 months counts from the day the deprecation is announced`],
    ]);
    const sunset = source.replace('status: deprecated', 'status: sunset').replace('  sunsetDate: 2027-05-22\n', '');
    expect(diagnostics(sunset)).toEqual([['short-notice', `${BIN}: a sunset atom has no sunsetDate; the notice of 6 months ends on it`]]);
  });

  it('checks nothing without a notice', () => {
    expect(diagnostics(withoutHeader.replace('  deprecatedOn: 2026-11-22\n', '').replace('sunsetDate: 2027-05-22', 'sunsetDate: 2026-12-01'))).toEqual([]);
  });

  it('refuses a sunset atom before its sunset date, with a reference date', () => {
    const sunset = source.replace('status: deprecated', 'status: sunset');
    expect(diagnostics(sunset, '2027-05-21')).toEqual([
      ['early-sunset', `${BIN}: status sunset before its sunset date 2027-05-22 (the reference date is 2027-05-21); keep it deprecated until then`],
    ]);
    expect(diagnostics(sunset, '2027-05-22')).toEqual([]);
  });
});

describe('diff with callers: ignore-unknown', () => {
  const newError = (text: string) =>
    text.replace('  errors: [stock.error.not_found]', '  errors: [stock.error.not_found, stock.error.locked]') +
    'stock.error.locked:\n  description: The stock is locked\n  category: conflict\n  retryable: true\n  message: Stock {sku} is locked\n  fields:\n    - ref: stock.field.sku\n';
  const newEvent = (text: string) =>
    text.replace('  emits: [stock.event.counted]', '  emits: [stock.event.counted, stock.event.read]') +
    'stock.event.read:\n  description: The stock was read\n  fields:\n    - ref: stock.field.sku\n';
  const newValue = (text: string) => text.replace('values: [available, held]', 'values: [available, held, damaged]');

  it('reports a new error, a new event and a new enum value in an answer as compatible', () => {
    expect(diff(newError).filter((c) => c.includes(GET))).toEqual([
      `compatible ${GET}: the new declared error urn:demo:compat:stock:error:locked widens a value that callers receive, which callers ignore when they do not know it (compatibility.callers)`,
    ]);
    expect(diff(newEvent).filter((c) => c.includes(GET))).toEqual([
      `compatible ${GET}: the new event urn:demo:compat:stock:event:read widens a value that callers receive, which callers ignore when they do not know it (compatibility.callers)`,
    ]);
    expect(diff(newValue)).toEqual([
      'compatible urn:demo:compat:stock:field:state: values ["available","held"] → ["available","held","damaged"] widens a value that callers receive, which callers ignore when they do not know it (compatibility.callers)',
    ]);
  });

  it('reports each as breaking without the rule', () => {
    expect(diff(newError, withoutHeader).filter((c) => c.includes(GET))).toEqual([
      `breaking ${GET}: the new declared error urn:demo:compat:stock:error:locked widens a value that callers receive, which breaks callers that receive it`,
    ]);
    expect(diff(newValue, withoutHeader)[0]).toMatch(/^breaking /);
  });

  it('still reports a removal and a wider number as breaking', () => {
    expect(diff((t) => t.replace('    - ref: stock.field.location\n', ''))[0]).toMatch(/^breaking urn:demo:compat:stock:entity:stock: removing the required property "location"/);
    expect(diff((t) => t.replace('  min: 0\n', '  min: -5\n'))[0]).toMatch(/^breaking urn:demo:compat:stock:field:quantity: min 0 → -5 widens/);
  });
});

describe('diff with a notice', () => {
  const NOTE = 'urn:demo:compat:stock:field:note';
  it('allows the sunset of an announced atom', () => {
    expect(diff((t) => t.replace('status: deprecated', 'status: sunset'))).toEqual([`lifecycle ${BIN}: status deprecated → sunset`]);
  });

  it('refuses a sunset with no announcement', () => {
    expect(diff((t) => t.replace('  description: A note, which no entity uses yet\n', '  description: A note, which no entity uses yet\n  status: sunset\n  deprecatedOn: 2026-01-01\n  sunsetDate: 2026-07-01\n'))).toContain(
      `breaking ${NOTE}: status active → sunset with no notice; compatibility.notice is 6 months, so deprecate it with deprecatedOn and sunsetDate first`,
    );
  });

  it('refuses a change to the day of the announcement', () => {
    expect(diff((t) => t.replace('deprecatedOn: 2026-11-22', 'deprecatedOn: 2026-11-01'))).toEqual([
      `breaking ${BIN}: deprecatedOn 2026-11-22 → 2026-11-01: the day a deprecation was announced does not change`,
    ]);
  });
});
