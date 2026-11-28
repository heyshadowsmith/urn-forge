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
 * A gap is always an error.
 */
import { AstBuilder, compile, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';
import { STEPS } from '../gherkin/patterns.js';
import { tableValue, type DefinitionsTable } from '../gherkin/cells.js';
import { propertyType } from '../manifest.js';
import { variantsOf, type Model } from '../model.js';
import type { Application } from '../rules.js';
import { decide } from '../self.js';
import { gateOutcome, type GateOutcome, type GateProblem } from './types.js';

export interface FeatureFile {
  readonly path: string;
  readonly text: string;
}

export interface GherkinGateInput {
  readonly model: Model;
  readonly applications: readonly Application[];
  readonly features: readonly FeatureFile[];
  /** The problems of the features path: it does not exist, or it is a file that is not a .feature file. */
  readonly inputProblems?: readonly GateProblem[];
}

export function gherkinGate(input: GherkinGateInput): GateOutcome {
  const { model, applications, features } = input;
  const problems: GateProblem[] = [...(input.inputProblems ?? [])];
  const gap = 'error';
  const ran = new Set<string>();
  const answered = new Set<string>();
  const broken = new Set<string>();
  let scenarios = 0;
  // The variants of the unions that the values of the tables reach, as `union value`.
  const reached = new Set<string>();
  const table: DefinitionsTable = Object.fromEntries(
    Object.values(model.definitions).map((d) => {
      const root = model.definitions[d.root]!;
      return [d.name, { base: d.base, ...(root.items ? { items: root.items } : {}), ...(root.properties ? { properties: root.properties } : {}), ...(root.propertyTypes ? { propertyTypes: root.propertyTypes } : {}), ...(root.tag !== undefined && root.variants && !Array.isArray(root.variants) ? { tag: root.tag, tagged: root.variants as Readonly<Record<string, string>> } : {}) }];
    }),
  );
  const reach = (value: unknown, name: string): void => {
    const definition = model.definitions[name];
    if (!definition || value === undefined) return;
    const root = model.definitions[definition.root]!;
    const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
    if (definition.base === 'object' && isObject) for (const p of root.properties ?? []) reach((value as Record<string, unknown>)[p], propertyType(root, p));
    else if (definition.base === 'array' && Array.isArray(value)) value.forEach((item) => reach(item, root.items!));
    else if (definition.base === 'map' && isObject) Object.values(value).forEach((v) => reach(v, root.values!));
    else if (definition.base === 'union') {
      if (root.tag !== undefined && isObject && !Array.isArray(root.variants)) {
        const tag = (value as Record<string, unknown>)[root.tag];
        const variant = typeof tag === 'string' ? (root.variants as Record<string, string>)[tag] : undefined;
        if (variant) {
          reached.add(`${root.name} ${tag}`);
          reach(value, variant);
        }
      } else {
        const variant = variantsOf(root).find((v) => matches(value, model.definitions[v]?.base));
        if (variant) {
          reached.add(`${root.name} ${variant}`);
          reach(value, variant);
        }
      }
    }
  };
  const matches = (value: unknown, base: string | undefined): boolean =>
    base === 'array' ? Array.isArray(value)
    : base === 'object' || base === 'map' ? typeof value === 'object' && value !== null && !Array.isArray(value)
    : base === 'integer' || base === 'number' ? typeof value === 'number'
    : base === 'boolean' ? typeof value === 'boolean'
    : typeof value === 'string';
  /** The value of the table of a step, for the variants that it reaches; a table that does not read is no value. */
  const reachTable = (rows: readonly (readonly string[])[] | undefined, definition: string): void => {
    if (!rows) return;
    try {
      reach(tableValue(rows, definition, table), definition);
    } catch {
      // The steps report a table that does not read; the gate counts only what it can read.
    }
  };

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
        const rows = step.argument?.dataTable?.rows.map((r) => r.cells.map((c) => c.value));
        if ((m = STEPS.run.exec(text))) {
          operation = m[1]!;
          if (!model.operations[operation]) unknown(`${operation} is not an operation of the manifest`);
          else {
            ran.add(operation);
            reachTable(rows, model.operations[operation]!.input);
          }
        } else if ((m = STEPS.check.exec(text))) {
          operation = undefined;
          if (!model.definitions[m[1]!]) unknown(`${m[1]} is not a definition of the manifest`);
          else reachTable(rows, m[1]!);
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
  for (const union of Object.values(model.definitions)) {
    if (union.base !== 'union' || union.root !== union.name || !union.variants) continue;
    const each = union.tag !== undefined && !Array.isArray(union.variants) ? Object.keys(union.variants) : variantsOf(union);
    for (const variant of each) {
      if (reached.has(`${union.name} ${variant}`)) continue;
      problems.push({
        code: 'uncovered-variant',
        severity: gap,
        file: 'features',
        message: `no scenario reaches the variant ${variant} of ${union.name}; add one whose table has a value of it`,
      });
    }
  }
  const appliedRules = applications.flatMap((a) => (a.place.kind === 'definition' ? [`${a.place.definition} ${a.rule.name}`] : []));
  const { uncovered_rules } = decide('find_uncovered_rules', { applied_rules: appliedRules, broken_rules: [...broken] }).value;
  for (const key of uncovered_rules) {
    const [definition, rule] = key.split(' ') as [string, string];
    problems.push({
      code: 'uncovered-rule',
      severity: gap,
      file: 'features',
      message: `no scenario breaks ${rule} of ${definition}; add one that ends with Then the input is rejected by "${rule}" of "${definition}", or Then the value is rejected by …`,
    });
  }

  // An outline reports a problem of one step once, not once for each row.
  const unique = new Map(problems.map((p) => [`${p.code} ${p.file} ${p.line ?? ''} ${p.message}`, p]));
  problems.splice(0, problems.length, ...unique.values());
  const errors = problems.filter((p) => p.severity === 'error').length;
  const operations = Object.keys(model.operations).length;
  return gateOutcome(3, `${features.length} feature(s), ${scenarios} scenario(s), ${ran.size}/${operations} operation(s) run, ${broken.size} rule(s) broken`, problems);
}
