// The core: a function for each operation of the manifest. The harness, runOperation, checks the
// input before the core runs and the answer after it, with the rules of the output it gives.
import { answer, type DomainCore } from './generated/domain.generated';

const BASE_CENTS = { domestic: 500, international: 1500 } as const;
const PER_KG_CENTS = { domestic: 100, international: 300 } as const;
const EXPRESS_LIMIT_GRAMS = 5000;

export const core = {
  quote_shipping: ({ weight_grams, zone, express }) => {
    if (express && weight_grams > EXPRESS_LIMIT_GRAMS) return answer('too_heavy_for_express', { weight_grams });
    const kilograms = Math.ceil(weight_grams / 1000);
    const price = BASE_CENTS[zone] + kilograms * PER_KG_CENTS[zone];
    return answer('quote', { price_cents: express ? price * 2 : price });
  },
} satisfies DomainCore;
