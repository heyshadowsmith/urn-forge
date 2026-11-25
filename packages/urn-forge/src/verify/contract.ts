/**
 * Gate 5: the contract against a base, such as the target branch of a pull request. It fails when
 * the contract is weaker than at the base and the version does not say so:
 *
 * - a rule of a definition, an output or an operation is removed (removed-rule);
 * - an argument of a rule, or the text of a rule of the manifest, lets the rule accept more, or other
 *   values (wider-rule);
 * - an output, or an operation with its outputs, is removed (removed-output);
 * - a scenario is removed (removed-scenario): a scenario is known by its name, and each row of an
 *   outline counts.
 *
 * A weaker contract is allowed when the version changes to one that allows a breaking change: a new
 * major version, a pre-release, or another 0.x version. Then each change is a warning, so that a
 * reviewer sees it.
 */
import { AstBuilder, compile, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';
import { print } from '../cel/print.js';
import type { Code } from '../codes.js';
import { argumentDirection, type Side } from '../diff/classify.js';
import { allowsBreaking } from '../diff/command.js';
import type { Application } from '../rules.js';
import type { FeatureFile } from './gherkin.js';
import type { GateOutcome, GateProblem } from './types.js';

export interface ContractGateInput {
  /** The git ref of the base, as the user gave it. */
  readonly base: string;
  /** The contract at the base, or a reason that there is nothing to compare. */
  readonly old: { readonly side: Side; readonly features: readonly FeatureFile[] } | { readonly nothing: string } | { readonly problem: string };
  readonly next: { readonly side: Side; readonly features: readonly FeatureFile[] };
  /** The file and the line of a part of the manifest, for a problem. */
  readonly at: (path: readonly (string | number)[]) => { readonly file: string; readonly line?: number };
}

/** The number of scenarios of each name, with each row of an outline as one scenario. */
export function scenarioNames(features: readonly FeatureFile[]): Map<string, { count: number; file: string }> {
  const names = new Map<string, { count: number; file: string }>();
  for (const feature of features) {
    let pickles;
    try {
      pickles = compile(new Parser(new AstBuilder(IdGenerator.uuid()), new GherkinClassicTokenMatcher()).parse(feature.text), feature.path, IdGenerator.uuid());
    } catch {
      // Gate 3 reports a feature that does not parse.
      continue;
    }
    for (const pickle of pickles) {
      const entry = names.get(pickle.name) ?? { count: 0, file: feature.path };
      entry.count++;
      names.set(pickle.name, entry);
    }
  }
  return names;
}

/** The place of a use of a rule: `definitions.party_size`, `operations.seat_booking.booking`, `operations.seat_booking`. */
function placeOf(application: Application): { key: string; path: (string | number)[] } {
  const place = application.place;
  if (place.kind === 'definition') return { key: `definitions.${place.definition}`, path: ['definitions', place.definition] };
  if (place.kind === 'output') return { key: `operations.${place.operation}.${place.object}`, path: ['operations', place.operation, 'output'] };
  return { key: `operations.${place.operation}`, path: ['operations', place.operation] };
}

function uses(side: Side): Map<string, { application: Application; path: (string | number)[] }> {
  const map = new Map<string, { application: Application; path: (string | number)[] }>();
  for (const application of side.applications) {
    const { key, path } = placeOf(application);
    map.set(`${key} ${application.rule.name}`, { application, path });
  }
  return map;
}

export function contractGate(input: ContractGateInput): GateOutcome {
  const outcome = (pass: boolean, summary: string, problems: readonly GateProblem[]): GateOutcome => ({ gate: 5, name: 'contract', pass, summary, problems });
  if ('problem' in input.old) {
    return outcome(false, `cannot read ${input.base}`, [{ code: 'base-unreadable', severity: 'error', file: input.base, message: input.old.problem }]);
  }
  if ('nothing' in input.old) return outcome(true, `${input.old.nothing}: nothing to compare`, []);

  const old = input.old.side;
  const next = input.next.side;
  const changes: { code: Code; path: (string | number)[]; file?: string; message: string }[] = [];
  const add = (code: Code, path: (string | number)[], message: string, file?: string): void => {
    changes.push({ code, path, message, ...(file ? { file } : {}) });
  };

  // The rules: each use of a rule of the base, by its place and its name.
  const before = uses(old);
  const after = uses(next);
  for (const [key, { application, path }] of before) {
    const [place] = key.split(' ');
    const now = after.get(key);
    // The rules of an output or an operation that is removed go with it: removed-output names it.
    const owner = application.place;
    const operation = owner.kind === 'definition' ? undefined : next.model.operations[owner.operation];
    if (owner.kind !== 'definition' && (!operation || (owner.kind === 'output' && !operation.outputs.some((o) => o.object === owner.object)))) continue;
    if (!now) {
      add('removed-rule', path, `the rule ${application.rule.name} is removed from ${place}`);
      continue;
    }
    for (const parameter of now.application.rule.parameters) {
      const was = application.arguments[parameter];
      const is = now.application.arguments[parameter];
      const direction = argumentDirection(now.application, was, is);
      if (direction === 'wider' || direction === 'both') {
        add('wider-rule', now.path, `${application.rule.name} of ${place} is now ${JSON.stringify(is)}, not ${JSON.stringify(was)}: it accepts ${direction === 'wider' ? 'more' : 'other values'}`);
      }
    }
  }
  // The text of a rule of the manifest that is still in use.
  for (const rule of Object.values(next.model.rules)) {
    const was = old.model.rules[rule.name];
    if (!was?.expr || !rule.expr || print(was.expr) === print(rule.expr)) continue;
    if (!next.applications.some((a) => a.rule.name === rule.name && a.owner === next.model)) continue;
    add('wider-rule', ['rules', rule.name, 'rule'], `the rule ${rule.name} is now ${print(rule.expr)}, not ${print(was.expr)}: it can accept other values`);
  }

  // The outputs.
  for (const operation of Object.values(old.model.operations)) {
    const now = next.model.operations[operation.name];
    if (!now) {
      add('removed-output', ['operations'], `the operation ${operation.name} is removed, with its outputs ${operation.outputs.map((o) => o.object).join(', ')}`);
      continue;
    }
    for (const output of operation.outputs) {
      if (!now.outputs.some((o) => o.object === output.object)) add('removed-output', ['operations', operation.name, 'output'], `the output ${output.object} of ${operation.name} is removed`);
    }
  }

  // The scenarios.
  const scenariosBefore = scenarioNames(input.old.features);
  const scenariosAfter = scenarioNames(input.next.features);
  for (const [name, { count, file }] of scenariosBefore) {
    const left = scenariosAfter.get(name)?.count ?? 0;
    if (left >= count) continue;
    add('removed-scenario', [], count === 1 ? `the scenario "${name}" is removed` : `${count - left} of the ${count} scenarios "${name}" are removed`, file);
  }

  const from = old.model.header.version;
  const to = next.model.header.version;
  const allowed = from !== to && allowsBreaking(from, to).allowed;
  const problems: GateProblem[] = changes.map((c) => {
    const where = c.file ? { file: c.file } : input.at(c.path);
    return { code: c.code, severity: allowed ? 'warning' : 'error', ...where, message: c.message };
  });
  if (changes.length === 0) return outcome(true, `the contract keeps each rule, output and scenario of ${input.base}`, []);
  if (allowed) return outcome(true, `${changes.length} change(s) make the contract weaker than ${input.base}, allowed by the version ${from} → ${to}`, problems);
  return outcome(false, `${changes.length} change(s) make the contract weaker than ${input.base}, and the version ${from} → ${to} does not allow it`, problems);
}
