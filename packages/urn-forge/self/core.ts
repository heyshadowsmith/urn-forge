// urn-forge's own core. Each function calls the function the compiler really uses, so the
// scenarios in self/features test the toolchain, not a copy of it.
import { signatures } from '../src/cel/functions.js';
import { CODES, fixOf } from '../src/codes.js';
import { argumentDirection } from '../src/diff/classify.js';
import { allowsBreaking } from '../src/diff/command.js';
import { fillMessage, typeName } from '../src/generate/code.js';
import { STEPS } from '../src/gherkin/steps.js';
import { NAMESPACE } from '../src/manifest.js';
import { standard, type Application } from '../src/rules.js';
import { partUrn } from '../src/urn.js';
import { allowsWeaker } from '../src/verify/contract.js';
import { gatePasses, GATES, uncoveredRules } from '../src/verify/types.js';
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
  fix_of: ({ code }) => answer('code_fix', { code, meaning: CODES[code].meaning, severity: CODES[code].severity, fix: fixOf(code) }),
  describe_standard_rule: ({ standard_rule_name }) => {
    const rule = standard().rules[standard_rule_name]!;
    return answer('standard_rule', { standard_rule_name, parameter_names: rule.parameters, rule_description: rule.description, failure_text: rule.failureMessage });
  },
  signatures_of: ({ function_name }) => answer('function_signatures', { function_name, signature_text: signatures(function_name) }),
  // The first step whose form the text has, as the steps of the package register them.
  match_step: ({ step_text }) => {
    const kind = (Object.keys(STEPS) as (keyof typeof STEPS)[]).find((k) => STEPS[k].test(step_text));
    return kind ? answer('matched_step', { step_text, step_kind: kind }) : answer('unmatched_step', { step_text });
  },
  judge_gate: ({ gate_number, gate_problems }) => {
    const named = { gate_number, gate_name: GATES[gate_number - 1]! };
    return gatePasses(gate_problems) ? answer('gate_passed', named) : answer('gate_failed', named);
  },
  find_uncovered_rules: ({ applied_rules, broken_rules }) => answer('rules_found', { uncovered_rules: uncoveredRules(applied_rules, broken_rules) }),
  fill_message: ({ message_text, message_arguments }) =>
    answer('filled_message', { filled_text: fillMessage(message_text, Object.fromEntries(message_arguments.map((a) => [a.argument_name, a.argument_text]))) }),
} satisfies DomainCore;
