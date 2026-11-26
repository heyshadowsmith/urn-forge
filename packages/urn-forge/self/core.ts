// urn-forge's own core. Each function calls the function the compiler really uses, so the
// scenarios in self/features test the toolchain, not a copy of it.
import { allowsBreaking } from '../src/diff/command.js';
import { typeName } from '../src/generate/code.js';
import { answer, type DomainCore } from './generated/domain.generated.js';

export const core = {
  to_type_name: ({ definition_name }) => answer('named_type', { type_name: typeName(definition_name) }),
  judge_version_change: ({ from_version, to_version }) => {
    const { allowed, why } = allowsBreaking(from_version, to_version);
    return allowed ? answer('breaking_allowed', { reason: why }) : answer('breaking_refused', { reason: why });
  },
  // Step 0 of the plan: each new function answers wrongly, until it calls the real one.
  name_part: () => answer('part_urn', { urn: 'urn:wrong' }),
  check_namespace: ({ candidate }) => answer('namespace_accepted', { candidate }),
  judge_weaker_contract: () => answer('breaking_allowed', { reason: 'not judged yet' }),
  judge_bound_change: () => answer('bound_judged', { direction: 'same' }),
} satisfies DomainCore;
