import { ok, type DomainCoreImplementation } from './generated/domain.runtime.generated';

export const core = {
  'urn:demo:math:geometry:operation:compute_area':
    ({ radius }) => ok({ area: Math.PI * radius ** 2 }),
  'urn:demo:math:arithmetic:operation:safe_divide':
    ({ dividend, divisor }) => ok({ quotient: dividend / divisor }),
} satisfies DomainCoreImplementation;
