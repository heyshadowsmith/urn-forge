// urn-forge's own functional core. Each handler delegates to the function the compiler
// really uses, so the scenarios in self/features test the toolchain, not a copy of it.
import { toBrandIdentifier, toUrn } from '../src/naming.js';
import type { DomainCoreImplementation } from './generated/domain.runtime.generated';

export const core = {
  'urn:urn_forge:toolchain:naming:operation:to_brand_identifier':
    ({ context, identifier }) => ({ brand_identifier: toBrandIdentifier(context, identifier) }),
  'urn:urn_forge:toolchain:naming:operation:to_urn':
    (address) => ({ urn: toUrn(address) }),
} satisfies DomainCoreImplementation;
