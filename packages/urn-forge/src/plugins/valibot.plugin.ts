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
import type { IREntity, IRField, UniversalIR, Urn } from '../ir/types.js';
import { schemaNames } from '../naming.js';
import {
  constraintKeys,
  type ConstraintKey,
  type ConstraintsOf,
  type ConstraintValue,
  type Primitive,
} from '../primitives/index.js';
import {
  numberLiteral,
  valuesInUrnOrder,
  type CodegenPlugin,
  type PluginDiagnostic,
} from './plugin.interface.js';

export const VALIBOT_SCHEMAS_FILE = 'domain.schemas.generated.ts';


/** How one primitive becomes a Valibot pipe: its base actions, then one action per constraint. */
export interface ValibotTranslation<P extends Primitive> {
  readonly base: readonly string[];
  readonly constraints: {
    readonly [K in ConstraintKey<P>]: (value: NonNullable<ConstraintsOf<P>[K]>) => string;
  };
}

/**
 * Every primitive and every constraint it accepts. A primitive or constraint added to the
 * registry without an entry here fails `tsc`.
 */
export type ValibotTranslations = { readonly [P in Primitive]: ValibotTranslation<P> };

const NUMERIC_ACTIONS: ValibotTranslation<'float' | 'integer'>['constraints'] = {
  min: (n) => `v.minValue(${numberLiteral(n)})`,
  max: (n) => `v.maxValue(${numberLiteral(n)})`,
  notEqual: (n) => `v.notValue(${numberLiteral(n)})`,
};

const TRANSLATIONS: ValibotTranslations = {
  boolean: { base: ['v.boolean()'], constraints: { mustBe: (b) => `v.value(${b})` } },
  float: { base: ['v.number()', 'v.finite()'], constraints: NUMERIC_ACTIONS },
  integer: { base: ['v.number()', 'v.safeInteger()'], constraints: NUMERIC_ACTIONS },
  string: {
    base: ['v.string()'],
    constraints: {
      minLength: (n) => `v.minLength(${numberLiteral(n)})`,
      maxLength: (n) => `v.maxLength(${numberLiteral(n)})`,
      // A picklist schema in the pipe also narrows the type to the listed values.
      oneOf: (values) => `v.picklist([${values.map((value) => JSON.stringify(value)).join(', ')}])`,
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
    `/** ${field.urn}${field.description ? ` — ${field.description}` : ''} */`,
    `export const ${names.schema} = v.pipe(`,
    ...steps.map((step) => `  ${step},`),
    `);`,
    ...typeExports(field.brandIdentifier),
  ].join('\n');
}

function entityDeclaration(entity: IREntity, fields: Readonly<Record<Urn, IRField>>): string {
  const names = schemaNames(entity.brandIdentifier);
  const properties = entity.fields.map((ref) => {
    const field = fields[ref.field];
    if (!field) throw new Error(`IR is not resolved: ${entity.urn} references missing ${ref.field}`);
    const schema = schemaNames(field.brandIdentifier).schema;
    return `  ${ref.name}: ${ref.required ? schema : `v.optional(${schema})`},`;
  });
  return [
    `/** ${entity.urn} — ${entity.description} */`,
    `export const ${names.schema} = v.object({`,
    ...properties,
    `});`,
    ...typeExports(entity.brandIdentifier),
  ].join('\n');
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
  for (const atom of [...valuesInUrnOrder(ir.fields), ...valuesInUrnOrder(ir.entities)]) {
    for (const name of Object.values(schemaNames(atom.brandIdentifier))) {
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
  supports: { kinds: ['field', 'entity', 'operation'], constraints: SUPPORTED_CONSTRAINTS },
  emit(ir) {
    const diagnostics = exportCollisions(ir);
    const sections = [
      `import * as v from 'valibot';`,
      `// Fields`,
      ...valuesInUrnOrder(ir.fields).map(fieldDeclaration),
      `// Entities`,
      ...valuesInUrnOrder(ir.entities).map((entity) => entityDeclaration(entity, ir.fields)),
    ];
    if (diagnostics.length > 0) return { artifacts: [], diagnostics };
    return {
      artifacts: [{ relativePath: VALIBOT_SCHEMAS_FILE, content: `${sections.join('\n\n')}\n` }],
      diagnostics,
    };
  },
};
