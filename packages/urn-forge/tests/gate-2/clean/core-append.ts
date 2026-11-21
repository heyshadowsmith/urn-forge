import type { CustomerCustomerId, PolicyLimit, PolicyPolicy, PolicyPremium } from './generated/domain.schemas.generated';
// as const and a type import are not forging.
export const PERILS = ['fire', 'flood'] as const;
export function limitOf(limit: PolicyLimit): string {
  return limit;
}
