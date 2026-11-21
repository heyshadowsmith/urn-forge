/**
 * FCIS plugin → `domain.runtime.generated.ts` (spec §7.2).
 *
 * - `Result`, `ok` and `fail`: every handler returns a `Result` (error kind plan, decision 1).
 *   `fail(errorUrn, fields)` is typed by a generated map from error URN to its payload.
 * - One handler type per operation: branded input in, `Result<plain output, plain error
 *   payloads>` out. The core never mints brands (Gate 2), so per the MVP plan's "Spec
 *   gaps" #1 handlers return `v.InferInput` shapes and the shell's parse does the branding,
 *   for output and errors alike.
 * - `DomainCoreImplementation` maps every operation URN to its handler type, so
 *   `satisfies DomainCoreImplementation` makes `tsc` reject missing or mistyped handlers.
 * - `DispatchMap` holds each operation's input, output and declared-error contracts: the
 *   schemas, per-property field metadata, and each error's category, retryable flag and
 *   parsed message.
 * - `executeOperation(urn, rawPayload, core)` parses input, calls the handler, then parses
 *   (and so brands) its output or its declared error, rendering the error's message.
 */
import * as v from 'valibot';
import type { IREntity, IRError, IRFieldRef, MessagePart, UniversalIR, Urn } from '../ir/types.js';
import { ERROR_CATEGORIES } from '../ir/types.js';
import { handlerName, schemaNames } from '../naming.js';
import { PRIMITIVE_NAMES } from '../primitives/index.js';
import { valuesInUrnOrder, type CodegenPlugin } from './plugin.interface.js';
import { VALIBOT_SCHEMAS_FILE } from './valibot.plugin.js';

export const FCIS_RUNTIME_FILE = 'domain.runtime.generated.ts';

const ConfigSchema = v.strictObject({});
export type FcisPluginConfig = v.InferOutput<typeof ConfigSchema>;

/** A single-quoted TypeScript string literal, escaped as JSON escapes (newlines included). */
const q = (text: string) => `'${JSON.stringify(text).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")}'`;

/** Static: the Result type and its helpers. `ErrorPayloads` (generated) comes just before. */
const RESULTS = `export interface Success<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Failure<E> {
  readonly ok: false;
  readonly error: E;
}

/** What every handler returns: its output, or one of its operation's declared errors. */
export type Result<T, E> = Success<T> | Failure<E>;

export type ErrorUrn = keyof ErrorPayloads;

/** An error's fields, as a handler passes them to \`fail\`: its payload without \`kind\`. */
export type ErrorFields<K extends ErrorUrn> = Omit<ErrorPayloads[K], 'kind'>;

/** A successful result. */
export function ok<T>(value: T): Success<T> {
  return { ok: true, value };
}

/** A declared error, by URN. The fields may be left out when the error has none. */
export function fail<K extends ErrorUrn>(
  kind: K,
  ...fields: {} extends ErrorFields<K> ? [fields?: ErrorFields<K>] : [fields: ErrorFields<K>]
): Failure<ErrorPayloads[K]> {
  return { ok: false, error: { ...fields[0], kind } as ErrorPayloads[K] };
}`;

/** Static: the gatekeeper, identical for every manifest. */
const SHELL = `// Shell gatekeeper

export type OperationUrn = keyof DomainCoreImplementation;

export interface BoundaryIssue {
  /** Dot path into the payload, e.g. \`divisor\`; empty for the payload as a whole. */
  readonly path: string;
  /** URN of the field the issue is about, when the path starts at a declared field. */
  readonly fieldUrn?: string;
  readonly message: string;
}

type DeclaredErrors<U extends OperationUrn> = (typeof DispatchMap)[U]['errors'];

/** A declared error of operation \`U\`, parsed and branded, with its metadata and rendered message. */
export type DomainError<U extends OperationUrn = OperationUrn> = U extends OperationUrn
  ? {
      readonly [K in keyof DeclaredErrors<U>]: {
        readonly urn: K;
        readonly category: ErrorCategory;
        readonly retryable: boolean;
        readonly message: string;
        readonly fields: DeclaredErrors<U>[K] extends { readonly schema: infer S extends v.GenericSchema }
          ? v.InferOutput<S>
          : never;
      };
    }[keyof DeclaredErrors<U>]
  : never;

export type ExecuteResult<U extends OperationUrn = OperationUrn> =
  | {
      readonly ok: true;
      readonly urn: U;
      readonly output: v.InferOutput<(typeof DispatchMap)[U]['output']['schema']>;
    }
  | {
      readonly ok: false;
      /** The operation refused, with one of its declared errors. */
      readonly kind: 'DomainError';
      readonly urn: U;
      readonly error: DomainError<U>;
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

function isResult(value: unknown): value is Result<unknown, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { readonly ok?: unknown };
  return (candidate.ok === true && 'value' in candidate) || (candidate.ok === false && 'error' in candidate);
}

/** Fills each \`{placeholder}\` from the parsed error. */
function renderMessage(parts: readonly MessagePart[], fields: unknown): string {
  const values = fields as Readonly<Record<string, unknown>>;
  return parts.map((part) => ('text' in part ? part.text : String(values[part.field]))).join('');
}

/**
 * Parses the input, calls the handler with branded input, then parses and brands its
 * output, or its error when the error is one the operation declares.
 */
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
  const violation = (message: string): ExecuteResult => ({ ok: false, kind: 'ContractViolation', urn, issues: [{ path: '', message }] });

  const input = v.safeParse(contract.input.schema, rawPayload);
  if (!input.success) {
    return { ok: false, kind: 'InputRejected', urn, issues: boundaryIssues(input.issues, contract.input.fields) };
  }

  const handler: unknown = core[urn];
  if (typeof handler !== 'function') return violation(\`no handler for \${urn}\`);
  const result: unknown = handler(input.output);
  if (!isResult(result)) return violation(\`the handler for \${urn} did not return a Result; return ok(…) or fail(…)\`);

  // \`=== false\`, not \`!result.ok\`: without strictNullChecks, TypeScript narrows a union on
  // an equality test but not on a truthiness test, and the core's tsconfig may not be strict.
  if (result.ok === false) {
    const errorUrn = (result.error as { readonly kind?: unknown } | null | undefined)?.kind;
    const declared =
      typeof errorUrn === 'string' && Object.hasOwn(contract.errors, errorUrn) ? contract.errors[errorUrn] : undefined;
    if (!declared) return violation(\`\${urn} failed with \${String(errorUrn)}, which it does not declare\`);
    const error = v.safeParse(declared.schema, result.error);
    if (!error.success) {
      return { ok: false, kind: 'ContractViolation', urn, issues: boundaryIssues(error.issues, declared.fields) };
    }
    return {
      ok: false,
      kind: 'DomainError',
      urn,
      error: {
        urn: errorUrn,
        category: declared.category,
        retryable: declared.retryable,
        message: renderMessage(declared.message, error.output),
        fields: error.output,
      },
    } as ExecuteResult;
  }

  const output = v.safeParse(contract.output.schema, result.value);
  if (!output.success) {
    return { ok: false, kind: 'ContractViolation', urn, issues: boundaryIssues(output.issues, contract.output.fields) };
  }
  return { ok: true, urn, output: output.output } as ExecuteResult;
}
`;

function fieldInfoLines(owner: Urn, refs: readonly IRFieldRef[], ir: UniversalIR, indent: string): string[] {
  return refs.map((ref) => {
    const field = ir.fields[ref.field];
    if (!field) throw new Error(`IR is not resolved: ${owner} references missing ${ref.field}`);
    return `${indent}${ref.name}: { urn: ${q(field.urn)}, primitive: ${q(field.primitive)}, required: ${ref.required}${ref.many ? ', many: true' : ''} },`;
  });
}

function entityContract(entity: IREntity, ir: UniversalIR, indent: string): string[] {
  return [
    `${indent}schema: s.${schemaNames(entity.brandIdentifier).schema},`,
    `${indent}fields: {`,
    ...fieldInfoLines(entity.urn, entity.fields, ir, `${indent}  `),
    `${indent}},`,
  ];
}

function messageLiteral(parts: readonly MessagePart[]): string {
  return `[${parts.map((part) => ('text' in part ? `{ text: ${q(part.text)} }` : `{ field: ${q(part.field)} }`)).join(', ')}]`;
}

function errorContract(error: IRError, ir: UniversalIR, indent: string): string[] {
  return [
    `${indent}${q(error.urn)}: {`,
    `${indent}  schema: s.${schemaNames(error.brandIdentifier).schema},`,
    `${indent}  category: ${q(error.category)},`,
    `${indent}  retryable: ${error.retryable},`,
    `${indent}  message: ${messageLiteral(error.message)},`,
    `${indent}  fields: {`,
    ...fieldInfoLines(error.urn, error.fields, ir, `${indent}    `),
    `${indent}  },`,
    `${indent}},`,
  ];
}

export const fcisPlugin: CodegenPlugin<FcisPluginConfig> = {
  name: 'fcis',
  version: '0.2.0',
  configSchema: ConfigSchema,
  // Reads primitives only as names for FieldInfo, and no constraints.
  supports: { kinds: ['field', 'entity', 'operation', 'error'] },
  // The runtime imports the schema module.
  requires: ['valibot'],
  emit(ir) {
    const operations = valuesInUrnOrder(ir.operations);
    const errors = valuesInUrnOrder(ir.errors);
    const entity = (urn: Urn): IREntity => {
      const found = ir.entities[urn];
      if (!found) throw new Error(`IR is not resolved: missing entity ${urn}`);
      return found;
    };
    const error = (urn: Urn): IRError => {
      const found = ir.errors[urn];
      if (!found) throw new Error(`IR is not resolved: missing error ${urn}`);
      return found;
    };
    const schemasModule = `./${VALIBOT_SCHEMAS_FILE.replace(/\.ts$/, '.js')}`;

    const payloads = [
      `/** Every declared error, by URN: its payload as a handler builds it (plain, \`kind\` included). */`,
      errors.length === 0
        ? `export interface ErrorPayloads {}`
        : [
            `export interface ErrorPayloads {`,
            ...errors.map((e) => `  readonly ${q(e.urn)}: s.${schemaNames(e.brandIdentifier).input};`),
            `}`,
          ].join('\n'),
    ].join('\n');

    const handlers = operations.map((op) => {
      const errorTypes = op.errors.map((urn) => `s.${schemaNames(error(urn).brandIdentifier).input}`);
      return [
        `/** ${op.urn} — ${op.description} */`,
        `export type ${handlerName(op.brandIdentifier)} = (`,
        `  input: s.${schemaNames(entity(op.input).brandIdentifier).output},`,
        `) => Result<s.${schemaNames(entity(op.output).brandIdentifier).input}, ${errorTypes.length > 0 ? errorTypes.join(' | ') : 'never'}>;`,
      ].join('\n');
    });

    const registry = [
      `export interface DomainCoreImplementation {`,
      ...operations.map((op) => `  readonly ${q(op.urn)}: ${handlerName(op.brandIdentifier)};`),
      `}`,
    ].join('\n');

    const dispatch = [
      `export interface FieldInfo {`,
      `  readonly urn: string;`,
      `  readonly primitive: ${PRIMITIVE_NAMES.map(q).join(' | ')};`,
      `  readonly required: boolean;`,
      `  /** The property holds a list of the field's values. */`,
      `  readonly many?: true;`,
      `}`,
      ``,
      `export interface EntityContract {`,
      `  readonly schema: v.GenericSchema;`,
      `  /** Keyed by property name, in declaration order. */`,
      `  readonly fields: Readonly<Record<string, FieldInfo>>;`,
      `}`,
      ``,
      `export type ErrorCategory = ${ERROR_CATEGORIES.map(q).join(' | ')};`,
      ``,
      `/** Literal text, or a placeholder naming a property of the error. */`,
      `export type MessagePart = { readonly text: string } | { readonly field: string };`,
      ``,
      `export interface ErrorContract extends EntityContract {`,
      `  readonly category: ErrorCategory;`,
      `  readonly retryable: boolean;`,
      `  readonly message: readonly MessagePart[];`,
      `}`,
      ``,
      `export interface OperationContract {`,
      `  readonly input: EntityContract;`,
      `  readonly output: EntityContract;`,
      `  /** Keyed by error URN. */`,
      `  readonly errors: Readonly<Record<string, ErrorContract>>;`,
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
        ...(op.errors.length === 0
          ? [`    errors: {},`]
          : [`    errors: {`, ...op.errors.flatMap((urn) => errorContract(error(urn), ir, '      ')), `    },`]),
        `  },`,
      ]),
      `} as const satisfies Readonly<Record<keyof DomainCoreImplementation, OperationContract>>;`,
    ].join('\n');

    const sections = [
      `import * as v from 'valibot';\nimport * as s from '${schemasModule}';`,
      `// Results`,
      payloads,
      RESULTS,
      `// Handler contracts: branded input in; plain output or a plain declared error out (the shell brands both).`,
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
