/**
 * The Postgres plugin (Postgres plan). The SQL and the Valibot schema are two translations of
 * one rule, so the tests give both the same values and expect the same answer (decision 12).
 */
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import * as v from 'valibot';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import { PLUGINS } from '../src/plugins/index.js';
import { translateRegex } from '../src/plugins/postgres-regex.js';
import { boundaryCases, type Primitive } from '../src/primitives/index.js';
import * as schemas from './fixtures/postgres/expected/domain.schemas.generated.js';

const fixture = (file: string) => readFileSync(new URL(`./fixtures/postgres/${file}`, import.meta.url), 'utf8');
const ir = compile(fixture('domain.manifest.yaml')).ir!;

/** Values for each field of the fixture. Together they cover every boundary case of the field. */
const SAMPLES: Readonly<Record<string, readonly unknown[]>> = {
  flag: [true, false],
  accepted: [true, false],
  size: ['s', 'm', 'l', 'xl', 'S', ''],
  text: ['', 'a', 'Smith, Ada', '😀', "it's"],
  code: ['a', 'ab', 'abcd', 'abcde', '😀', '😀😀', 'a😀😀a', 'a😀😀a😀'],
  sku: ['ABC-1234', 'abc-1234', 'ABC-12345', 'xABC-1234'],
  id: ['123e4567-e89b-12d3-a456-426614174000', '123E4567-E89B-12D3-A456-426614174000', '123e4567e89b12d3a456426614174000', 'nope'],
  email: ['ada@example.com', 'ada.smith+x@mail.example.co', 'ada@ex', '@example.com', 'ada@exa_mple.com', 'adé@example.com', 'a b@example.com'],
  // \w and \d are ASCII in JavaScript; in Postgres they also match é and ٣.
  word: ['abc.12', 'a_b.1', 'é.1', 'a.٣', 'abc.', 'abc.1x'],
  // . is not a line terminator in JavaScript; in Postgres it matches \n. \s has no U+0085 in JavaScript.
  line: ['a-b', 'a\nb', 'a\u2028b', 'y ', 'y\n', 'y\u00a0', 'y\u0085', 'x '],
  hex: ['0xff', 'FF', '0x1', 'abcd', 'abcde', '0X12'],
  sample_id: [1, 0, -1, 2 ** 53 - 1, -(2 ** 53 - 1), 2 ** 53, 1.5],
  count: [0, 2 ** 53 - 1, 2 ** 53, -(2 ** 53), 1.5],
  quantity: [0, 1, 2, 12, 13, 14, 98, 99, 100],
  pack: [-6, -1, 0, 6, 7, 12, 5],
  ratio: [0, -0, 1.5, -1e308, 1e-300, 0.1],
  share: [-0.0001, 0, 0.5, 1, 1.0001],
  weight: [0, 1e-9, 999.999, 1000, 1000.0001],
  divisor: [0, -0, 1, -1],
  amount: ['0', '-0', '1.5', '-12345678901234567890.123456789'],
  price: ['0.00', '0.01', '0.009', '9999.99', '10000.00', '13', '13.00', '13.0', '12.99', '1.005', '1.5'],
  rate: ['0', '0.0001', '0.5', '1', '0.99999999'],
  day: ['2026-01-01', '2024-02-29', '2023-02-29', '2026-13-01'],
  term_day: ['2025-12-31', '2026-01-01', '2026-12-31', '2027-01-01'],
  at: ['2026-01-31T09:30:00Z', '2026-01-31T09:30:00.123Z', '2026-02-30T00:00:00Z'],
  window: ['2025-12-31T23:59:59.999Z', '2026-01-01T00:00:00Z', '2026-12-31T23:59:59.999Z', '2027-01-01T00:00:00Z', '2027-01-01T00:00:00.000Z'],
};

/** The JavaScript type of a value of each primitive. Other values are refused by type, so Postgres has nothing to compare. */
const JS_TYPE: { readonly [P in Primitive]: 'boolean' | 'number' | 'string' } = {
  boolean: 'boolean',
  date: 'string',
  decimal: 'string',
  enum: 'string',
  float: 'number',
  integer: 'number',
  string: 'string',
  timestamp: 'string',
};

describe('the domain of each field', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(fixture('expected/schema.generated.sql'));
  });
  afterAll(async () => db.close());

  const fields = Object.values(ir.fields);

  it('has samples for every field, and the samples cover every boundary case of gate 3', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(fields.map((f) => f.urn.split(':')[5]).sort());
    for (const field of fields) {
      const samples = SAMPLES[field.urn.split(':')[5]!]!;
      for (const c of boundaryCases(field.primitive, field.constraints)) {
        expect(samples.some((s) => c.covers(s)), `${field.urn}: ${c.label}`).toBe(true);
      }
    }
  });

  it.each(fields.map((f) => [f.urn.split(':')[5]!, f] as const))('%s: Postgres and Valibot give the same answer for each sample', async (identifier, field) => {
    const schema = (schemas as unknown as Record<string, v.GenericSchema>)[`${field.brandIdentifier}Schema`]!;
    for (const sample of SAMPLES[identifier]!.filter((s) => typeof s === JS_TYPE[field.primitive])) {
      const valibot = v.is(schema, sample);
      const postgres = await db
        .query(`SELECT $1::"value"."${identifier}_value" AS x`, [String(sample)])
        .then(() => true)
        .catch(() => false);
      expect(postgres, `${identifier}: ${JSON.stringify(sample)} (Valibot: ${valibot})`).toBe(valibot);
    }
  });
});

describe('regular expressions (decision 9)', () => {
  it.each([
    ['(?=a)a', 'lookaround and named groups have no translation'],
    ['(?<name>a)', 'lookaround and named groups have no translation'],
    ['(a)\\1', '"\\1" has no translation'],
    ['\\bword', '"\\b" has no translation'],
    ['a{1,300}', 'a count above 255 has no translation'],
    ['[\\D]', '"\\D" inside a bracket has no translation'],
    ['\\p{L}', '"\\p" has no translation'],
  ])('refuses %s, with the reason', (pattern, reason) => {
    expect(translateRegex(pattern)).toEqual({ ok: false, reason });
  });

  it('refuses a flag other than u and i', () => {
    expect(translateRegex('a', 'gu')).toEqual({ ok: false, reason: 'the flag "g" has no translation' });
  });

  it('spells out the JavaScript meaning of \\d, \\w, \\s, . and the escapes', () => {
    expect(translateRegex('\\d\\w.\\u00e9\\u{1F600}\\/(a|b)*?')).toEqual({
      ok: true,
      pattern: '[0-9][A-Za-z0-9_][^\\n\\r\\u2028\\u2029]\\u00e9\\U0001f600/(?:a|b)*',
      caseInsensitive: false,
    });
  });

  it('reports a pattern with no exact SQL form as unenforced-in-sql, a warning or an error by config', () => {
    const manifest =
      'manifest:\n  namespace: demo\n  domain: math\n  version: 1.0.0\n' +
      "a.field.id: { primitive: integer }\na.field.site: { primitive: string, format: uri }\na.field.tag: { primitive: string, regex: '(?!x)[a-z]+' }\n" +
      'a.entity.e:\n  description: d\n  key: a.field.id\n  fields:\n    - ref: a.field.id\n    - ref: a.field.site\n    - ref: a.field.tag\n';
    const run = (unenforced: 'warn' | 'error') =>
      compile(manifest, [{ plugin: PLUGINS.postgres, config: { tables: ['a.entity.e'], unenforced } }]);
    const warned = run('warn');
    expect(warned.diagnostics.map((d) => [d.code, d.severity, d.message])).toEqual([
      ['unenforced-in-sql', 'warning', 'urn:demo:math:a:field:site: format uri: Valibot checks it with the URL parser, which has no SQL form; the SQL does not enforce it, and the Valibot schema at the boundary still does'],
      ['unenforced-in-sql', 'warning', 'urn:demo:math:a:field:tag: regex (?!x)[a-z]+: lookaround and named groups have no translation; the SQL does not enforce it, and the Valibot schema at the boundary still does'],
    ]);
    expect(warned.files[0]!.content).toContain('-- Not enforced here: format uri: Valibot checks it with the URL parser, which has no SQL form.\nCREATE DOMAIN "a"."site_value" AS TEXT;');
    const failed = run('error');
    expect(failed.diagnostics.map((d) => d.severity)).toEqual(['error', 'error']);
    expect(failed.files).toEqual([]);
  });
});

describe('the config', () => {
  const manifest =
    'manifest:\n  namespace: demo\n  domain: math\n  version: 1.0.0\n' +
    'a.field.id: { primitive: integer }\na.entity.keyed:\n  description: d\n  key: a.field.id\n  fields:\n    - ref: a.field.id\n' +
    'a.entity.plain:\n  description: d\n  fields:\n    - ref: a.field.id\n';
  const messages = (tables: readonly string[]) =>
    compile(manifest, [{ plugin: PLUGINS.postgres, config: { tables } }]).diagnostics.map((d) => `${d.code}: ${d.message}`);

  it('refuses a table that is not an entity, that does not resolve, that has no key, or that is listed twice', () => {
    expect(messages(['a.field.id', 'a.entity.nope', 'a.entity.plain', 'a.entity.keyed', 'a.entity.keyed'])).toEqual([
      'wrong-ref-kind: postgres config: tables[0] "a.field.id" must name an entity, but it names a field',
      'unresolved-ref: postgres config: tables[1] "a.entity.nope" does not resolve (no atom urn:demo:math:a:entity:nope in this manifest)',
      'missing-key: urn:demo:math:a:entity:plain: is a table in the postgres config, so it needs a key: one of its own required, single-valued fields',
      'plugin-config: postgres config: tables[4] "a.entity.keyed" is listed more than once',
    ]);
  });

  it('refuses an unknown option', () => {
    expect(compile(manifest, [{ plugin: PLUGINS.postgres, config: { table: [] } }]).diagnostics.map((d) => d.message)).toEqual([
      'plugin postgres config: unknown option "table"',
    ]);
  });
});
