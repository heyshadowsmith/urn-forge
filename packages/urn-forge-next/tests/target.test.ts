/**
 * The target of phase 1 of the manifest redesign: the booking fixture loads with no diagnostic, and
 * each kind of mistake stops it with its code at its place. Each test is it.fails until its step.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';
import { loadManifest } from '../src/index.js';

const fixture = readFileSync(new URL('./fixtures/booking/domain.manifest.yaml', import.meta.url), 'utf8');

/** The fixture, changed by `edit` on its parsed YAML. */
function changed(edit: (manifest: any) => void): string {
  const manifest = parse(fixture);
  edit(manifest);
  return stringify(manifest);
}

/** The codes and paths of the diagnostics of a manifest. */
function problems(text: string): { code: string; path: string }[] {
  return loadManifest(text).diagnostics.map((d) => ({ code: d.code, path: d.path.join('.') }));
}

/** A test of the target that does not pass yet: it.fails until its step is built, then it. */
const target = { names: it, syntax: it, rules: it, all: it };

describe('the booking fixture', () => {
  target.all('loads with no error, and warns of the deprecated note that booking uses', () => {
    const { model, diagnostics } = loadManifest(fixture);
    expect(diagnostics).toEqual([
      { code: 'deprecated-use', severity: 'warning', path: ['definitions', 'booking', 'properties', 6], message: 'booking uses the deprecated definition note' },
    ]);
    expect(model).toBeDefined();
  });
});

describe('names', () => {
  target.names('a definition that is not declared is unknown-definition at its place', () => {
    const text = changed((m) => (m.definitions.booking.properties[1] = 'party'));
    expect(problems(text)).toContainEqual({ code: 'unknown-definition', path: 'definitions.booking.properties.1' });
  });

  target.names('a cycle of types is type-cycle', () => {
    const text = changed((m) => {
      m.definitions.first = { description: 'A first', type: 'second' };
      m.definitions.second = { description: 'A second', type: 'first' };
    });
    expect(problems(text)).toContainEqual({ code: 'type-cycle', path: 'definitions.first.type' });
  });

  target.names('an identifier that is not a required property is invalid-identifier', () => {
    const text = changed((m) => (m.definitions.booking.identifier = 'note'));
    expect(problems(text)).toContainEqual({ code: 'invalid-identifier', path: 'definitions.booking.identifier' });
  });
});

describe('rules', () => {
  target.syntax('a rule that does not parse is rule-syntax', () => {
    const text = changed((m) => (m.rules.is_seated.rule = "output.state == 'seated' &&"));
    expect(problems(text)).toContainEqual({ code: 'rule-syntax', path: 'rules.is_seated.rule' });
  });

  target.rules('an optional property read without has() is rule-guard', () => {
    const text = changed((m) => (m.rules.large_party_pays_deposit.rule = 'self.party_size < 7 || self.deposit > 0'));
    expect(problems(text)).toContainEqual({ code: 'rule-guard', path: 'definitions.booking.rules.1' });
  });

  target.rules('a rule that reads input, applied to a definition, is rule-scope', () => {
    const text = changed((m) => m.definitions.booking.rules.push('is_seated'));
    expect(problems(text)).toContainEqual({ code: 'rule-scope', path: 'definitions.booking.rules.4' });
  });

  target.rules('minimum on a string is rule-type', () => {
    const text = changed((m) => m.definitions.reference.rules.push({ minimum: 1 }));
    expect(problems(text)).toContainEqual({ code: 'rule-type', path: 'definitions.reference.rules.1' });
  });

  target.rules('an argument of the wrong type is rule-argument', () => {
    const text = changed((m) => (m.definitions.party_size.rules[0] = { minimum: 'one' }));
    expect(problems(text)).toContainEqual({ code: 'rule-argument', path: 'definitions.party_size.rules.0.minimum' });
  });
});
