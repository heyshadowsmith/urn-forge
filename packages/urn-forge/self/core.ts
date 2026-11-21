// urn-forge's own functional core. Each handler delegates to the function the compiler
// really uses, so the scenarios in self/features test the toolchain, not a copy of it.
import { parseShortKey } from '../src/meta-schema.js';
import { toBrandIdentifier, toUrn } from '../src/naming.js';
import { fail, ok, type DomainCoreImplementation } from './generated/domain.runtime.generated';

export const core = {
  'urn:urn_forge:toolchain:naming:operation:to_brand_identifier':
    ({ context, identifier }) => ok({ brand_identifier: toBrandIdentifier(context, identifier) }),
  'urn:urn_forge:toolchain:naming:operation:to_urn':
    (address) => ok({ urn: toUrn(address) }),
  'urn:urn_forge:toolchain:naming:operation:parse_short_key': ({ short_key }) => {
    const parsed = parseShortKey(short_key);
    if (parsed.ok) return ok(parsed.value);
    // parseShortKey checked the grammar, so the second segment is the kind as written.
    const kind_segment = short_key.split('.')[1] ?? '';
    switch (parsed.code) {
      case 'unknown-kind':
        return fail('urn:urn_forge:toolchain:naming:error:unknown_kind', { short_key, kind_segment });
      default:
        return fail('urn:urn_forge:toolchain:naming:error:invalid_short_key', { short_key });
    }
  },
} satisfies DomainCoreImplementation;
