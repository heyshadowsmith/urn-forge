/**
 * FCIS plugin → `domain.runtime.generated.ts` (spec §7.2, MVP scope per mvp-plan.md).
 *
 * - One handler type per operation: branded input in, plain output out. Spec §7.2 types
 *   the output as branded, but the core may not mint brands (Gate 2), so per the plan's
 *   "Spec gaps" #1 handlers return `v.InferInput` of the output schema and the shell's
 *   output parse does the branding.
 * - `DomainCoreImplementation` maps every operation URN to its handler type, so
 *   `satisfies DomainCoreImplementation` makes `tsc` reject missing or mistyped handlers.
 * - `DispatchMap` holds each operation's input/output schema plus per-property field
 *   metadata (URN, primitive, required), used to tag issues and by the step library.
 * - `executeOperation(urn, rawPayload, core)` parses input, calls the handler, then
 *   parses (and so brands) the output. No `Result` wrapper: the MVP has no declared errors.
 */
import * as v from 'valibot';
import type { IREntity, UniversalIR } from '../ir/types.js';
import { MVP_PRIMITIVES } from '../meta-schema.js';
import { valuesInUrnOrder, type CodegenPlugin } from './plugin.interface.js';
import { VALIBOT_SCHEMAS_FILE, schemaNames } from './valibot.plugin.js';

export const FCIS_RUNTIME_FILE = 'domain.runtime.generated.ts';

const ConfigSchema = v.strictObject({});
export type FcisPluginConfig = v.InferOutput<typeof ConfigSchema>;

const q = (text: string) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** Static part of the file: types and the gatekeeper, identical for every manifest. */
const SHELL = `// Shell gatekeeper

export type OperationUrn = keyof DomainCoreImplementation;

export interface BoundaryIssue {
  /** Dot path into the payload, e.g. \`divisor\`; empty for the payload as a whole. */
  readonly path: string;
  /** URN of the field the issue is about, when the path starts at a declared field. */
  readonly fieldUrn?: string;
  readonly message: string;
}

export type ExecuteResult<U extends OperationUrn = OperationUrn> =
  | {
      readonly ok: true;
      readonly urn: U;
      readonly output: v.InferOutput<(typeof DispatchMap)[U]['output']['schema']>;
    }
  | {
      readonly ok: false;
      /** The URN names no operation of this domain. */
      readonly kind: 'UnknownOperation';
      readonly urn: string;
      readonly issues: readonly BoundaryIssue[];
    }
  | {
      readonly ok: false;
      /** InputRejected: the caller sent a bad payload. ContractViolation: a bug in the core. */
      readonly kind: 'InputRejected' | 'ContractViolation';
      readonly urn: U;
      readonly issues: readonly BoundaryIssue[];
    };

function boundaryIssues(
  issues: readonly v.BaseIssue<unknown>[],
  fields: Readonly<Record<string, FieldInfo>>,
): BoundaryIssue[] {
  return issues.map((issue) => {
    const path = v.getDotPath(issue) ?? '';
    const head = path.split('.')[0] ?? '';
    const field = Object.hasOwn(fields, head) ? fields[head] : undefined;
    return field ? { path, fieldUrn: field.urn, message: issue.message } : { path, message: issue.message };
  });
}

function isOperationUrn(urn: string): urn is OperationUrn {
  return Object.hasOwn(DispatchMap, urn);
}

/** Parses the input, calls the handler with branded input, then parses and brands its output. */
export function executeOperation<U extends OperationUrn>(
  urn: U,
  rawPayload: unknown,
  core: DomainCoreImplementation,
): ExecuteResult<U>;
export function executeOperation(urn: string, rawPayload: unknown, core: DomainCoreImplementation): ExecuteResult;
export function executeOperation(urn: string, rawPayload: unknown, core: DomainCoreImplementation): ExecuteResult {
  if (!isOperationUrn(urn)) {
    return { ok: false, kind: 'UnknownOperation', urn, issues: [{ path: '', message: \`unknown operation \${urn}\` }] };
  }
  const contract: OperationContract = DispatchMap[urn];

  const input = v.safeParse(contract.input.schema, rawPayload);
  if (!input.success) {
    return { ok: false, kind: 'InputRejected', urn, issues: boundaryIssues(input.issues, contract.input.fields) };
  }

  const handler: unknown = core[urn];
  if (typeof handler !== 'function') {
    return { ok: false, kind: 'ContractViolation', urn, issues: [{ path: '', message: \`no handler for \${urn}\` }] };
  }
  const rawOutput: unknown = handler(input.output);

  const output = v.safeParse(contract.output.schema, rawOutput);
  if (!output.success) {
    return { ok: false, kind: 'ContractViolation', urn, issues: boundaryIssues(output.issues, contract.output.fields) };
  }
  return { ok: true, urn, output: output.output } as ExecuteResult;
}
`;

function entityContract(entity: IREntity, ir: UniversalIR, indent: string): string[] {
  const lines = [`${indent}schema: s.${schemaNames(entity.brandIdentifier).schema},`, `${indent}fields: {`];
  for (const ref of entity.fields) {
    const field = ir.fields[ref.field];
    if (!field) throw new Error(`IR is not resolved: ${entity.urn} references missing ${ref.field}`);
    lines.push(
      `${indent}  ${ref.name}: { urn: ${q(field.urn)}, primitive: ${q(field.primitive)}, required: ${ref.required} },`,
    );
  }
  lines.push(`${indent}},`);
  return lines;
}

export const fcisPlugin: CodegenPlugin<FcisPluginConfig> = {
  name: 'fcis',
  version: '0.1.0',
  configSchema: ConfigSchema,
  emit(ir) {
    const operations = valuesInUrnOrder(ir.operations);
    const entity = (urn: IREntity['urn']): IREntity => {
      const found = ir.entities[urn];
      if (!found) throw new Error(`IR is not resolved: missing entity ${urn}`);
      return found;
    };
    const handlerName = (brand: string) => `${brand}Handler`;
    const schemasModule = `./${VALIBOT_SCHEMAS_FILE.replace(/\.ts$/, '.js')}`;

    const handlers = operations.map((op) =>
      [
        `/** ${op.urn} — ${op.description} */`,
        `export type ${handlerName(op.brandIdentifier)} = (`,
        `  input: s.${schemaNames(entity(op.input).brandIdentifier).output},`,
        `) => s.${schemaNames(entity(op.output).brandIdentifier).input};`,
      ].join('\n'),
    );

    const registry = [
      `export interface DomainCoreImplementation {`,
      ...operations.map((op) => `  readonly ${q(op.urn)}: ${handlerName(op.brandIdentifier)};`),
      `}`,
    ].join('\n');

    const dispatch = [
      `export interface FieldInfo {`,
      `  readonly urn: string;`,
      `  readonly primitive: ${MVP_PRIMITIVES.map(q).join(' | ')};`,
      `  readonly required: boolean;`,
      `}`,
      ``,
      `export interface EntityContract {`,
      `  readonly schema: v.GenericSchema;`,
      `  /** Keyed by property name, in declaration order. */`,
      `  readonly fields: Readonly<Record<string, FieldInfo>>;`,
      `}`,
      ``,
      `export interface OperationContract {`,
      `  readonly input: EntityContract;`,
      `  readonly output: EntityContract;`,
      `}`,
      ``,
      `export const DispatchMap = {`,
      ...operations.flatMap((op) => [
        `  ${q(op.urn)}: {`,
        `    input: {`,
        ...entityContract(entity(op.input), ir, '      '),
        `    },`,
        `    output: {`,
        ...entityContract(entity(op.output), ir, '      '),
        `    },`,
        `  },`,
      ]),
      `} as const satisfies Readonly<Record<keyof DomainCoreImplementation, OperationContract>>;`,
    ].join('\n');

    const sections = [
      `import * as v from 'valibot';\nimport * as s from '${schemasModule}';`,
      `// Handler contracts: branded input in, plain output out (the shell brands the output).`,
      ...handlers,
      `// Registry`,
      registry,
      `// Dispatch`,
      dispatch,
      SHELL.trimEnd(),
    ];
    return {
      artifacts: [{ relativePath: FCIS_RUNTIME_FILE, content: `${sections.join('\n\n')}\n` }],
      diagnostics: [],
    };
  },
};
