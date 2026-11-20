/**
 * The kind registry (foundations plan, phase 3): each kind declares its schema, its
 * reference slots and how its IR node is built, and passes 3–4 run generically over them.
 */
import { describe, expect, it } from 'vitest';
import { compile } from '../src/engine.js';
import {
  KINDS,
  KIND_NAMES,
  NOT_YET_SUPPORTED_KINDS,
  namedKinds,
  referenceLabel,
  referenceOccurrences,
} from '../src/kinds/index.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { SEGMENT_PATTERN } from '../src/grammar.js';
import { parseShortKey } from '../src/meta-schema.js';

const HEADER = 'manifest:\n  namespace: demo\n  domain: math\n  version: 0.1.0\n';

describe('kind registry', () => {
  it('lists each kind with the group it fills in the manifest and the IR', () => {
    expect(KIND_NAMES).toEqual(['field', 'entity', 'operation', 'error']);
    expect(KIND_NAMES.map((k) => KINDS[k].group)).toEqual(['fields', 'entities', 'operations', 'errors']);
  });

  it('declares where each kind makes references, and what they may name', () => {
    expect(Object.fromEntries(KIND_NAMES.map((k) => [k, KINDS[k].references]))).toEqual({
      field: [],
      entity: [{ path: ['fields', '*', 'ref'], targets: ['field'] }],
      operation: [
        { path: ['input'], targets: ['entity'] },
        { path: ['output'], targets: ['entity'] },
        { path: ['errors', '*'], targets: ['error'] },
      ],
      error: [{ path: ['fields', '*', 'ref'], targets: ['field'] }],
    });
  });

  it('accepts registered kinds before checking the not-yet-supported list', () => {
    for (const kind of KIND_NAMES) expect(parseShortKey(`a.${kind}.b`).ok).toBe(true);
    for (const kind of NOT_YET_SUPPORTED_KINDS) {
      expect(parseShortKey(`a.${kind}.b`)).toMatchObject({ ok: false, code: 'unsupported-kind' });
    }
    expect(parseShortKey('a.widget.b')).toMatchObject({ ok: false, code: 'unknown-kind' });
  });

  it('matches the kinds self/ declares for naming.field.kind, so the dogfood domain stays in step', () => {
    const manifest = parse(readFileSync(fileURLToPath(new URL('../self/domain.manifest.yaml', import.meta.url)), 'utf8')) as Record<string, { oneOf?: string[] }>;
    expect(manifest['naming.field.kind']?.oneOf).toEqual(KIND_NAMES);
  });

  it('matches the segment grammar self/ declares for its segment fields', () => {
    const manifest = parse(readFileSync(fileURLToPath(new URL('../self/domain.manifest.yaml', import.meta.url)), 'utf8')) as Record<string, { regex?: string }>;
    for (const field of ['context', 'identifier', 'namespace', 'domain']) {
      expect(`^${manifest[`naming.field.${field}`]?.regex}$`, field).toBe(SEGMENT_PATTERN.source);
    }
  });

  it('names kinds with their article', () => {
    expect(namedKinds(['field'])).toBe('a field');
    expect(namedKinds(['entity', 'field'])).toBe('an entity or a field');
  });
});

describe('referenceOccurrences', () => {
  const slots = KINDS.entity.references;

  it('expands list wildcards into concrete paths and labels', () => {
    const decl = { description: 'x', fields: [{ ref: 'a.field.b', required: true }, { ref: 'a.field.c', required: false }] };
    expect(referenceOccurrences(slots, decl)).toEqual([
      { path: ['fields', 0, 'ref'], label: 'fields[0].ref', shortKey: 'a.field.b', targets: ['field'] },
      { path: ['fields', 1, 'ref'], label: 'fields[1].ref', shortKey: 'a.field.c', targets: ['field'] },
    ]);
  });

  it('skips paths the entry does not have', () => {
    expect(referenceOccurrences([{ path: ['emits', '*'], targets: ['entity'] }], { description: 'x' })).toEqual([]);
    expect(referenceOccurrences(KINDS.operation.references, { input: 'a.entity.b' })).toEqual([
      { path: ['input'], label: 'input', shortKey: 'a.entity.b', targets: ['entity'] },
    ]);
  });

  it('labels paths the way messages name them', () => {
    expect(referenceLabel(['input'])).toBe('input');
    expect(referenceLabel(['fields', 2, 'ref'])).toBe('fields[2].ref');
    expect(referenceLabel(['errors', 0])).toBe('errors[0]');
  });
});

describe('generic passes', () => {
  it('report every bad reference of every kind in one run, each at its position', () => {
    const body =
      'a.field.b: { primitive: float }\n' +
      'a.entity.c:\n' +
      '  description: C\n' +
      '  fields: [{ ref: a.field.missing }, { ref: a.entity.c }]\n' +
      'a.operation.d:\n' +
      '  description: D\n' +
      '  input: a.field.b\n' +
      '  output: a.operation.d\n';
    const diagnostics = compile(`${HEADER}${body}`).diagnostics;
    expect(diagnostics.map((d) => [d.code, d.urn, d.location?.line])).toEqual([
      ['unresolved-ref', 'urn:demo:math:a:entity:c', 8],
      ['wrong-ref-kind', 'urn:demo:math:a:entity:c', 8],
      ['wrong-ref-kind', 'urn:demo:math:a:operation:d', 11],
      ['wrong-ref-kind', 'urn:demo:math:a:operation:d', 12],
    ]);
  });
});

describe('error messages', () => {
  it('parse into text and placeholders, keeping other braces as text', async () => {
    const { parseMessage } = await import('../src/kinds/error.js');
    expect(parseMessage('Policy {policy_id} is already {state}')).toEqual([
      { text: 'Policy ' },
      { field: 'policy_id' },
      { text: ' is already ' },
      { field: 'state' },
    ]);
    expect(parseMessage('{a}{b}')).toEqual([{ field: 'a' }, { field: 'b' }]);
    expect(parseMessage('No placeholders, a lone { and }')).toEqual([{ text: 'No placeholders, a lone { and }' }]);
    expect(parseMessage('Typo {Quantity}')).toEqual([{ text: 'Typo ' }, { field: 'Quantity' }]);
  });
});
