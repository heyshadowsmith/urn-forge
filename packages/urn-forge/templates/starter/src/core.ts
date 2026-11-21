// The functional core: one handler for each operation in the manifest. `satisfies` makes
// `verify` (gate 1) fail when a handler is missing or has the wrong type.
import { fail, ok, type DomainCoreImplementation } from './generated/domain.runtime.generated';

export const core = {
  'urn:{{namespace}}:{{domain}}:bill:operation:split': ({ total_cents, people }) => {
    const count = people.length;
    if (total_cents % count !== 0) {
      return fail('urn:{{namespace}}:{{domain}}:bill:error:uneven_split', { total_cents });
    }
    return ok({ share_cents: total_cents / count });
  },
} satisfies DomainCoreImplementation;
