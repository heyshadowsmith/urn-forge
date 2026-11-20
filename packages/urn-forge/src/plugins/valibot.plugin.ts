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
import type { MvpPrimitive } from '../meta-schema.js';
import {
  numberLiteral,
  valuesInUrnOrder,
  type CodegenPlugin,
  type PluginDiagnostic,
} from './plugin.interface.js';

export const VALIBOT_SCHEMAS_FILE = 'domain.schemas.generated.ts';

/** Exported names for one atom. Other plugins import these, so they live here. */
export function schemaNames(brandIdentifier: string) {
  return {
    schema: `${brandIdentifier}Schema`,
    output: brandIdentifier,
    input: `${brandIdentifier}Input`,
  } as const;
}

const BASE_BY_PRIMITIVE: Record<MvpPrimitive, readonly string[]> = {
  float: ['v.number()', 'v.finite()'],
  integer: ['v.number()', 'v.safeInteger()'],
  string: ['v.string()'],
};

/** Constraint key → Valibot action, in the fixed order they are emitted. */
const ACTION_BY_CONSTRAINT: readonly (readonly [string, string])[] = [
  ['min', 'v.minValue'],
  ['max', 'v.maxValue'],
  ['notEqual', 'v.notValue'],
  ['minLength', 'v.minLength'],
  ['maxLength', 'v.maxLength'],
];

const ConfigSchema = v.strictObject({});
export type ValibotPluginConfig = v.InferOutput<typeof ConfigSchema>;

function fieldDeclaration(field: IRField, diagnostics: PluginDiagnostic[]): string {
  const known = new Set(ACTION_BY_CONSTRAINT.map(([key]) => key));
  for (const key of Object.keys(field.constraints).sort()) {
    if (!known.has(key)) {
      diagnostics.push({
        severity: 'error',
        urn: field.urn,
        message: `${field.urn}: the valibot plugin cannot translate constraint "${key}"`,
      });
    }
  }

  const steps = [...BASE_BY_PRIMITIVE[field.primitive]];
  for (const [key, action] of ACTION_BY_CONSTRAINT) {
    const value = field.constraints[key];
    if (value !== undefined) steps.push(`${action}(${numberLiteral(value)})`);
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
  emit(ir) {
    const diagnostics = exportCollisions(ir);
    const sections = [
      `import * as v from 'valibot';`,
      `// Fields`,
      ...valuesInUrnOrder(ir.fields).map((field) => fieldDeclaration(field, diagnostics)),
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
