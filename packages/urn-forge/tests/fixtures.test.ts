import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const root = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

describe('math fixture', () => {
  it('manifest YAML parses and declares the expected atoms', () => {
    const doc = parse(readFileSync(root('tests/fixtures/math.manifest.yaml'), 'utf8')) as Record<string, unknown>;
    expect(doc['manifest']).toEqual({ namespace: 'demo', domain: 'math', version: '0.1.0' });
    expect(Object.keys(doc).filter((k) => k !== 'manifest').sort()).toEqual([
      'arithmetic.entity.division',
      'arithmetic.entity.division_result',
      'arithmetic.field.dividend',
      'arithmetic.field.divisor',
      'arithmetic.field.quotient',
      'arithmetic.operation.safe_divide',
      'geometry.entity.circle',
      'geometry.entity.circle_area',
      'geometry.field.area',
      'geometry.field.radius',
      'geometry.operation.compute_area',
    ]);
  });

  it.each([
    ['safe_divide', 'urn:demo:math:arithmetic:operation:safe_divide'],
    ['compute_area', 'urn:demo:math:geometry:operation:compute_area'],
  ])('%s.feature parses and is tagged with its operation URN', (name, urn) => {
    const parser = new Parser(new AstBuilder(IdGenerator.uuid()), new GherkinClassicTokenMatcher());
    const doc = parser.parse(readFileSync(root(`example/features/${name}.feature`), 'utf8'));
    expect(doc.feature?.tags.map((t) => t.name)).toEqual([`@${urn}`]);
  });

  it('example/core.ts exists', () => {
    expect(readFileSync(root('example/core.ts'), 'utf8')).toContain('satisfies DomainCoreImplementation');
  });
});
