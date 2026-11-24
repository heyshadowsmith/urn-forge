// The core: a function for each operation of the manifest. `satisfies DomainCore` makes
// `verify` (gate 1) fail when a function is missing or has the wrong type. The harness,
// runOperation, checks each input before the core runs and each answer after.
import { answer, type DomainCore } from './generated/domain.generated';

export const core = {
  split: ({ total_cents, people }) => {
    if (total_cents % people.length !== 0) return answer('uneven_split', { total_cents });
    return answer('share', { share_cents: total_cents / people.length });
  },
} satisfies DomainCore;
