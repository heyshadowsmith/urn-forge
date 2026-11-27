/**
 * The target of maps (decision 1 of the plan of urn-forge's own contract): `type: map` with `values`,
 * and `keys` for the rules of a key. A map's type, its check, and the map forms of the rule language.
 * Each test is it.fails until its step.
 */
import { describe, expect, it } from 'vitest';
import { checksOf, compileManifest } from '../src/compile.js';
import { generatedFile } from '../src/generate/code.js';
import type { Failure } from '../src/generate/runtime.js';

/** A test of the target that does not pass yet: it.fails until its step is built, then it. */
const target = { maps: it.fails };

const manifest = (rule = 'size(self.counts) >= 0') => `manifest: {namespace: test, domain: maps, version: 0.1.0}
definitions:
  tag: {description: The name of a tag, type: string, rules: [{pattern: '^[a-z]+$'}]}
  count: {description: A count, type: integer, rules: [{minimum: 0}]}
  counts: {description: A count for each tag, type: map, keys: tag, values: count}
  tally:
    description: The counts of the tags
    type: object
    properties: [counts]
    rules:
      - required: [counts]
      - the_rule
rules:
  the_rule: {description: The rule of the test, rule: ${JSON.stringify(rule)}, failure_message: The rule is broken}
`;

function compiled(rule?: string) {
  const c = compileManifest(manifest(rule));
  if (!c.model) throw new Error(c.diagnostics.map((d) => `${d.code}: ${d.message}`).join('\n'));
  return c;
}

function failures(value: unknown, rule?: string): Failure[] {
  const c = compiled(rule);
  const out: Failure[] = [];
  checksOf(c.model!, c.applications)['tally']!(value, '', out);
  return out;
}

describe('a map', () => {
  target.maps('has the type of a record of its values', () => {
    const c = compiled();
    expect(generatedFile(c.model!, c.applications, 'domain.manifest.yaml', () => 'x')).toContain('export type Counts = Readonly<Record<string, Count>>;');
  });

  target.maps('checks each value with the check of its values, and each key with the check of its keys', () => {
    expect(failures({ counts: { red: 2, blue: 0 } })).toEqual([]);
    expect(failures({ counts: { red: -1 } })).toEqual([{ definition: 'count', rule: 'minimum', path: 'counts.red', failure_message: expect.any(String) }]);
    expect(failures({ counts: { Red: 1 } }).map((f) => [f.definition, f.rule, f.path])).toEqual([['tag', 'pattern', 'counts.Red']]);
    expect(failures({ counts: ['a'] }).map((f) => [f.definition, f.rule])).toEqual([['counts', 'type']]);
  });

  target.maps('has the map forms of the rule language', () => {
    expect(failures({ counts: { red: 2 } }, "'red' in self.counts && self.counts['red'] == 2 && size(self.counts) == 1")).toEqual([]);
    expect(failures({ counts: { red: 2, blue: 3 } }, 'self.counts.all(t, self.counts[t] > 2)').map((f) => f.rule)).toEqual(['the_rule']);
    expect(failures({ counts: { red: 2, blue: 3 } }, "self.counts.exists(t, t == 'blue')")).toEqual([]);
    // A key that is not in the map breaks the rule, as an index out of a list does.
    expect(failures({ counts: {} }, "self.counts['red'] != 1").map((f) => f.rule)).toEqual(['the_rule']);
  });

  target.maps('refuses a map whose keys are not strings, and a rule that gives a map the wrong key', () => {
    const bad = compileManifest(manifest().replace('keys: tag', 'keys: count'));
    expect(bad.diagnostics.map((d) => `${d.code}: ${d.message}`)).toContain('manifest-shape: counts: the keys of a map are a string definition, and count is an integer');
    expect(compileManifest(manifest('self.counts[1] == 1')).diagnostics.map((d) => d.code)).toContain('rule-type');
  });
});
