import type { CustomerCustomerId, PolicyLimit, PolicyPolicy, PolicyPremium } from './generated/domain.schemas.generated';
// @ts-expect-error a number is not a limit
export const limit: PolicyLimit = 1;
