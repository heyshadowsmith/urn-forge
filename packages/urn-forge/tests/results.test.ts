/**
 * Results and declared errors in the generated runtime, on
 * urn-forge's own domain: `parse_short_key` and its real core.
 */
import { describe, expect, it } from 'vitest';
import { core } from '../self/core.js';
import {
  executeOperation,
  fail,
  ok,
  type DomainCoreImplementation,
  type DomainError,
} from '../self/generated/domain.runtime.generated.js';

const PARSE = 'urn:urn_forge:toolchain:naming:operation:parse_short_key';
const TO_URN = 'urn:urn_forge:toolchain:naming:operation:to_urn';
const UNKNOWN = 'urn:urn_forge:toolchain:naming:error:unknown_kind';
const INVALID = 'urn:urn_forge:toolchain:naming:error:invalid_short_key';

describe('executeOperation with declared errors', () => {
  it('returns the output of ok(…)', () => {
    expect(executeOperation(PARSE, { short_key: 'geometry.field.radius' }, core)).toEqual({
      ok: true,
      urn: PARSE,
      output: { context: 'geometry', kind: 'field', identifier: 'radius' },
      events: [],
    });
  });

  it('returns a DomainError with its metadata, parsed fields and rendered message', () => {
    expect(executeOperation(PARSE, { short_key: 'policy.widget.placed' }, core)).toEqual({
      ok: false,
      kind: 'DomainError',
      urn: PARSE,
      error: {
        urn: UNKNOWN,
        category: 'validation',
        retryable: false,
        message: 'Kind widget in policy.widget.placed is not a kind',
        fields: { kind: UNKNOWN, short_key: 'policy.widget.placed', kind_segment: 'widget' },
      },
    });
    expect(executeOperation(PARSE, { short_key: 'geometry.radius' }, core)).toMatchObject({
      kind: 'DomainError',
      error: { urn: INVALID, message: 'Short key geometry.radius is not <context>.<kind>.<identifier> in lowercase snake_case' },
    });
  });

  it('reports an error the operation does not declare as a ContractViolation', () => {
    const wrong = { ...core, [TO_URN]: () => fail(UNKNOWN, { short_key: 'a.widget.b', kind_segment: 'widget' }) };
    expect(executeOperation(TO_URN, { namespace: 'a', domain: 'b', context: 'c', kind: 'field', identifier: 'd' }, wrong as unknown as DomainCoreImplementation)).toMatchObject({
      ok: false,
      kind: 'ContractViolation',
      issues: [{ message: `${TO_URN} failed with ${UNKNOWN}, which it does not declare` }],
    });
  });

  it('reports error fields that break their schema as a ContractViolation, tagged with the field', () => {
    const sloppy = { ...core, [PARSE]: () => fail(UNKNOWN, { short_key: 'a.Widget.b', kind_segment: 'Widget' }) };
    const result = executeOperation(PARSE, { short_key: 'a.widget.b' }, sloppy satisfies DomainCoreImplementation);
    expect(result).toMatchObject({
      ok: false,
      kind: 'ContractViolation',
      issues: [{ path: 'kind_segment', fieldUrn: 'urn:urn_forge:toolchain:naming:field:kind_segment' }],
    });
  });
});

describe('ok, fail and DomainError (type level, checked by tsc)', () => {
  it('fail requires the named error\'s fields, and a fieldless error needs none', () => {
    const full = fail(UNKNOWN, { short_key: 'a.widget.b', kind_segment: 'widget' });
    // @ts-expect-error unknown_kind needs kind_segment too
    const partial = fail(UNKNOWN, { short_key: 'a.widget.b' });
    // @ts-expect-error invalid_short_key has no kind_segment
    const extra = fail(INVALID, { short_key: 'x', kind_segment: 'widget' });
    expect([full, partial, extra, ok(1)]).toBeDefined();
  });

  it('a handler may only fail with its own operation\'s errors', () => {
    const handlers = {
      ...core,
      // @ts-expect-error to_urn declares no errors
      [TO_URN]: () => fail(INVALID, { short_key: 'x' }),
    } satisfies DomainCoreImplementation;
    expect(handlers).toBeDefined();
  });

  it('DomainError narrows its fields by error URN', () => {
    const describe = (error: DomainError<typeof PARSE>): string => {
      switch (error.urn) {
        case UNKNOWN:
          return error.fields.kind_segment;
        case INVALID:
          // @ts-expect-error invalid_short_key has no kind_segment
          return error.fields.kind_segment;
      }
    };
    expect(describe).toBeDefined();
  });
});
