import { fail, ok, type DomainCoreImplementation } from './generated/domain.runtime.generated';

const BASE_CENTS = { domestic: 500, international: 1500 } as const;
const PER_KG_CENTS = { domestic: 100, international: 300 } as const;
const EXPRESS_LIMIT_GRAMS = 5000;

export const core = {
  'urn:demo:shipping:quote:operation:quote_shipping': ({ weight_grams, zone, express }) => {
    if (express && weight_grams > EXPRESS_LIMIT_GRAMS) {
      return fail('urn:demo:shipping:quote:error:too_heavy_for_express', { weight_grams });
    }
    // A branded value cannot index an object. Give it its plain type first.
    const area: 'domestic' | 'international' = zone;
    const kilograms = Math.ceil(weight_grams / 1000);
    const price = BASE_CENTS[area] + kilograms * PER_KG_CENTS[area];
    return ok({ price_cents: express ? price * 2 : price });
  },
} satisfies DomainCoreImplementation;
