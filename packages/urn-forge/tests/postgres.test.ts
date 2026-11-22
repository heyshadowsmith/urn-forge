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
import { ruleSql } from '../src/plugins/postgres-rules.js';
import { RULE_CASES } from './rule-cases.js';
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
      compile(manifest, [{ plugin: PLUGINS.valibot, config: {} }, { plugin: PLUGINS.postgres, config: { tables: ['a.entity.e'], unenforced } }]);
    const warned = run('warn');
    expect(warned.diagnostics.map((d) => [d.code, d.severity, d.message])).toEqual([
      ['unenforced-in-sql', 'warning', 'urn:demo:math:a:field:site: format uri: Valibot checks it with the URL parser, which has no SQL form; the SQL does not enforce it, and the Valibot schema at the boundary still does'],
      ['unenforced-in-sql', 'warning', 'urn:demo:math:a:field:tag: regex (?!x)[a-z]+: lookaround and named groups have no translation; the SQL does not enforce it, and the Valibot schema at the boundary still does'],
    ]);
    expect(warned.files.find((f) => f.relativePath === 'schema.generated.sql')!.content).toContain('-- Not enforced here: format uri: Valibot checks it with the URL parser, which has no SQL form.\nCREATE DOMAIN "a"."site_value" AS TEXT;');
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
    compile(manifest, [{ plugin: PLUGINS.valibot, config: {} }, { plugin: PLUGINS.postgres, config: { tables } }]).diagnostics.map((d) => `${d.code}: ${d.message}`);

  it('refuses a table that is not an entity, that does not resolve, that has no key, or that is listed twice', () => {
    expect(messages(['a.field.id', 'a.entity.nope', 'a.entity.plain', 'a.entity.keyed', 'a.entity.keyed'])).toEqual([
      'wrong-ref-kind: postgres config: tables[0] "a.field.id" must name an entity, but it names a field',
      'unresolved-ref: postgres config: tables[1] "a.entity.nope" does not resolve (no atom urn:demo:math:a:entity:nope in this manifest)',
      'missing-key: urn:demo:math:a:entity:plain: is a table in the postgres config, so it needs a key: one of its own required, single-valued fields',
      'plugin-config: postgres config: tables[4] "a.entity.keyed" is listed more than once',
    ]);
  });

  it('refuses an unknown option', () => {
    expect(compile(manifest, [{ plugin: PLUGINS.valibot, config: {} }, { plugin: PLUGINS.postgres, config: { table: [] } }]).diagnostics.map((d) => d.message)).toEqual([
      'plugin postgres config: unknown option "table"',
    ]);
  });
});

describe('tables (decisions 1, 6 and 7)', () => {
  // A shop: an order embeds an address (required, single) and lines (a list), each line embeds
  // a list of tags (values) and links to products (a list of links).
  const SHOP =
    'manifest:\n  namespace: demo\n  domain: shop\n  version: 1.0.0\n' +
    'catalog.field.sku: { primitive: string, minLength: 1 }\n' +
    'catalog.entity.product:\n  description: A product\n  key: catalog.field.sku\n  fields:\n    - ref: catalog.field.sku\n' +
    'order.field.order_id: { primitive: integer }\norder.field.street: { primitive: string }\n' +
    'order.field.line_no: { primitive: integer, min: 1 }\norder.field.tag: { primitive: string }\norder.field.quantity: { primitive: integer, min: 1 }\n' +
    'order.entity.address:\n  description: d\n  fields:\n    - ref: order.field.street\n' +
    'order.entity.line:\n  description: d\n  key: order.field.line_no\n  fields:\n    - ref: order.field.line_no\n    - ref: order.field.quantity\n' +
    '    - { ref: order.field.tag, as: tags, many: { maxItems: 2, unique: true } }\n' +
    '    - { link: catalog.entity.product, as: parts, many: { minItems: 1 } }\n' +
    'order.entity.order:\n  description: d\n  key: order.field.order_id\n  fields:\n    - ref: order.field.order_id\n' +
    '    - { ref: order.entity.address, as: ship_to }\n' +
    '    - { ref: order.entity.line, as: lines, many: { minItems: 1, unique: true } }\n';
  const result = compile(SHOP, [{ plugin: PLUGINS.valibot, config: {} }, { plugin: PLUGINS.postgres, config: { tables: ['catalog.entity.product', 'order.entity.order'] } }]);
  const sql = result.files.find((f) => f.relativePath === 'schema.generated.sql')!.content;
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(sql);
    await db.exec(`INSERT INTO "catalog"."product" ("sku") VALUES ('A'), ('B');`);
  });
  afterAll(async () => db.close());

  /** Runs `sql` in one transaction; returns the constraint name of its error, 'ok', or the error text. */
  const run = async (statements: string): Promise<string> => {
    try {
      await db.exec(`BEGIN;\n${statements}\nCOMMIT;`);
      return 'ok';
    } catch (error) {
      await db.exec('ROLLBACK;').catch(() => undefined);
      const e = error as { constraint?: string; message: string };
      return e.constraint ?? e.message;
    }
  };
  let id = 0;
  /** An order with one line, as statements; the parts may change. */
  const order = (options: { address?: boolean; tags?: readonly string[]; parts?: readonly string[]; lines?: number } = {}) => {
    id += 1;
    const { address = true, tags = ['x'], parts = ['A'], lines = 1 } = options;
    return [
      `INSERT INTO "order"."order" ("order_id") VALUES (${id});`,
      ...(address ? [`INSERT INTO "order"."order__ship_to" ("order_id", "street") VALUES (${id}, 'Main St');`] : []),
      ...Array.from({ length: lines }, (_, l) => [
        `INSERT INTO "order"."order__lines" ("order_id", "position", "line_no", "quantity") VALUES (${id}, ${l}, ${l + 1}, 1);`,
        ...tags.map((t, i) => `INSERT INTO "order"."order__lines__tags" ("order_id", "lines_position", "position", "tags") VALUES (${id}, ${l}, ${i}, '${t}');`),
        ...parts.map((p, i) => `INSERT INTO "order"."order__lines__parts" ("order_id", "lines_position", "position", "parts") VALUES (${id}, ${l}, ${i}, '${p}');`),
      ]).flat(),
    ].join('\n');
  };

  it('warns only about the rules it cannot enforce', () => {
    expect(result.diagnostics).toEqual([]);
  });

  it('names a grandchild table after its parents, and its parent position after the property', () => {
    expect(sql).toContain('CREATE TABLE "order"."order__lines__tags" (\n  "order_id" "order"."order_id_value" NOT NULL,\n  "lines_position" INTEGER NOT NULL,\n  "position" INTEGER NOT NULL CHECK ("position" >= 0),\n  "tags" "order"."tag_value" NOT NULL,');
  });

  it('accepts a correct order, and removes its rows with it', async () => {
    expect(await run(order())).toBe('ok');
    expect(await run(`DELETE FROM "order"."order" WHERE "order_id" = ${id};`)).toBe('ok');
    expect((await db.query('SELECT count(*)::int AS n FROM "order"."order__lines__tags"')).rows).toEqual([{ n: 0 }]);
  });

  it.each([
    ['a required embedded entity that is not there', { address: false }, 'ship_to_count'],
    ['a list with fewer items than minItems', { lines: 0 }, 'lines_count'],
    ['a nested list with more items than maxItems', { tags: ['x', 'y', 'z'] }, 'tags_count'],
    ['a repeated value in a unique list', { tags: ['x', 'x'] }, 'order__lines__tags_tags_key'],
    ['a nested list of links with fewer items than minItems', { parts: [] }, 'parts_count'],
    ['a link to a row that does not exist', { parts: ['Z'] }, 'order__lines__parts_parts_fkey'],
  ] as const)('refuses %s', async (_, options, constraint) => {
    expect(await run(order(options))).toBe(constraint);
  });

  it('warns about a link to an entity that is not a table, and about an optional list', () => {
    const diagnostics = compile(SHOP.replace('    - { ref: order.field.tag, as: tags, many: { maxItems: 2, unique: true } }\n', '    - { ref: order.field.tag, as: tags, required: false, many: true }\n'), [
      { plugin: PLUGINS.valibot, config: {} },
      { plugin: PLUGINS.postgres, config: { tables: ['order.entity.order'] } },
    ]).diagnostics;
    expect(diagnostics.map((d) => [d.code, d.message])).toEqual([
      ['unenforced-in-sql', 'urn:demo:shop:order:entity:line: the optional list "tags": no rows can mean absent or empty, so the SQL keeps them apart only as no rows; the SQL does not enforce it, and the Valibot schema at the boundary still does'],
      ['unenforced-in-sql', 'urn:demo:shop:order:entity:line: the link "parts" to urn:demo:shop:catalog:entity:product: that entity is not a table in the postgres config, so no foreign key can name it; the SQL does not enforce it, and the Valibot schema at the boundary still does'],
    ]);
  });

  it('refuses two parts of the schema with one name', () => {
    const clash = `${SHOP}order.entity.order__lines:\n  description: d\n  key: order.field.order_id\n  fields:\n    - ref: order.field.order_id\n`;
    const diagnostics = compile(clash, [{ plugin: PLUGINS.valibot, config: {} }, { plugin: PLUGINS.postgres, config: { tables: ['catalog.entity.product', 'order.entity.order', 'order.entity.order__lines'] } }]).diagnostics;
    expect(diagnostics.map((d) => [d.code, d.message])).toEqual([
      ['invalid-sql-name', 'urn:demo:shop:order:entity:order__lines: the table name "order.order__lines" is also a name that urn:demo:shop:order:entity:order uses'],
      ['invalid-sql-name', 'urn:demo:shop:order:entity:order__lines: the primary key name "order.order__lines_pkey" is also a name that urn:demo:shop:order:entity:order uses'],
    ]);
  });
});

describe('invariants (decision 10)', () => {
  const rules = compile(readFileSync(new URL('./fixtures/rules/domain.manifest.yaml', import.meta.url), 'utf8')).ir!;
  const entity = Object.values(rules.entities)[0]!;
  /** The base type of each primitive's domain (DOMAIN_TRANSLATIONS), for a row of values. */
  const SQL_TYPE: { readonly [P in Primitive]: string } = {
    boolean: 'BOOLEAN',
    date: 'DATE',
    decimal: 'NUMERIC',
    enum: 'TEXT',
    float: 'DOUBLE PRECISION',
    integer: 'BIGINT',
    string: 'TEXT',
    timestamp: 'TIMESTAMPTZ',
  };
  let db: PGlite;
  beforeAll(() => {
    db = new PGlite();
  });
  afterAll(async () => db.close());

  /** Whether a CHECK of `condition` passes for one row: a CHECK passes unless the condition is false. */
  const check = async (condition: string, values: object): Promise<boolean> => {
    const columns = entity.fields.map((ref) => {
      if (!('field' in ref)) throw new Error('the rules fixture has only field references');
      const field = rules.fields[ref.field]!;
      const value = (values as Record<string, unknown>)[ref.name];
      const sql = value === undefined ? 'NULL' : `'${String(value)}'`;
      return `${sql}::${SQL_TYPE[field.primitive]} AS "${ref.name}"`;
    });
    const result = await db.query<{ ok: boolean }>(`SELECT (${condition}) IS NOT FALSE AS ok FROM (SELECT ${columns.join(', ')}) AS row`);
    return result.rows[0]!.ok;
  };

  it('has a rule in the fixture for every case', () => {
    const texts = Object.values(rules.invariants).map((i) => i.ruleText);
    for (const text of Object.keys(RULE_CASES)) expect(texts, text).toContain(text);
  });

  it.each(Object.entries(RULE_CASES))('%s: Postgres gives the answer of the Valibot rule', async (text, [holds, breaks]) => {
    const invariant = Object.values(rules.invariants).find((i) => i.ruleText === text)!;
    const translated = ruleSql(rules, invariant.rule, entity.fields);
    if (!translated.ok) throw new Error(translated.reason);
    // Every other field gets a value, so a required field is never NULL in the row.
    const defaults = { i1: 0, i2: 0, f1: 0, f2: 0, d1: '0', d2: '0', dt1: '2026-01-01', dt2: '2026-01-01', t1: '2026-01-01T00:00:00Z', t2: '2026-01-01T00:00:00Z', s1: 'a', s2: 'a', b1: true, e1: 'a' };
    for (const p of holds) expect(await check(translated.sql, { ...defaults, ...p }), JSON.stringify(p)).toBe(true);
    for (const p of breaks) expect(await check(translated.sql, { ...defaults, ...p }), JSON.stringify(p)).toBe(false);
  });

  it('reports a rule over a list or an embedded entity as unenforced-in-sql', () => {
    const manifest =
      'manifest:\n  namespace: demo\n  domain: shop\n  version: 1.0.0\n' +
      'a.field.id: { primitive: integer }\na.field.tag: { primitive: string }\n' +
      'a.entity.e:\n  description: d\n  key: a.field.id\n  fields:\n    - ref: a.field.id\n    - { ref: a.field.tag, as: tags, many: true, required: false }\n' +
      'a.invariant.tagged:\n  description: d\n  on: a.entity.e\n  rule: tags is present\n  message: m\n';
    const result = compile(manifest, [{ plugin: PLUGINS.valibot, config: {} }, { plugin: PLUGINS.postgres, config: { tables: ['a.entity.e'] } }]);
    expect(result.diagnostics.map((d) => d.message)).toContain(
      'urn:demo:shop:a:invariant:tagged: the rule tags is present: "tags" is a list, which is rows of a child table, and a CHECK sees one row; the SQL does not enforce it, and the Valibot schema at the boundary still does',
    );
    expect(result.files.find((f) => f.relativePath === 'schema.generated.sql')!.content).toContain('-- Not enforced here: urn:demo:shop:a:invariant:tagged (tags is present).');
  });
});

describe('fixes found while writing the docs', () => {
  const HEADER = 'manifest:\n  namespace: demo\n  domain: shop\n  version: 1.0.0\n';
  const BASE =
    'a.field.id: { primitive: integer }\na.field.tag: { primitive: string }\na.field.note: { primitive: string }\n' +
    'a.entity.item:\n  description: d\n  fields:\n    - ref: a.field.tag\n';

  it('lets an optional list with minItems be absent: no rows pass, and a list with rows must have its count', async () => {
    const manifest = `${HEADER}${BASE}a.entity.e:\n  description: d\n  key: a.field.id\n  fields:\n    - ref: a.field.id\n    - { ref: a.field.tag, as: tags, required: false, many: { minItems: 2 } }\n`;
    const result = compile(manifest, [{ plugin: PLUGINS.valibot, config: {} }, { plugin: PLUGINS.postgres, config: { tables: ['a.entity.e'] } }]);
    const db = new PGlite();
    await db.exec(result.files.find((f) => f.relativePath === 'schema.generated.sql')!.content);
    await db.exec('INSERT INTO "a"."e" ("id") VALUES (1);');
    await expect(db.exec(`BEGIN; INSERT INTO "a"."e" ("id") VALUES (2); INSERT INTO "a"."e__tags" ("id", "position", "tags") VALUES (2, 0, 'x'); COMMIT;`)).rejects.toMatchObject({ constraint: 'tags_count' });
    await db.close();
  });

  it('refuses a property with the name of a column that the plugin adds', () => {
    const manifest = `${HEADER}${BASE.replace('    - ref: a.field.tag\n', '    - ref: a.field.tag\n    - { ref: a.field.note, as: position }\n')}a.entity.e:\n  description: d\n  key: a.field.id\n  fields:\n    - ref: a.field.id\n    - { ref: a.entity.item, as: items, many: true }\n`;
    const diagnostics = compile(manifest, [{ plugin: PLUGINS.valibot, config: {} }, { plugin: PLUGINS.postgres, config: { tables: ['a.entity.e'] } }]).diagnostics;
    expect(diagnostics.map((d) => d.message)).toEqual(['urn:demo:shop:a:entity:item: the column name "e__items.position" is also a name that urn:demo:shop:a:entity:e uses']);
  });
});
