/**
 * Valibot plugin → `domain.schemas.generated.ts` (spec §7.1, MVP scope).
 *
 * - One `v.pipe(…, v.brand('<field URN>'))` per field, translating its constraints.
 * - One `v.object()` per entity; `required: false` wraps the field in `v.optional`.
 * - For every atom with a schema, exports `<Brand>Schema`, the branded output type
 *   `<Brand>` (`v.InferOutput`) and the unbranded input type `<Brand>Input` (`v.InferInput`).
 *
 * Fields are emitted before entities (entities reference field schemas); within each
 * group declarations follow URN order.
 */
import * as v from 'valibot';
import { invariantsOf, valueField, type IREntity, type IRError, type IRField, type IRPropertyRef, type ListRule, type UniversalIR, type Urn } from '../ir/types.js';
import { ruleName, schemaNames } from '../naming.js';
import { firstField } from '../rules/index.js';
import { emitRule } from '../rules/emit.js';
import {
  constraintKeys,
  type ConstraintKey,
  type ConstraintsOf,
  type ConstraintValue,
  type Primitive,
} from '../primitives/index.js';
import { wholeValuePattern, type Format } from '../primitives/string.js';
import { HELPER_NEEDS, VALIBOT_HELPERS, type ValibotHelper } from './valibot-helpers.js';
import {
  numberLiteral,
  valuesInUrnOrder,
  docComment,
  type CodegenPlugin,
  type PluginDiagnostic,
} from './plugin.interface.js';

export const VALIBOT_SCHEMAS_FILE = 'domain.schemas.generated.ts';


/** How one primitive becomes a Valibot pipe: its base actions, then one action per constraint. */
export interface ValibotTranslation<P extends Primitive> {
  readonly base: readonly string[];
  /** Helper functions the actions call, emitted once at the top of the file. */
  readonly helpers?: readonly ValibotHelper[];
  readonly constraints: {
    readonly [K in ConstraintKey<P>]: (value: NonNullable<ConstraintsOf<P>[K]>) => string;
  };
}

/**
 * Every primitive and every constraint it accepts. A primitive or constraint added to the
 * registry without an entry here fails `tsc`.
 */
export type ValibotTranslations = { readonly [P in Primitive]: ValibotTranslation<P> };

/** The Valibot action of each named format; `matchesFormat` in src/primitives/string.ts uses the same ones. */
/** A check of a string's length in code points, with Valibot's own length message. */
function codePointLength(op: '>=' | '<=', n: number): string {
  const limit = numberLiteral(n);
  return `v.check((value) => [...value].length ${op} ${limit}, (issue) => \`Invalid length: Expected ${op}${limit} but received \${[...issue.input].length}\`)`;
}

const FORMAT_ACTIONS: { readonly [F in Format]: string } = { uuid: 'v.uuid()', email: 'v.email()', uri: 'v.url()' };

const numbers = (values: readonly number[]) => `[${values.map(numberLiteral).join(', ')}]`;
const text = (value: string) => JSON.stringify(value);

/** A check that runs only on a value of the right form, so a malformed value gets one issue, not two. */
const decimalCheck = (test: string, message: string) => `v.check((value) => !DECIMAL.test(value) || ${test}, ${text(message)})`;
const instantCheck = (test: string, message: string) => `v.check((value) => !isUtcTimestamp(value) || ${test}, ${text(message)})`;

const TRANSLATIONS: ValibotTranslations = {
  boolean: { base: ['v.boolean()'], constraints: { mustBe: (b) => `v.value(${b})` } },
  // `values` is required, so the picklist is always the base, and the type is the union of the names.
  enum: { base: [], constraints: { values: (values) => `v.picklist([${values.map((value) => JSON.stringify(value)).join(', ')}])` } },
  date: {
    base: ['v.string()', "v.check(isCalendarDate, 'Invalid date: Expected a calendar day YYYY-MM-DD')"],
    helpers: ['date'],
    constraints: {
      // A date in this form sorts as text, so Valibot's own comparisons apply.
      min: (day) => `v.minValue(${text(day)})`,
      max: (day) => `v.maxValue(${text(day)})`,
    },
  },
  decimal: {
    base: ['v.string()', "v.regex(DECIMAL, 'Invalid decimal: Expected digits with an optional fraction, such as 12.50')"],
    helpers: ['decimal'],
    constraints: {
      min: (n) => decimalCheck(`compareDecimal(value, ${text(n)}) >= 0`, `Invalid value: Expected >=${n}`),
      max: (n) => decimalCheck(`compareDecimal(value, ${text(n)}) <= 0`, `Invalid value: Expected <=${n}`),
      exclusiveMin: (n) => decimalCheck(`compareDecimal(value, ${text(n)}) > 0`, `Invalid value: Expected >${n}`),
      exclusiveMax: (n) => decimalCheck(`compareDecimal(value, ${text(n)}) < 0`, `Invalid value: Expected <${n}`),
      scale: (n) => decimalCheck(`decimalFraction(value) <= ${n}`, `Invalid decimal: Expected at most ${n} digit(s) after the point`),
      notIn: (values) =>
        decimalCheck(
          `![${values.map(text).join(', ')}].some((excluded) => compareDecimal(value, excluded) === 0)`,
          `Invalid value: Expected none of ${values.join(', ')}`,
        ),
    },
  },
  float: {
    base: ['v.number()', 'v.finite()'],
    constraints: {
      min: (n) => `v.minValue(${numberLiteral(n)})`,
      max: (n) => `v.maxValue(${numberLiteral(n)})`,
      exclusiveMin: (n) => `v.gtValue(${numberLiteral(n)})`,
      exclusiveMax: (n) => `v.ltValue(${numberLiteral(n)})`,
      notIn: (values) => `v.notValues(${numbers(values)})`,
    },
  },
  integer: {
    base: ['v.number()', 'v.safeInteger()'],
    constraints: {
      min: (n) => `v.minValue(${numberLiteral(n)})`,
      max: (n) => `v.maxValue(${numberLiteral(n)})`,
      multipleOf: (n) => `v.multipleOf(${numberLiteral(n)})`,
      notIn: (values) => `v.notValues(${numbers(values)})`,
    },
  },
  string: {
    base: ['v.string()'],
    constraints: {
      // A length counts Unicode code points, as Postgres does (Postgres plan, decision 5), not
      // UTF-16 units as v.minLength does. The message is the one v.minLength gives.
      minLength: (n) => codePointLength('>=', n),
      maxLength: (n) => codePointLength('<=', n),
      // The whole-value pattern as a regex literal; `.source` escapes any `/` in it.
      regex: (pattern) => `v.regex(/${wholeValuePattern(pattern).source}/u)`,
      format: (name) => FORMAT_ACTIONS[name],
    },
  },
  timestamp: {
    base: ['v.string()', "v.check(isUtcTimestamp, 'Invalid timestamp: Expected YYYY-MM-DDTHH:MM:SSZ in UTC, with up to 3 fraction digits')"],
    helpers: ['timestamp'],
    constraints: {
      // Compared as instants, so 09:00:00Z and 09:00:00.000Z are the same value.
      min: (t) => instantCheck(`Date.parse(value) >= Date.parse(${text(t)})`, `Invalid value: Expected >=${t}`),
      max: (t) => instantCheck(`Date.parse(value) <= Date.parse(${text(t)})`, `Invalid value: Expected <=${t}`),
      exclusiveMin: (t) => instantCheck(`Date.parse(value) > Date.parse(${text(t)})`, `Invalid value: Expected >${t}`),
      exclusiveMax: (t) => instantCheck(`Date.parse(value) < Date.parse(${text(t)})`, `Invalid value: Expected <${t}`),
    },
  },
};

const ConfigSchema = v.strictObject({});
export type ValibotPluginConfig = v.InferOutput<typeof ConfigSchema>;

/** Derived from `TRANSLATIONS`, so the engine's support check and the emitter cannot disagree. */
const SUPPORTED_CONSTRAINTS = Object.fromEntries(
  Object.entries(TRANSLATIONS).map(([primitive, translation]) => [primitive, Object.keys(translation.constraints)]),
) as unknown as { readonly [P in Primitive]: readonly string[] };

/** Field schemas only use constraints the engine has checked against `SUPPORTED_CONSTRAINTS`. */
function fieldDeclaration(field: IRField): string {
  const translation = TRANSLATIONS[field.primitive];
  const actions = translation.constraints as Readonly<Record<string, (value: ConstraintValue) => string>>;

  // Constraints follow the registry's order, so output does not depend on manifest key order.
  const steps = [...translation.base];
  for (const key of constraintKeys(field.primitive)) {
    const value = field.constraints[key];
    const action = actions[key];
    if (value !== undefined && action) steps.push(action(value));
  }
  steps.push(`v.brand(${JSON.stringify(field.urn)})`);

  const names = schemaNames(field.brandIdentifier);
  return [
    docComment(`${field.urn}${field.description ? ` — ${field.description}` : ''}`, field),
    `export const ${names.schema} = v.pipe(`,
    ...steps.map((step) => `  ${step},`),
    `);`,
    ...typeExports(field.brandIdentifier),
  ].join('\n');
}

/**
 * One `  name: <schema>,` line per property: a field's schema, the linked entity's key field
 * schema, or the embedded entity's schema. `required: false` wraps it in `v.optional`.
 */
function propertyLines(owner: Urn, refs: readonly IRPropertyRef[], ir: UniversalIR): string[] {
  return refs.map((ref) => {
    const item = itemSchema(owner, ref, ir);
    const schema = ref.many ? listSchema(item, ref.many, uniqueKey(ref, ir)) : item;
    return `  ${ref.name}: ${ref.required ? schema : `v.optional(${schema})`},`;
  });
}

/** The schema of one value of a property. */
function itemSchema(owner: Urn, ref: IRPropertyRef, ir: UniversalIR): string {
  if ('entity' in ref) {
    const entity = ir.entities[ref.entity];
    if (!entity) throw new Error(`IR is not resolved: ${owner} embeds missing ${ref.entity}`);
    return schemaNames(entity.brandIdentifier).schema;
  }
  const fieldUrn = valueField(ir, ref);
  const field = fieldUrn && ir.fields[fieldUrn];
  if (!field) throw new Error(`IR is not resolved: ${owner} has no field for property ${ref.name}`);
  return schemaNames(field.brandIdentifier).schema;
}

/** For a unique list of an embedded entity: the property name of its key, which uniqueness compares. */
function uniqueKey(ref: IRPropertyRef, ir: UniversalIR): string | undefined {
  if (!('entity' in ref) || !ref.many?.unique) return undefined;
  const entity = ir.entities[ref.entity]!;
  return entity.fields.find((f) => 'field' in f && f.field === entity.key)!.name;
}

/** A list: `v.array`, with its item count and uniqueness (of the values, or of each object's key). */
function listSchema(item: string, rule: ListRule, key?: string): string {
  const unique =
    key === undefined
      ? // Values are compared as they cross the boundary (===), so "1.10" and "1.1" are two values.
        "v.check((list) => new Set(list).size === list.length, 'Invalid items: Expected no value more than once')"
      : `v.check((list) => new Set(list.map((item) => item.${key})).size === list.length, 'Invalid items: Expected no ${key} more than once')`;
  const actions = [
    ...(rule.minItems === undefined ? [] : [`v.minLength(${numberLiteral(rule.minItems)})`]),
    ...(rule.maxItems === undefined ? [] : [`v.maxLength(${numberLiteral(rule.maxItems)})`]),
    ...(rule.unique ? [unique] : []),
  ];
  return actions.length === 0 ? `v.array(${item})` : `v.pipe(v.array(${item}), ${actions.join(', ')})`;
}

/** The primitive of a property that a rule names: its field's, or its linked key's. */
function primitiveIn(entity: IREntity, ir: UniversalIR) {
  return (name: string) => ir.fields[valueField(ir, entity.fields.find((f) => f.name === name)!)!]!.primitive;
}

/** Entities in URN order, except that an entity comes after each entity it embeds. */
function entitiesInDependencyOrder(ir: UniversalIR): IREntity[] {
  const ordered: IREntity[] = [];
  const placed = new Set<Urn>();
  const place = (entity: IREntity) => {
    if (placed.has(entity.urn)) return;
    placed.add(entity.urn);
    for (const ref of entity.fields) if ('entity' in ref && ir.entities[ref.entity]) place(ir.entities[ref.entity]!);
    ordered.push(entity);
  };
  for (const entity of valuesInUrnOrder(ir.entities)) place(entity);
  return ordered;
}

function entityDeclaration(entity: IREntity, ir: UniversalIR): string {
  const names = schemaNames(entity.brandIdentifier);
  const invariants = invariantsOf(ir, entity.urn);
  if (invariants.length === 0) {
    return [
      docComment(`${entity.urn} — ${entity.description}`, entity),
      `export const ${names.schema} = v.object({`,
      ...propertyLines(entity.urn, entity.fields, ir),
      `});`,
      ...typeExports(entity.brandIdentifier),
    ].join('\n');
  }
  // With invariants (spec §7.1): the object, then one exported rule for each invariant, then
  // the schema, whose checks point at the first field each rule names (v.forward).
  const object = `${entity.brandIdentifier}Fields`;
  const primitiveOf = primitiveIn(entity, ir);
  return [
    `const ${object} = v.object({`,
    ...propertyLines(entity.urn, entity.fields, ir),
    `});`,
    ...invariants.map((invariant) =>
      [
        docComment(`${invariant.urn} — ${invariant.description}: ${invariant.ruleText}`, invariant),
        `export const ${ruleName(invariant.brandIdentifier)} = (p: v.InferOutput<typeof ${object}>): boolean =>`,
        `  ${emitRule(invariant.rule, primitiveOf).code};`,
      ].join('\n'),
    ),
    docComment(`${entity.urn} — ${entity.description}`, entity),
    `export const ${names.schema} = v.pipe(`,
    `  ${object},`,
    ...invariants.map(
      (invariant) => `  v.forward(v.check(${ruleName(invariant.brandIdentifier)}, ${JSON.stringify(invariant.message)}), [${JSON.stringify(firstField(invariant.rule))}]),`,
    ),
    `);`,
    ...typeExports(entity.brandIdentifier),
  ].join('\n');
}

/**
 * An error payload (spec §7.1): its fields, plus `kind`, a literal of the error URN, so
 * callers can switch on it exhaustively. The error kind reserves `kind` as a property name.
 */
function errorDeclaration(error: IRError, ir: UniversalIR): string {
  const names = schemaNames(error.brandIdentifier);
  return [
    docComment(`${error.urn} — ${error.description}`, error),
    `export const ${names.schema} = v.object({`,
    `  kind: v.literal(${JSON.stringify(error.urn)}),`,
    ...propertyLines(error.urn, error.fields, ir),
    `});`,
    ...typeExports(error.brandIdentifier),
  ].join('\n');
}

/** The helpers the fields need, each once, in the order of VALIBOT_HELPERS. */
function helpersFor(ir: UniversalIR): ValibotHelper[] {
  const needed = new Set<ValibotHelper>();
  for (const field of Object.values(ir.fields)) {
    for (const helper of TRANSLATIONS[field.primitive].helpers ?? []) for (const need of HELPER_NEEDS[helper]) needed.add(need);
  }
  for (const invariant of Object.values(ir.invariants ?? {})) {
    const primitiveOf = primitiveIn(ir.entities[invariant.on]!, ir);
    for (const helper of emitRule(invariant.rule, primitiveOf).helpers) for (const need of HELPER_NEEDS[helper]) needed.add(need);
  }
  return (Object.keys(VALIBOT_HELPERS) as ValibotHelper[]).filter((name) => needed.has(name));
}

function typeExports(brandIdentifier: string): string[] {
  const names = schemaNames(brandIdentifier);
  return [
    `export type ${names.output} = v.InferOutput<typeof ${names.schema}>;`,
    `export type ${names.input} = v.InferInput<typeof ${names.schema}>;`,
  ];
}

/** Brand identifiers are unique (IR pass 3), but `<A>Input` can still equal another atom's `<B>`. */
function exportCollisions(ir: UniversalIR): PluginDiagnostic[] {
  const owners = new Map<string, Urn>();
  const diagnostics: PluginDiagnostic[] = [];
  const exported = (atom: { readonly urn: Urn; readonly brandIdentifier: string }, kind: 'schema' | 'rule') =>
    kind === 'rule' ? [ruleName(atom.brandIdentifier)] : Object.values(schemaNames(atom.brandIdentifier));
  const atoms = [
    ...[...valuesInUrnOrder(ir.fields), ...valuesInUrnOrder(ir.entities), ...valuesInUrnOrder(ir.errors)].map((atom) => ({ atom, kind: 'schema' as const })),
    ...valuesInUrnOrder(ir.invariants ?? {}).map((atom) => ({ atom, kind: 'rule' as const })),
  ];
  for (const { atom, kind } of atoms) {
    for (const name of exported(atom, kind)) {
      const owner = owners.get(name);
      if (owner) {
        diagnostics.push({
          code: 'export-collision',
          severity: 'error',
          urn: atom.urn,
          message: `${atom.urn}: generated export "${name}" collides with an export of ${owner}; rename one of them`,
        });
      } else {
        owners.set(name, atom.urn);
      }
    }
  }
  return diagnostics;
}

export const valibotPlugin: CodegenPlugin<ValibotPluginConfig> = {
  name: 'valibot',
  version: '0.1.0',
  configSchema: ConfigSchema,
  // Operations need no schema of their own: their input and output are entities.
  supports: { kinds: ['field', 'entity', 'invariant', 'operation', 'error'], constraints: SUPPORTED_CONSTRAINTS },
  emit(ir) {
    const diagnostics = exportCollisions(ir);
    const helpers = helpersFor(ir);
    const sections = [
      `import * as v from 'valibot';`,
      ...(helpers.length > 0 ? [`// Helpers`, ...helpers.map((name) => VALIBOT_HELPERS[name])] : []),
      `// Fields`,
      ...valuesInUrnOrder(ir.fields).map(fieldDeclaration),
      `// Entities`,
      ...entitiesInDependencyOrder(ir).map((entity) => entityDeclaration(entity, ir)),
      ...(Object.keys(ir.errors).length > 0
        ? [`// Errors`, ...valuesInUrnOrder(ir.errors).map((error) => errorDeclaration(error, ir))]
        : []),
    ];
    if (diagnostics.length > 0) return { artifacts: [], diagnostics };
    return {
      artifacts: [{ relativePath: VALIBOT_SCHEMAS_FILE, content: `${sections.join('\n\n')}\n` }],
      diagnostics,
    };
  },
};
