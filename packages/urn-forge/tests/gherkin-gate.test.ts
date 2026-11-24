/**
 * Gate 3: the scenarios run each operation, answer each output, and break each rule of a definition.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileManifest } from '../src/index.js';
import { gherkinGate } from '../src/verify/gherkin.js';

const base = new URL('./fixtures/booking/', import.meta.url);
const compiled = compileManifest(readFileSync(new URL('domain.manifest.yaml', base), 'utf8'));
const feature = readFileSync(new URL('features/seat.feature', base), 'utf8');

function gate(text: string, coverage: 'warn' | 'error' = 'warn') {
  return gherkinGate({ model: compiled.model!, applications: compiled.applications, features: [{ path: 'features/seat.feature', text }], coverage });
}

function problems(text: string, coverage: 'warn' | 'error' = 'warn'): string[] {
  return gate(text, coverage).problems.map((p) => `${p.severity} ${p.code}: ${p.message}`);
}

it('passes the booking fixture, which covers every operation, output and rule', () => {
  const outcome = gate(feature);
  expect(outcome.problems).toEqual([]);
  expect(outcome.pass).toBe(true);
  expect(outcome.summary).toBe('1 feature(s), 29 scenario(s), 1/1 operation(s) run, 23 rule(s) broken');
});

describe('a gap', () => {
  it('is a rule that no scenario breaks', () => {
    const text = feature.replace(/^.*\| maxLength .*\n/m, '');
    expect(problems(text)).toEqual([
      'warning uncovered-rule: no scenario breaks maxLength of note; add one that ends with Then the input is rejected by "maxLength" of "note", or Then the value is rejected by …',
    ]);
  });

  it('is an output that no scenario answers', () => {
    const text = feature.replace(/Then the output is "invalid_state"/g, 'Then the output is "booking"');
    expect(problems(text)).toContain('warning uncovered-output: no scenario of seat_booking answers invalid_state; add one that ends with Then the output is "invalid_state"');
  });

  it('is an operation that no scenario runs', () => {
    expect(problems('Feature: Nothing\n')).toContain('warning uncovered-operation: no scenario runs seat_booking; add one with When I run "seat_booking" with:');
  });

  it('is an error, and fails the gate, with coverage: error', () => {
    const outcome = gate('Feature: Nothing\n', 'error');
    expect(outcome.pass).toBe(false);
    expect(outcome.problems.every((p) => p.severity === 'error')).toBe(true);
  });
});

describe('a step', () => {
  it('names an operation, a definition, an output and a rule that exist', () => {
    const text = `Feature: Names
  Scenario: Wrong names
    When I run "seat" with:
      | reference |
      | ABCDEFGH  |
    When I run "seat_booking" with:
      | reference |
      | ABCDEFGH  |
    Then the output is "receipt"
    When I check a "bookings" with:
      | reference |
      | ABCDEFGH  |
    Then the value is rejected by "smallest" of "party_size"
`;
    expect(problems(text).filter((p) => p.startsWith('error'))).toEqual([
      'error unknown-name: seat is not an operation of the manifest',
      'error unknown-name: receipt is not an output of seat_booking',
      'error unknown-name: bookings is not a definition of the manifest',
      'error unknown-name: smallest is not a rule of party_size',
    ]);
  });

  it('names a rule of the definition it names, and is reported once, at its line', () => {
    const text = `Feature: Rules
  Scenario Outline: A rule of another definition
    When I check a "booking" with:
      | party_size   |
      | <party_size> |
    Then the value is rejected by "enum" of "party_size"

    Examples:
      | party_size |
      | 0          |
      | 13         |
`;
    const outcome = gate(text);
    expect(outcome.problems.filter((p) => p.code === 'unknown-name').map((p) => `${p.line}: ${p.message}`)).toEqual(['6: enum is not a rule of party_size']);
  });

  it('that does not parse is feature-syntax', () => {
    expect(problems('hello\n')[0]).toMatch(/^error feature-syntax: /);
  });
});
