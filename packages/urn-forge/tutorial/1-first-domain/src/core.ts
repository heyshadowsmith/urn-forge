// The core: a function for each operation of the manifest. The harness, runOperation, checks the
// input before the core runs and the answer after it.
import { answer, type DomainCore } from './generated/domain.generated';

const BASE_CENTS = { domestic: 500, international: 1500 } as const;
const PER_KG_CENTS = { domestic: 100, international: 300 } as const;

export const core = {
  quote_shipping: ({ weight_grams, zone, express }) => {
    const kilograms = Math.ceil(weight_grams / 1000);
    const price = BASE_CENTS[zone] + kilograms * PER_KG_CENTS[zone];
    return answer('quote', { price_cents: express ? price * 2 : price });
  },
} satisfies DomainCore;
