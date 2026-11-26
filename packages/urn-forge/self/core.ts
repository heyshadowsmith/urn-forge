// urn-forge's own core. Each function calls the function the compiler really uses, so the
// scenarios in self/features test the toolchain, not a copy of it.
import { argumentDirection } from '../src/diff/classify.js';
import { allowsBreaking } from '../src/diff/command.js';
import { typeName } from '../src/generate/code.js';
import { NAMESPACE } from '../src/manifest.js';
import { standard, type Application } from '../src/rules.js';
import { partUrn } from '../src/urn.js';
import { allowsWeaker } from '../src/verify/contract.js';
import { answer, type DomainCore } from './generated/domain.generated.js';

export const core = {
  to_type_name: ({ definition_name }) => answer('named_type', { type_name: typeName(definition_name) }),
  judge_version_change: ({ from_version, to_version }) => {
    const { allowed, why } = allowsBreaking(from_version, to_version);
    return allowed ? answer('breaking_allowed', { reason: why }) : answer('breaking_refused', { reason: why });
  },
  name_part: ({ namespace_name, domain_name, part_kind, part_name }) =>
    answer('part_urn', { urn: partUrn({ namespace: namespace_name, domain: domain_name }, part_kind, part_name) }),
  check_namespace: ({ candidate }) =>
    NAMESPACE.test(candidate) ? answer('namespace_accepted', { candidate }) : answer('namespace_refused', { candidate }),
  judge_weaker_contract: ({ from_version, to_version }) => {
    const { allowed, why } = allowsWeaker(from_version, to_version);
    return allowed ? answer('breaking_allowed', { reason: why }) : answer('breaking_refused', { reason: why });
  },
  // argumentDirection takes a rule as the compiler gives it: the rule of the standard set, by its name.
  judge_bound_change: ({ bound_rule, old_bound, new_bound }) => {
    const rule = standard().rules[bound_rule]!;
    const direction = argumentDirection({ rule } as unknown as Application, old_bound, new_bound);
    return answer('bound_judged', { direction: direction as 'narrower' | 'wider' | 'same' });
  },
} satisfies DomainCore;
