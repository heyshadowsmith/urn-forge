import type { CustomerCustomerId, PolicyLimit, PolicyPolicy, PolicyPremium } from './generated/domain.schemas.generated';
export function premiumOf(raw: string): PolicyPremium {
  return JSON.parse(raw);
}
