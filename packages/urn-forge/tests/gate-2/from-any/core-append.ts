import type { CustomerCustomerId, PolicyLimit, PolicyPolicy, PolicyPremium } from './generated/domain.schemas.generated';
export function holderOf(raw: string): CustomerCustomerId {
  const id: CustomerCustomerId = JSON.parse(raw);
  return id;
}
