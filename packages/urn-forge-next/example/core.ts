// The core of the math example. The harness, runOperation, checks each input before the core
// runs and each answer after it.
import { answer, type DomainCore } from './generated/domain.generated.js';

export const core = {
  compute_area: ({ radius }) => answer('circle_area', { area: Math.PI * radius ** 2 }),
  safe_divide: ({ dividend, divisor }) => answer('division_result', { quotient: dividend / divisor }),
} satisfies DomainCore;
