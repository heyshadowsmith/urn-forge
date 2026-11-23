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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtime: any = await import(new URL('expected/domain.runtime.generated.ts', dir).href);
const sql = readFileSync(new URL('expected/schema.generated.sql', dir), 'utf8');

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
    await db.exec(sql);
    const insert = (t: string) => db.query('INSERT INTO "stock"."receipt" ("sku", "received_at") VALUES ($1, $2)', [`A${t.length}`, t]);
    await insert('2026-11-23T09:30:00.123Z');
    await expect(insert('2026-11-23T09:30:00.1234Z')).rejects.toThrow(/received_at/);
  });
});

describe('calendar months', () => {
  // [start, one month on]: a short month ends on its last day, and a leap February has a 29th.
  const ONE_MONTH = [
    ['2026-01-31', '2026-02-28'],
    ['2028-01-31', '2028-02-29'],
    ['2028-02-29', '2028-03-29'],
    ['2026-03-31', '2026-04-30'],
    ['2026-12-31', '2027-01-31'],
    ['2026-11-23', '2026-12-23'],
  ] as const;
  const plan = (starts_on: string, ends_on: string) => v.safeParse(schemas.BillingPlanSchema, { plan_id: 'pln_abcd', starts_on, ends_on }).success;

  it('adds one calendar month to a date, in the schema', () => {
    for (const [from, to] of ONE_MONTH) {
      expect(plan(from, to), `${from} + 1 month = ${to}`).toBe(true);
      expect(plan(from, `${to.slice(0, 8)}${String(Number(to.slice(8)) - 1).padStart(2, '0')}`), `${from} + 1 month is not the day before ${to}`).toBe(false);
    }
  });

  it('adds one calendar month to an instant, and keeps its time, in the runtime', () => {
    const RENEW = 'urn:demo:utc:billing:operation:renew';
    const renew = (end: (start: string) => string) => ({
      [RENEW]: (input: { period_end: string }) => runtime.ok({ period_start: input.period_end, period_end: end(input.period_end) }),
    });
    const body = { period_start: '2025-12-31T23:30:00Z', period_end: '2026-01-31T23:30:00Z' };
    expect(runtime.executeOperation(RENEW, body, renew(() => '2026-02-28T23:30:00Z'))).toMatchObject({ ok: true });
    expect(runtime.executeOperation(RENEW, body, renew(() => '2026-03-03T23:30:00Z'))).toMatchObject({
      ok: false,
      kind: 'ContractViolation',
      issues: [{ message: `the handler for ${RENEW} answered a value that breaks ensures: output.period_end = output.period_start + 1 months` }],
    });
  });

  it('adds the same months in a Postgres CHECK, whatever the time zone of the session', async () => {
    const db = new PGlite();
    await db.exec(sql);
    await db.exec("SET TIME ZONE 'Pacific/Chatham'");
    const insert = (id: string, from: string, to: string) => db.query('INSERT INTO "billing"."plan" ("plan_id", "starts_on", "ends_on") VALUES ($1, $2, $3)', [id, from, to]);
    let n = 0;
    for (const [from, to] of ONE_MONTH) await insert(`pln_a${n++}00`.slice(0, 8), from, to);
    await expect(insert('pln_zzzz', '2026-01-31', '2026-03-03')).rejects.toThrow(/one_month/);
  });

  it('refuses months on a value that is not a date or a timestamp', () => {
    const diagnostics = compile(source.replace('rule: ends_on = starts_on + 1 months', 'rule: ends_on = starts_on + 1 months and plan_id = plan_id + 1 months')).diagnostics;
    expect(diagnostics.map((d) => d.message)).toEqual([
      'urn:demo:utc:billing:invariant:one_month: rule: "+ months" works on a timestamp or a date, not on a string (at column 46 of the rule)',
    ]);
  });
});

describe('a day in SQL', () => {
  it('is 24 hours, also in a session whose clocks change that day', async () => {
    const db = new PGlite();
    await db.exec("SET TIME ZONE 'Europe/Paris'");
    // The due query of the clock fixture adds 7 days to the time of an authorization: here across 29 March 2026 in Paris.
    const due = (await import(new URL('./fixtures/clock/expected/domain.store.generated.ts', import.meta.url).href)) as Record<string, (now: string, limit: number) => { text: string }>;
    const text = Object.entries(due).find(([name]) => name.startsWith('selectPayment'))![1]('2026-11-23T00:00:00Z', 10).text;
    expect(text).toContain("7 * INTERVAL '24 hours'");
    const at = (await db.query<{ t: string }>("SELECT (TIMESTAMPTZ '2026-03-25T12:00:00Z' + 7 * INTERVAL '24 hours') AT TIME ZONE 'UTC' AS t")).rows[0]!.t;
    expect(new Date(at).toISOString()).toBe('2026-04-01T12:00:00.000Z');
  });
});
