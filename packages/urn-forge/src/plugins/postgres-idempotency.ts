/**
 * The store of the answers of idempotent operations: for a domain with an operation that has
 * `idempotency`, one table, and `runOnce`, which the shell calls in the transaction of the call.
 *
 * - A repeat with the same key, owners and body in the window returns the first answer, and the
 *   handler does not run: no second change, no second event.
 * - The same key with another body gets the declared `otherwise` error, or, without one, the first answer.
 * - A refusal is not stored, so a repeat may succeed later.
 * - The operation, the owners and the key are the primary key: a repeat that runs while the first
 *   call is in its transaction fails on it, and the shell's retry finds the first answer.
 */
import type { UniversalIR } from '../ir/types.js';
import { FCIS_RUNTIME_FILE } from './fcis.plugin.js';

/** The schema of the answers table: its name is the domain. */
export const IDEMPOTENCY_SCHEMA = 'idempotency';

const ident = (name: string) => `"${name.replaceAll('"', '""')}"`;
const literal = (text: string) => `'${text.replaceAll("'", "''")}'`;

/** Whether the domain has an operation with idempotency, and so an answers table. */
export function hasAnswers(ir: UniversalIR): boolean {
  return Object.values(ir.operations).some((op) => op.idempotency !== undefined);
}

/** The CREATE statements of the answers table. */
export function answersSql(ir: UniversalIR): string[] {
  const domain = ir.meta.domain;
  const table = `${ident(IDEMPOTENCY_SCHEMA)}.${ident(domain)}`;
  return [
    '',
    `CREATE SCHEMA IF NOT EXISTS ${ident(IDEMPOTENCY_SCHEMA)};`,
    '',
    `CREATE TABLE ${table} (`,
    `  "operation" TEXT NOT NULL,`,
    `  "scope" TEXT NOT NULL,`,
    `  "key" TEXT NOT NULL,`,
    `  "body_hash" TEXT NOT NULL,`,
    `  "answer" JSONB NOT NULL,`,
    `  "created_at" TIMESTAMPTZ NOT NULL,`,
    `  CONSTRAINT ${ident(`${domain}_pkey`)} PRIMARY KEY ("operation", "scope", "key")`,
    `);`,
    `COMMENT ON TABLE ${table} IS ${literal(`The answers of the idempotent operations of urn:${ir.meta.namespace}:${domain}: a repeat in the window returns the first answer`)};`,
  ];
}

/** The import of the store file for runOnce. */
export function answersImports(): string {
  return `import { createHash } from 'node:crypto';\nimport { idempotencyConflict, idempotencyOf, type ExecuteResult } from './${FCIS_RUNTIME_FILE.replace(/\.ts$/, '.js')}';`;
}

/** The answers part of the store file: runOnce. */
export function answersStore(ir: UniversalIR): string {
  const table = `${ident(IDEMPOTENCY_SCHEMA)}.${ident(ir.meta.domain)}`.replaceAll('"', '\\"');
  return `
/** Runs one statement, in the transaction of the call, and gives its rows: the query function of your driver. */
export type Query = (statement: Statement) => Promise<{ readonly rows: readonly Readonly<Record<string, unknown>>[] }>;

/**
 * Runs a call of an operation at most once for each key in its window. Call it in the transaction
 * of the call, with the same \\\`query\\\`; \\\`execute\\\` calls executeOperation.
 *
 * - The same key, owners and body in the window: the first answer, and \\\`execute\\\` does not run.
 * - The same key with another body: the declared \\\`otherwise\\\` error, or the first answer without one.
 * - Else \\\`execute\\\` runs, and a success is stored. A refusal is not.
 *
 * A repeat that runs while the first call is in its transaction fails on the primary key: roll
 * back, and retry; the retry finds the first answer.
 */
export async function runOnce(query: Query, urn: string, payload: unknown, options: { readonly caller?: unknown; readonly now: string }, execute: () => ExecuteResult): Promise<ExecuteResult> {
  const call = idempotencyOf(urn, payload, options);
  if (!call) return execute();
  const hash = createHash('sha256').update(call.body).digest('hex');
  const since = new Date(Date.parse(options.now) - call.windowMs).toISOString();
  const key = [urn, call.scope, call.key];
  const found = (await query({ text: 'SELECT "body_hash", "answer" FROM ${table} WHERE "operation" = $1 AND "scope" = $2 AND "key" = $3 AND "created_at" > $4', values: [...key, since] })).rows[0];
  if (found) {
    const first = { ok: true, urn, output: found['answer'], events: [] } as unknown as ExecuteResult;
    return found['body_hash'] === hash ? first : (idempotencyConflict(urn, payload) ?? first);
  }
  const result = execute();
  if (result.ok) {
    // An answer older than the window frees its key; an answer in the window stays, and the insert fails on it.
    await query({ text: 'DELETE FROM ${table} WHERE "operation" = $1 AND "scope" = $2 AND "key" = $3 AND "created_at" <= $4', values: [...key, since] });
    await query({ text: 'INSERT INTO ${table} ("operation", "scope", "key", "body_hash", "answer", "created_at") VALUES ($1, $2, $3, $4, $5::jsonb, $6)', values: [...key, hash, JSON.stringify(result.output), options.now] });
  }
  return result;
}`;
}
