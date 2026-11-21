/**
 * Postgres plugin → `schema.generated.sql` (spec §7.4; Postgres plan).
 *
 * The three layers of the MECE model go to three places:
 *
 * - a field is a `DOMAIN`: its SQL type and one `CHECK` with each of its constraints;
 * - a field reference is a column (`NOT NULL`, a foreign key for a link), or a child table
 *   for a list or an embedded entity;
 * - an invariant is a named `CHECK` on the table of its entity.
 *
 * Only the entities in the config's `tables`, and the entities that they embed, are stored.
 * A rule with no exact SQL form is `unenforced-in-sql`: a warning, or an error with
 * `unenforced: 'error'`. The plugin writes `CREATE` statements only, for Postgres 14 or later.
 */
import * as v from 'valibot';
import type { DiagnosticCode } from '../diagnostics.js';
import type { IREntity, IRField, UniversalIR, Urn } from '../ir/types.js';
import { toUrn } from '../naming.js';
import type { ConstraintsOf, Primitive } from '../primitives/index.js';
import type { Format } from '../primitives/string.js';
import { translateRegex } from './postgres-regex.js';
import { numberLiteral, valuesInUrnOrder, type CodegenPlugin, type PluginDiagnostic } from './plugin.interface.js';

export const POSTGRES_SCHEMA_FILE = 'schema.generated.sql';

/** The longest name Postgres keeps, in bytes (NAMEDATALEN − 1). */
const MAX_NAME_BYTES = 63;

const ShortKey = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9_]*\.[a-z]+\.[a-z][a-z0-9_]*$/u, 'must be a short key such as policy.entity.policy'));

export const PostgresConfigSchema = v.strictObject({
  /** The entities that become tables, by short key. Each one needs a `key`. */
  tables: v.optional(v.array(ShortKey), []),
  /** Whether a rule with no exact SQL form is a warning or an error. */
  unenforced: v.optional(v.picklist(['warn', 'error']), 'warn'),
});
export type PostgresConfig = v.InferOutput<typeof PostgresConfigSchema>;

// ---------------------------------------------------------------------------
// SQL text
// ---------------------------------------------------------------------------

/** A quoted identifier. URN segments are snake_case, so no quote is ever inside one. */
export const ident = (name: string) => `"${name.replaceAll('"', '""')}"`;
/** A string literal (standard_conforming_strings, the default since Postgres 9.1). */
export const literal = (text: string) => `'${text.replaceAll("'", "''")}'`;

/** The parts of a URN: `urn:<namespace>:<domain>:<context>:<kind>:<identifier>`. */
export function urnParts(urn: Urn): { readonly context: string; readonly identifier: string } {
  const segments = urn.split(':');
  return { context: segments[3]!, identifier: segments[5]! };
}

/** The domain of a field: `"<context>"."<identifier>_value"`. */
export function domainName(field: Urn): { readonly schema: string; readonly name: string } {
  const { context, identifier } = urnParts(field);
  return { schema: context, name: `${identifier}_value` };
}

const qualified = ({ schema, name }: { readonly schema: string; readonly name: string }) => `${ident(schema)}.${ident(name)}`;

// ---------------------------------------------------------------------------
// Fields as domains
// ---------------------------------------------------------------------------

/** One field's domain: its SQL type, the conditions on VALUE, and the rules with no exact SQL form. */
export interface DomainSql {
  readonly type: string;
  readonly conditions: readonly string[];
  readonly unenforced: readonly string[];
}

type DomainTranslation<P extends Primitive> = (constraints: ConstraintsOf<P>) => DomainSql;

/** Every primitive. A primitive added to the registry without an entry here fails `tsc`. */
type DomainTranslations = { readonly [P in Primitive]: DomainTranslation<P> };

const NOT_SPECIAL = "VALUE NOT IN ('NaN', 'Infinity', '-Infinity')";
const INT32 = { min: -(2 ** 31), max: 2 ** 31 - 1 };
const SAFE = Number.MAX_SAFE_INTEGER;

/** Range and exclusion conditions, over literals already in SQL form. */
function bounds(c: { min?: unknown; max?: unknown; exclusiveMin?: unknown; exclusiveMax?: unknown; notIn?: readonly unknown[] }, sql: (value: never) => string): string[] {
  const out: string[] = [];
  if (c.min !== undefined) out.push(`VALUE >= ${sql(c.min as never)}`);
  if (c.exclusiveMin !== undefined) out.push(`VALUE > ${sql(c.exclusiveMin as never)}`);
  if (c.max !== undefined) out.push(`VALUE <= ${sql(c.max as never)}`);
  if (c.exclusiveMax !== undefined) out.push(`VALUE < ${sql(c.exclusiveMax as never)}`);
  if (c.notIn !== undefined) out.push(`VALUE NOT IN (${c.notIn.map((x) => sql(x as never)).join(', ')})`);
  return out;
}

/** The Valibot pattern of each format, so the two checks are one rule. `uri` uses the URL parser, which has no pattern. */
const FORMAT_PATTERNS: { readonly [F in Format]: RegExp | undefined } = { uuid: v.UUID_REGEX, email: v.EMAIL_REGEX, uri: undefined };

/** A `regex` constraint or a format as a condition, or the reason it has no exact form. */
function patternCondition(pattern: RegExp, what: string): { condition?: string; unenforced?: string } {
  const translated = translateRegex(pattern.source, pattern.flags);
  if (!translated.ok) return { unenforced: `${what}: ${translated.reason}` };
  return { condition: `VALUE ${translated.caseInsensitive ? '~*' : '~'} ${literal(translated.pattern)}` };
}

export const DOMAIN_TRANSLATIONS: DomainTranslations = {
  boolean: (c) => ({ type: 'BOOLEAN', conditions: c.mustBe === undefined ? [] : [`VALUE = ${c.mustBe ? 'TRUE' : 'FALSE'}`], unenforced: [] }),
  enum: (c) => ({ type: 'TEXT', conditions: [`VALUE IN (${(c.values ?? []).map(literal).join(', ')})`], unenforced: [] }),
  date: (c) => ({ type: 'DATE', conditions: bounds(c, (day: string) => `DATE ${literal(day)}`), unenforced: [] }),
  timestamp: (c) => ({ type: 'TIMESTAMPTZ', conditions: bounds(c, (t: string) => `TIMESTAMPTZ ${literal(t)}`), unenforced: [] }),
  decimal: (c) => ({
    // No precision: NUMERIC keeps the digits it gets, and `scale` is the step (decision 4).
    type: 'NUMERIC',
    conditions: [NOT_SPECIAL, ...bounds(c, (n: string) => n), ...(c.scale === undefined ? [] : [`scale(VALUE) <= ${c.scale}`])],
    unenforced: [],
  }),
  float: (c) => ({ type: 'DOUBLE PRECISION', conditions: [NOT_SPECIAL, ...bounds(c, (n: number) => numberLiteral(n))], unenforced: [] }),
  integer: (c) => {
    // INTEGER when both bounds fit in 32 bits; otherwise BIGINT, held to the safe integers of JavaScript.
    const small = c.min !== undefined && c.max !== undefined && c.min >= INT32.min && c.max <= INT32.max;
    return {
      type: small ? 'INTEGER' : 'BIGINT',
      conditions: [
        ...(small ? [] : [`VALUE BETWEEN ${-SAFE} AND ${SAFE}`]),
        ...bounds(c, (n: number) => numberLiteral(n)),
        ...(c.multipleOf === undefined ? [] : [`VALUE % ${numberLiteral(c.multipleOf)} = 0`]),
      ],
      unenforced: [],
    };
  },
  string: (c) => {
    const conditions: string[] = [];
    const unenforced: string[] = [];
    // A length counts code points, as char_length does (decision 5).
    if (c.minLength !== undefined) conditions.push(`char_length(VALUE) >= ${c.minLength}`);
    if (c.maxLength !== undefined) conditions.push(`char_length(VALUE) <= ${c.maxLength}`);
    const shape =
      c.regex !== undefined
        ? patternCondition(new RegExp(`^(?:${c.regex})$`, 'u'), `regex ${c.regex}`)
        : c.format !== undefined
          ? FORMAT_PATTERNS[c.format]
            ? patternCondition(FORMAT_PATTERNS[c.format]!, `format ${c.format}`)
            : { unenforced: `format ${c.format}: Valibot checks it with the URL parser, which has no SQL form` }
          : {};
    if (shape.condition) conditions.push(shape.condition);
    if (shape.unenforced) unenforced.push(shape.unenforced);
    return { type: 'TEXT', conditions, unenforced };
  },
};

export function domainSql(field: IRField): DomainSql {
  const translate = DOMAIN_TRANSLATIONS[field.primitive] as DomainTranslation<Primitive>;
  return translate(field.constraints as ConstraintsOf<Primitive>);
}

// ---------------------------------------------------------------------------
// What is stored
// ---------------------------------------------------------------------------

/** The stored entities: the configured tables, and every entity they embed, at any depth. */
function storedEntities(ir: UniversalIR, tables: readonly Urn[]): Urn[] {
  const seen = new Set<Urn>();
  const visit = (urn: Urn) => {
    if (seen.has(urn)) return;
    seen.add(urn);
    for (const ref of ir.entities[urn]?.fields ?? []) if ('entity' in ref) visit(ref.entity);
  };
  tables.forEach(visit);
  return [...seen];
}

/** The fields whose values a stored entity holds: its fields, and the key fields of its links. */
function storedFields(ir: UniversalIR, entities: readonly Urn[]): Set<Urn> {
  const fields = new Set<Urn>();
  for (const urn of entities) {
    for (const ref of ir.entities[urn]?.fields ?? []) {
      if ('field' in ref) fields.add(ref.field);
      else if ('link' in ref) {
        const key = ir.entities[ref.link]?.key;
        if (key) fields.add(key);
      }
    }
  }
  return fields;
}

// ---------------------------------------------------------------------------
// The plugin
// ---------------------------------------------------------------------------

export const postgresPlugin: CodegenPlugin<PostgresConfig> = {
  name: 'postgres',
  version: '0.1.0',
  configSchema: PostgresConfigSchema as v.GenericSchema<PostgresConfig>,
  // Operations and errors are not stored: the plugin handles them by writing nothing.
  supports: {
    kinds: ['field', 'entity', 'invariant', 'operation', 'error'],
  },
  emit(ir, config) {
    const diagnostics: PluginDiagnostic[] = [];
    const report = (code: DiagnosticCode, message: string, urn?: Urn, severity: 'error' | 'warning' = 'error') =>
      diagnostics.push({ code, severity, message, ...(urn === undefined ? {} : { urn }) });
    const unenforced = (urn: Urn, what: string) =>
      report('unenforced-in-sql', `${urn}: ${what}; the SQL does not enforce it, and the Valibot schema at the boundary still does`, urn, config.unenforced === 'error' ? 'error' : 'warning');

    // The configured tables, by URN.
    const tables: Urn[] = [];
    config.tables.forEach((shortKey, i) => {
      const [context, kind, identifier] = shortKey.split('.') as [string, string, string];
      const urn = toUrn({ namespace: ir.meta.namespace, domain: ir.meta.domain, context, kind, identifier }) as Urn;
      const where = `postgres config: tables[${i}] "${shortKey}"`;
      if (kind !== 'entity') return report('wrong-ref-kind', `${where} must name an entity, but it names a ${kind}`);
      const entity: IREntity | undefined = ir.entities[urn];
      if (!entity) return report('unresolved-ref', `${where} does not resolve (no atom ${urn} in this manifest)`);
      if (!entity.key) return report('missing-key', `${urn}: is a table in the postgres config, so it needs a key: one of its own required, single-valued fields`, urn);
      if (tables.includes(urn)) return report('plugin-config', `${where} is listed more than once`);
      tables.push(urn);
    });
    if (diagnostics.some((d) => d.severity === 'error')) return { artifacts: [], diagnostics };

    const entities = storedEntities(ir, tables);
    const fieldUrns = storedFields(ir, entities);
    const fields = valuesInUrnOrder(ir.fields).filter((f) => fieldUrns.has(f.urn));

    // Names: each must fit in 63 bytes.
    const checkName = (name: string, urn: Urn, what: string) => {
      if (Buffer.byteLength(name, 'utf8') > MAX_NAME_BYTES) {
        report('invalid-sql-name', `${urn}: the ${what} name "${name}" is ${Buffer.byteLength(name, 'utf8')} bytes; Postgres keeps at most ${MAX_NAME_BYTES}`, urn);
      }
    };
    for (const field of fields) checkName(domainName(field.urn).name, field.urn, 'domain');

    const schemas = [...new Set([...fields.map((f) => urnParts(f.urn).context), ...entities.map((e) => urnParts(e).context)])].sort();
    const out: string[] = [
      '-- For Postgres 14 or later. urn-forge writes CREATE statements only: give this file to your migration tool.',
      '',
      ...schemas.map((schema) => `CREATE SCHEMA IF NOT EXISTS ${ident(schema)};`),
    ];

    for (const field of fields) {
      const sql = domainSql(field);
      const { identifier } = urnParts(field.urn);
      for (const what of sql.unenforced) unenforced(field.urn, what);
      out.push('');
      for (const what of sql.unenforced) out.push(`-- Not enforced here: ${what}.`);
      out.push(`CREATE DOMAIN ${qualified(domainName(field.urn))} AS ${sql.type}${sql.conditions.length === 0 ? ';' : ''}`);
      if (sql.conditions.length > 0) out.push(`  CONSTRAINT ${ident(identifier)} CHECK (${sql.conditions.join(' AND ')});`);
      out.push(`COMMENT ON DOMAIN ${qualified(domainName(field.urn))} IS ${literal(describe(field.urn, field.description))};`);
    }

    if (diagnostics.some((d) => d.severity === 'error')) return { artifacts: [], diagnostics };
    return { artifacts: [{ relativePath: POSTGRES_SCHEMA_FILE, content: `${out.join('\n')}\n` }], diagnostics };
  },
};

/** The text of a comment: the URN, and the description when there is one. */
function describe(urn: Urn, description: string | undefined): string {
  return description === undefined ? urn : `${urn} — ${description}`;
}
