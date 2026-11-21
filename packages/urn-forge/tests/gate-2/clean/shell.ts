// A shell may parse: the generated schemas make branded values.
import * as v from 'valibot';
import { PolicyLimitSchema } from './generated/domain.schemas.generated';
import { executeOperation } from './generated/domain.runtime.generated';
import { core } from './core';

export function limitFrom(raw: string) {
  return v.parse(PolicyLimitSchema, raw);
}
export function run(body: unknown) {
  const shape = body as Record<string, unknown>;
  return executeOperation('urn:acme:insurance:policy:operation:issue_policy', shape, core);
}
