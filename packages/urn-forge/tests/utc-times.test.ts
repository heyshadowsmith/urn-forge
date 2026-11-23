/**
 * UTC times: every instant of a contract is UTC, with no time zone. A timestamp can have an exact
 * precision. The target is tests/fixtures/utc-times.
 */
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import { PRIMITIVES } from '../src/primitives/index.js';

const dir = new URL('./fixtures/utc-times/', import.meta.url);
const source = readFileSync(new URL('domain.manifest.yaml', dir), 'utf8');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const schemas: any = await import(new URL('expected/domain.schemas.generated.ts', dir).href);

describe('precision', () => {
  it('accepts exactly 3 digits after the second, and refuses 0, 2 or 4', () => {
    const parse = (t: string) => v.safeParse(schemas.StockReceivedAtSchema, t).success;
    expect(parse('2026-11-23T09:30:00.000Z')).toBe(true);
    expect(parse('2026-11-23T09:30:00.120Z')).toBe(true);
    for (const t of ['2026-11-23T09:30:00Z', '2026-11-23T09:30:00.12Z', '2026-11-23T09:30:00.1234Z']) expect(parse(t), t).toBe(false);
    expect(v.safeParse(schemas.StockReceivedAtSchema, '2026-11-23T09:30:00.12Z').issues?.[0]?.message).toBe('Invalid timestamp: Expected exactly 3 digits after the second');
  });

  it('refuses a precision that is not 0 to 3, and on another primitive', () => {
    const messages = (from: string, to: string) => compile(source.replace(from, to)).diagnostics.map((d) => [d.code, d.message]);
    expect(messages('  precision: 3', '  precision: 6')[0]).toEqual(['invalid-value', 'stock.field.received_at.precision: must be 0, 1, 2 or 3']);
    expect(messages("  regex: '[A-Z0-9-]{1,12}'", "  regex: '[A-Z0-9-]{1,12}'\n  precision: 3")[0]?.[0]).toBe('constraint-not-allowed');
  });

  it('asks gate 3 for a value with other digits', () => {
    const cases = PRIMITIVES.timestamp.boundaries({ precision: 3 });
    expect(cases.map((c) => c.label)).toEqual(['value with other than 3 digits after the second']);
    expect(cases[0]!.covers('2026-11-23T09:30:00Z')).toBe(true);
    expect(cases[0]!.covers('2026-11-23T09:30:00.000Z')).toBe(false);
  });

  it('keeps no finer part of a second in Postgres', async () => {
    const db = new PGlite();
    await db.exec(readFileSync(new URL('expected/schema.generated.sql', dir), 'utf8'));
    const insert = (t: string) => db.query('INSERT INTO "stock"."receipt" ("sku", "received_at") VALUES ($1, $2)', [`A${t.length}`, t]);
    await insert('2026-11-23T09:30:00.123Z');
    await expect(insert('2026-11-23T09:30:00.1234Z')).rejects.toThrow(/received_at/);
  });
});
