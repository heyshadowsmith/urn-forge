import type { CustomerCustomerId, PolicyLimit, PolicyPolicy, PolicyPremium } from './generated/domain.schemas.generated';
// as const and a type import are not forging.
export const PERILS = ['fire', 'flood'] as const;
export function limitOf(limit: PolicyLimit): string {
  return limit;
}
// urn-forge/exact makes plain values, so a core may import it (third blind trial).
import { addDecimal } from 'urn-forge/exact';
export function doubled(limit: PolicyLimit): string {
  return addDecimal(limit, limit);
}
