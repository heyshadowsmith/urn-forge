/**
 * The target of the plan of failure_message: a rule's text for a failure is `failure_message`, in the
 * manifest and in each failure of a result. Each test is it.fails until its step.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileManifest } from '../src/compile.js';

/** A test of the target that does not pass yet: it.fails until its step is built, then it. */
const target = it.fails;

const BOOKING = readFileSync(new URL('./fixtures/booking/domain.manifest.yaml', import.meta.url), 'utf8');
const booking = { reference: 'ABCDEFGH', party_size: 0, state: 'confirmed', starts_at: '2026-11-24T19:00:00Z', ends_at: '2026-11-24T21:00:00Z', contact: { email: 'ada@example.com' } };

describe('a failure', () => {
  target('has failure_message, not message, in runOperation and in check', async () => {
    const generated = (await import('./fixtures/booking/generated/domain.generated.js')) as unknown as Record<string, (...args: unknown[]) => { failures: Record<string, unknown>[] }>;
    const { core } = (await import('./fixtures/booking/core.js')) as { core: unknown };
    const ran = generated['runOperation']!(core, 'seat_booking', { reference: 'ABCDEFGH', stored_booking: booking });
    expect(ran.failures).toEqual([{ definition: 'party_size', rule: 'minimum', path: 'stored_booking.party_size', failure_message: 'Must be at least 1' }]);
    const checked = generated['check']!('party_size', 0);
    expect(checked.failures).toEqual([{ definition: 'party_size', rule: 'minimum', path: '', failure_message: 'Must be at least 1' }]);
  });
});

describe('the manifest', () => {
  const asFailureMessage = BOOKING.replace(/^ {4}message: /gm, '    failure_message: ');

  target('takes failure_message on a rule', () => {
    expect(compileManifest(asFailureMessage).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  target('refuses message, and says to write failure_message', () => {
    const compiled = compileManifest(BOOKING);
    expect(compiled.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'manifest-shape', path: ['rules', 'at_least', 'message'], message: expect.stringContaining('failure_message') }),
    );
  });

  target('refuses a {parameter} in failure_message that the rule does not have', () => {
    const text = asFailureMessage.replace('    failure_message: Must be at least {limit}', '    failure_message: Must be at least {bound}');
    expect(compileManifest(text).diagnostics).toContainEqual(expect.objectContaining({ code: 'invalid-message', path: ['rules', 'at_least', 'failure_message'] }));
  });
});
