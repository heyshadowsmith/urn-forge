/**
 * The outbox: for a domain with an event that has a `delivery`, one table that holds each such
 * event from the transaction of its change until a publisher marks it published.
 *
 * - The change and its events commit together, so a committed change never loses its event.
 * - A row stays until `markPublished`: a publisher that stops before it sends the event again
 *   (at least once).
 * - The id is the primary key, so an id is never used twice.
 * - The sequence is 1 higher for each event with the same `orderBy` values, and `nextEvents`
 *   gives the events in the order they were written. Two transactions that write an event of
 *   one order at the same time cannot both commit: the second fails on the unique sequence.
 *
 * The transport (a queue, a broker, a webhook) is the user's.
 */
import type { UniversalIR } from '../ir/types.js';
import { valuesInUrnOrder } from './plugin.interface.js';

/** The schema of the outbox table: its name is the domain. */
export const OUTBOX_SCHEMA = 'outbox';

const ident = (name: string) => `"${name.replaceAll('"', '""')}"`;
const literal = (text: string) => `'${text.replaceAll("'", "''")}'`;

/** Whether the domain has an event with a delivery, and so an outbox. */
export function hasOutbox(ir: UniversalIR): boolean {
  return Object.values(ir.events).some((event) => event.delivery !== undefined);
}

/** The CREATE statements of the outbox table. */
export function outboxSql(ir: UniversalIR): string[] {
  const domain = ir.meta.domain;
  const table = `${ident(OUTBOX_SCHEMA)}.${ident(domain)}`;
  return [
    '',
    `CREATE SCHEMA IF NOT EXISTS ${ident(OUTBOX_SCHEMA)};`,
    '',
    `CREATE TABLE ${table} (`,
    `  "position" BIGINT GENERATED ALWAYS AS IDENTITY,`,
    `  "id" TEXT NOT NULL,`,
    `  "urn" TEXT NOT NULL,`,
    `  "order_key" TEXT NOT NULL,`,
    `  "sequence" INTEGER NOT NULL,`,
    `  "payload" JSONB NOT NULL,`,
    `  "published_at" TIMESTAMPTZ,`,
    `  CONSTRAINT ${ident(`${domain}_pkey`)} PRIMARY KEY ("id"),`,
    `  CONSTRAINT ${ident(`${domain}_order_key_sequence_key`)} UNIQUE ("order_key", "sequence")`,
    `);`,
    `CREATE INDEX ${ident(`${domain}_unpublished_idx`)} ON ${table} ("position") WHERE "published_at" IS NULL;`,
    `COMMENT ON TABLE ${table} IS ${literal(`The outbox of urn:${ir.meta.namespace}:${domain}: each event with a delivery, from the transaction of its change until it is published`)};`,
  ];
}

/** The outbox part of the store file: the delivery of each event, and the three statements. */
export function outboxStore(ir: UniversalIR): string {
  const table = `${ident(OUTBOX_SCHEMA)}.${ident(ir.meta.domain)}`.replaceAll('"', '\\"');
  const deliveries = valuesInUrnOrder(ir.events).flatMap((event) => {
    const d = event.delivery;
    if (!d) return [];
    return [`  ${JSON.stringify(event.urn)}: { id: ${JSON.stringify(d.id)}, orderBy: [${d.orderBy.map((n) => JSON.stringify(n)).join(', ')}]${d.sequence === undefined ? '' : `, sequence: ${JSON.stringify(d.sequence)}`} },`];
  });
  return `
/** The delivery of each event that the outbox holds: the property of its id, the properties that order it, and the sequence. */
const Delivery: Readonly<Record<string, { readonly id: string; readonly orderBy: readonly string[]; readonly sequence?: string }>> = {
${deliveries.join('\n')}
};

/** An event as executeOperation gives it: its URN and its parsed fields. */
export interface OutboxEvent {
  readonly urn: string;
  readonly fields: object;
}

/** A row that nextEvents reads: the event's id, URN, sequence, and its payload with the sequence filled. */
export interface OutboxRow {
  readonly id: string;
  readonly urn: string;
  readonly sequence: number;
  readonly payload: Readonly<Record<string, unknown>>;
}

/**
 * The statements that write the events of a change to the outbox. Run them in the transaction of
 * the change. Each gets the next sequence of its order; the payload holds it too.
 */
export function insertEvents(events: readonly OutboxEvent[]): readonly Statement[] {
  return events.map((event) => {
    const delivery = Object.hasOwn(Delivery, event.urn) ? Delivery[event.urn] : undefined;
    if (!delivery) throw new Error(\`\${event.urn} has no delivery, so the outbox does not hold it\`);
    const fields = event.fields as Readonly<Record<string, unknown>>;
    return {
      text:
        'INSERT INTO ${table} ("id", "urn", "order_key", "sequence", "payload") ' +
        'SELECT $1, $2, $3, next.n, CASE WHEN $5::text IS NULL THEN $4::jsonb ELSE jsonb_set($4::jsonb, ARRAY[$5::text], to_jsonb(next.n)) END ' +
        'FROM (SELECT COALESCE(MAX("sequence"), 0) + 1 AS n FROM ${table} WHERE "order_key" = $3) AS next',
      values: [fields[delivery.id], event.urn, JSON.stringify(delivery.orderBy.map((name) => fields[name])), JSON.stringify(fields), delivery.sequence ?? null],
    };
  });
}

/** The statement that reads at most \`limit\` events that are not published, in the order they were written. Its rows are OutboxRow. */
export function nextEvents(limit: number): Statement {
  return { text: 'SELECT "id", "urn", "sequence", "payload" FROM ${table} WHERE "published_at" IS NULL ORDER BY "position" LIMIT $1', values: [limit] };
}

/** The statement that marks an event published. Run it only after the transport took the event. */
export function markPublished(id: string): Statement {
  return { text: 'UPDATE ${table} SET "published_at" = now() WHERE "id" = $1', values: [id] };
}`;
}
