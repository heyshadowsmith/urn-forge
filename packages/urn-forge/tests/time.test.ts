/**
 * The current time: rules read `now` and `today`, which the shell gives, and a timestamp takes
 * minutes, hours and days. The target is tests/fixtures/time; each rule runs at fixed times on
 * each side of its edge.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import { checkRule, parseRule, printRule, stripColumns, type RuleField } from '../src/rules/index.js';
import { indexFeatureSource } from '../src/verify/feature-index.js';
import { checkGherkin } from '../src/verify/gherkin.js';
import type { GateContext } from '../src/verify/types.js';

const REFUND = 'urn:demo:time:payment:operation:refund_payment';
const CHECK_OUT = 'urn:demo:time:hold:operation:check_out';
const PAUSE = 'urn:demo:time:pause:operation:pause';

const source = readFileSync(new URL('./fixtures/time/domain.manifest.yaml', import.meta.url), 'utf8');
const runtimeFile = new URL('./fixtures/time/expected/domain.runtime.generated.ts', import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtime: any = existsSync(runtimeFile) ? await import(runtimeFile.href) : undefined;

const seen: unknown[] = [];
const core = {
  [REFUND]: (_input: unknown, current: Record<string, unknown>, now: string) => runtime.ok({ ...current, status: 'refunded', refunded_at: now }),
  [CHECK_OUT]: (_input: unknown, current: Record<string, unknown>) => runtime.ok({ ...current, status: 'CONVERTED' }),
  [PAUSE]: (input: unknown, current: unknown, now: string) => (seen.push([current, now]), runtime.ok(input)),
};

describe('the time in the rule language', () => {
  const fields: Record<string, RuleField> = {
    at: { primitive: 'timestamp', required: true, many: false },
    day: { primitive: 'date', required: true, many: false },
    n: { primitive: 'integer', required: true, many: false },
  };
  const problems = (rule: string) => {
    const parsed = parseRule(rule);
    if (!parsed.ok) return [parsed.problem.message];
    return checkRule(parsed.expr, fields).map((p) => p.message);
  };

  it('reads minutes, hours and days after a value, and prints them', () => {
    const parsed = parseRule('at + n  hours < at+(n + 1) days');
    expect(parsed.ok && printRule(stripColumns(parsed.expr))).toBe('at + n hours < at + (n + 1) days');
    expect(problems('at + 15 minutes > at - 2 hours')).toEqual([]);
  });

  it('refuses a time on anything but a timestamp, and a timestamp with no unit', () => {
    expect(problems('at + 2 > at')).toEqual(['"+" on a timestamp needs a unit: write 2 hours, 15 minutes or 180 days']);
    expect(problems('day + 2 hours > day')).toEqual(['"+ hours" works on a timestamp, not on a date; a date counts days: write today + 1']);
    expect(problems('at + 1.5 hours > at')).toEqual(['1.5 is not an integer, so it cannot count hours']);
    expect(problems('2 hours > at')).toEqual(['a time of hours is only the right side of + or - on a timestamp']);
  });

  it('refuses now in an invariant, which must hold at any time', () => {
    expect(problems('at < now')).toEqual([
      '"now" is the time of a call, which a rule on a value alone cannot read: an invariant must hold at any time; use now in requires or ensures',
    ]);
  });
});

describe('the time target compiles', () => {
  it('with no diagnostics', () => {
    expect(compile(source).diagnostics).toEqual([]);
  });
});

describe('the runtime of the time target', () => {
  const payment = { payment_id: 'pay_abcd1234', status: 'captured', captured_at: '2026-01-01T12:00:00Z' };
  const refund = (now: string) => runtime.executeOperation(REFUND, { payment_id: 'pay_abcd1234' }, core, { current: payment, now });

  it('allows a refund on day 180 and refuses it after, to the millisecond', () => {
    expect(refund('2026-06-30T12:00:00Z')).toMatchObject({ ok: true, output: { refunded_at: '2026-06-30T12:00:00Z' } });
    expect(refund('2026-06-30T12:00:00.001Z')).toMatchObject({ ok: false, error: { urn: 'urn:demo:time:payment:error:refund_window_closed' } });
  });

  it('checks that the answer carries the time of the call', () => {
    const late = { [REFUND]: (_i: unknown, current: Record<string, unknown>) => runtime.ok({ ...current, status: 'refunded', refunded_at: '2026-01-02T00:00:00Z' }) };
    expect(runtime.executeOperation(REFUND, { payment_id: 'pay_abcd1234' }, late, { current: payment, now: '2026-02-01T00:00:00Z' })).toMatchObject({
      ok: false,
      kind: 'ContractViolation',
      issues: [{ message: `the handler for ${REFUND} answered a value that breaks ensures: output.refunded_at is present and output.refunded_at = now` }],
    });
  });

  it('refuses a check-out at the expiry, and allows it a millisecond before', () => {
    const hold = { hold_id: 'hld_abcd1234', status: 'ACTIVE', expires_at: '2026-11-22T18:10:00Z' };
    const run = (now: string) => runtime.executeOperation(CHECK_OUT, { hold_id: 'hld_abcd1234' }, core, { current: hold, now });
    expect(run('2026-11-22T18:09:59.999Z')).toMatchObject({ ok: true });
    expect(run('2026-11-22T18:10:00Z')).toMatchObject({ ok: false, error: { urn: 'urn:demo:time:hold:error:hold_expired', message: 'Hold hld_abcd1234 expired at 2026-11-22T18:10:00Z' } });
  });

  it('compares a date with today, the UTC date of now, and gives the handler the time', () => {
    const run = (resume_on: string) => runtime.executeOperation(PAUSE, { resume_on }, core, { now: '2026-11-22T23:59:59Z' });
    expect(run('2026-11-22')).toMatchObject({ ok: false, error: { urn: 'urn:demo:time:pause:error:invalid_resume_date' } });
    seen.length = 0;
    expect(run('2026-11-23')).toMatchObject({ ok: true });
    expect(seen).toEqual([[undefined, '2026-11-22T23:59:59Z']]);
    expect(run('2027-02-20')).toMatchObject({ ok: true });
    expect(run('2027-02-21')).toMatchObject({ ok: false });
  });

  it('needs a UTC time from the shell', () => {
    const message = `${PAUSE} reads the time of the call: pass it as { now }, a UTC timestamp such as 2026-11-22T18:00:00Z`;
    expect(runtime.executeOperation(PAUSE, {}, core)).toMatchObject({ ok: false, kind: 'ContractViolation', issues: [{ message }] });
    expect(runtime.executeOperation(PAUSE, {}, core, { now: '2026-11-22T18:00:00+01:00' })).toMatchObject({ ok: false, kind: 'ContractViolation', issues: [{ message }] });
  });
});

describe('gate 3 for the time', () => {
  const ir = compile(source).ir!;
  const gate3 = (steps: string) =>
    checkGherkin({ ir, features: { directory: 'features', features: [indexFeatureSource(`Feature: f\n  @${PAUSE}\n  Scenario: s\n${steps}`, 'f.feature')!], problems: [] }, boundaryCoverage: 'warn' } as unknown as GateContext)
      .problems.filter((p) => p.code === 'invalid-time')
      .map((p) => p.message);
  const run = '    When I run the operation with:\n      | resume_on |\n      | 2026-12-01 |\n';

  it('asks for the time, as a UTC timestamp', () => {
    expect(gate3(run)).toEqual([`${PAUSE} has rules that read the time; give it with Given the time is "<timestamp>" before the operation runs`]);
    expect(gate3(`    Given the time is "2026-11-22 18:00"\n${run}`)).toEqual(['"2026-11-22 18:00" is not a UTC timestamp; write one such as 2026-11-22T18:00:00Z']);
    expect(gate3(`    Given the time is "2026-11-22T18:00:00Z"\n${run}`)).toEqual([]);
  });
});
