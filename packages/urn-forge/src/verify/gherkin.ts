/**
 * Gate 3: the scenarios. It reads each feature as Cucumber does, with each row of an Examples table
 * as its own scenario, and checks that:
 *
 * - each step names an operation, a definition, an output or a rule that exists (unknown-name);
 * - each operation runs in a scenario (uncovered-operation);
 * - each output of each operation is the answer of a scenario (uncovered-output);
 * - each rule that a definition applies is broken by a scenario, on an input or on a checked value
 *   (uncovered-rule).
 *
 * A gap is a warning, or an error with `coverage: 'error'` in the config.
 */
import { AstBuilder, compile, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';
import { STEPS } from '../gherkin/steps.js';
import type { Model } from '../model.js';
import type { Application } from '../rules.js';
import type { GateOutcome, GateProblem } from './types.js';

export interface FeatureFile {
  readonly path: string;
  readonly text: string;
}

export interface GherkinGateInput {
  readonly model: Model;
  readonly applications: readonly Application[];
  readonly features: readonly FeatureFile[];
  readonly coverage: 'warn' | 'error';
}

export function gherkinGate(input: GherkinGateInput): GateOutcome {
  const { model, applications, features } = input;
  const problems: GateProblem[] = [];
  const gap = input.coverage === 'error' ? 'error' : 'warning';
  const ran = new Set<string>();
  const answered = new Set<string>();
  const broken = new Set<string>();
  let scenarios = 0;

  // The rules of each definition, as `definition rule`; a definition named as a type has its root's rules too.
  const applied = new Set<string>();
  for (const a of applications) {
    if (a.place.kind !== 'definition') continue;
    const owner = a.place.definition;
    for (const d of Object.values(model.definitions)) {
      for (let x = d; ; x = model.definitions[x.type]!) {
        if (x.name === owner) applied.add(`${d.name} ${a.rule.name}`);
        if (x.root === x.name) break;
      }
    }
  }

  for (const feature of features) {
    let pickles;
    // The line of each step of the feature, by the id of its node: a step of an outline has the line of
    // the outline's step.
    const lineOf = new Map<string, number>();
    try {
      const document = new Parser(new AstBuilder(IdGenerator.uuid()), new GherkinClassicTokenMatcher()).parse(feature.text);
      const visit = (node: unknown): void => {
        if (Array.isArray(node)) return node.forEach(visit);
        if (typeof node !== 'object' || node === null) return;
        const record = node as { id?: unknown; keyword?: unknown; location?: { line?: number } };
        if (typeof record.id === 'string' && typeof record.keyword === 'string' && record.location?.line) lineOf.set(record.id, record.location.line);
        Object.values(node).forEach(visit);
      };
      visit(document.feature);
      pickles = compile(document, feature.path, IdGenerator.uuid());
    } catch (error) {
      problems.push({ code: 'feature-syntax', severity: 'error', file: feature.path, message: (error as Error).message });
      continue;
    }
    for (const pickle of pickles) {
      scenarios++;
      let operation: string | undefined;
      for (const step of pickle.steps) {
        const text = step.text;
        const line = step.astNodeIds.map((id) => lineOf.get(id)).find((l) => l !== undefined);
        const unknown = (message: string): void => {
          problems.push({ code: 'unknown-name', severity: 'error', file: feature.path, ...(line ? { line } : {}), message });
        };
        let m: RegExpExecArray | null;
        if ((m = STEPS.run.exec(text))) {
          operation = m[1]!;
          if (!model.operations[operation]) unknown(`${operation} is not an operation of the manifest`);
          else ran.add(operation);
        } else if ((m = STEPS.check.exec(text))) {
          operation = undefined;
          if (!model.definitions[m[1]!]) unknown(`${m[1]} is not a definition of the manifest`);
        } else if ((m = STEPS.output.exec(text) ?? STEPS.outputWith.exec(text))) {
          const object = m[1]!;
          const contract = operation ? model.operations[operation] : undefined;
          if (contract) {
            if (!contract.outputs.some((o) => o.object === object)) unknown(`${object} is not an output of ${operation}`);
            else answered.add(`${operation} ${object}`);
          }
        } else if ((m = STEPS.inputRejected.exec(text) ?? STEPS.valueRejected.exec(text))) {
          const [, rule, definition] = m as unknown as [string, string, string];
          if (!model.definitions[definition]) unknown(`${definition} is not a definition of the manifest`);
          else if (!applied.has(`${definition} ${rule}`) && rule !== 'type' && rule !== 'properties') unknown(`${rule} is not a rule of ${definition}`);
          else broken.add(`${definition} ${rule}`);
        }
      }
    }
  }

  for (const operation of Object.values(model.operations)) {
    if (!ran.has(operation.name)) {
      problems.push({ code: 'uncovered-operation', severity: gap, file: 'features', message: `no scenario runs ${operation.name}; add one with When I run "${operation.name}" with:` });
      continue;
    }
    for (const output of operation.outputs) {
      if (!answered.has(`${operation.name} ${output.object}`)) {
        problems.push({
          code: 'uncovered-output',
          severity: gap,
          file: 'features',
          message: `no scenario of ${operation.name} answers ${output.object}; add one that ends with Then the output is "${output.object}"`,
        });
      }
    }
  }
  const seen = new Set<string>();
  for (const application of applications) {
    if (application.place.kind !== 'definition') continue;
    const key = `${application.place.definition} ${application.rule.name}`;
    if (seen.has(key) || broken.has(key)) continue;
    seen.add(key);
    problems.push({
      code: 'uncovered-rule',
      severity: gap,
      file: 'features',
      message: `no scenario breaks ${application.rule.name} of ${application.place.definition}; add one that ends with Then the input is rejected by "${application.rule.name}" of "${application.place.definition}", or Then the value is rejected by …`,
    });
  }

  // An outline reports a problem of one step once, not once for each row.
  const unique = new Map(problems.map((p) => [`${p.code} ${p.file} ${p.line ?? ''} ${p.message}`, p]));
  problems.splice(0, problems.length, ...unique.values());
  const errors = problems.filter((p) => p.severity === 'error').length;
  const operations = Object.keys(model.operations).length;
  return {
    gate: 3,
    name: 'gherkin',
    pass: errors === 0,
    summary: `${features.length} feature(s), ${scenarios} scenario(s), ${ran.size}/${operations} operation(s) run, ${broken.size} rule(s) broken`,
    problems,
  };
}
