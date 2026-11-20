/**
 * Gate 3: Gherkin traceability, MVP checks (spec §8 checks 1–2; boundary coverage is cut).
 *
 * 1. Tags. Every `@urn:…` tag resolves to a URN in the IR, and every operation has at
 *    least one feature or scenario tagged with it.
 * 2. Headers. In a scenario tagged (directly or via its feature, rule or examples) with an
 *    operation URN, every DataTable header and every `Examples` header must be a field key
 *    of the operation's input or output entity (the plan's "Spec gaps" #2 widens spec §8,
 *    which allowed input keys only). Under an entity tag, headers must be that entity's keys.
 *
 * Reads the feature files only; it does not run them.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator, type Feature, type Location, type Scenario, type Step, type TableRow, type Tag } from '@cucumber/messages';
import type { UniversalIR, Urn } from '../ir/types.js';
import { displayPath, type GateResult } from './types.js';

export interface GherkinGateOptions {
  readonly cwd: string;
  readonly featuresDir: string;
  readonly ir: UniversalIR;
}

interface Scope {
  readonly tags: readonly Tag[];
}

async function featureFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.feature'))
    .map((e) => join(e.parentPath, e.name))
    .sort();
}

export async function checkGherkin(options: GherkinGateOptions): Promise<GateResult> {
  const { ir } = options;
  const problems: string[] = [];
  const covered = new Set<string>();
  let featureCount = 0;
  let scenarioCount = 0;

  let files: string[];
  try {
    files = await featureFiles(options.featuresDir);
  } catch (error) {
    files = [];
    problems.push(`${displayPath(options.cwd, options.featuresDir, relative)}  cannot read features: ${(error as Error).message}`);
  }

  for (const file of files) {
    const label = displayPath(options.cwd, file, relative);
    const at = (location: Location | undefined) =>
      location ? `${label}:${location.line}:${location.column ?? 1}` : label;

    let feature: Feature | undefined;
    try {
      const parser = new Parser(new AstBuilder(IdGenerator.incrementing()), new GherkinClassicTokenMatcher());
      feature = parser.parse(await readFile(file, 'utf8')).feature;
    } catch (error) {
      problems.push(`${label}  cannot parse: ${(error as Error).message.split('\n')[0]}`);
      continue;
    }
    if (!feature) continue;
    featureCount += 1;

    /** Checks each tag resolves; returns the URNs that resolved. */
    const resolveTags = (tags: readonly Tag[]) => {
      for (const tag of tags) {
        if (!tag.name.startsWith('@urn:')) continue;
        const urn = tag.name.slice(1);
        const known = urn in ir.fields || urn in ir.entities || urn in ir.operations;
        if (!known) problems.push(`${at(tag.location)}  tag ${tag.name} does not resolve to a URN in the manifest`);
        if (urn in ir.operations) covered.add(urn);
      }
    };

    /** Allowed header names for a scope, or undefined when no URN tag constrains it. */
    const allowedHeaders = (scopes: readonly Scope[], where: Location): { keys: Set<string>; owner: string } | undefined => {
      const urns = [...new Set(scopes.flatMap((s) => s.tags.map((t) => t.name.slice(1))))];
      const operations = urns.filter((u) => u in ir.operations) as Urn[];
      const entities = urns.filter((u) => u in ir.entities) as Urn[];
      if (operations.length + entities.length > 1) {
        problems.push(`${at(where)}  scenario is tagged with more than one operation or entity: ${[...operations, ...entities].join(', ')}`);
        return undefined;
      }
      const keysOf = (entityUrn: Urn) => ir.entities[entityUrn]?.fields.map((f) => f.name) ?? [];
      const [operation] = operations;
      if (operation) {
        const op = ir.operations[operation]!;
        return { keys: new Set([...keysOf(op.input), ...keysOf(op.output)]), owner: `the input or output of ${operation}` };
      }
      const [entity] = entities;
      return entity ? { keys: new Set(keysOf(entity)), owner: entity } : undefined;
    };

    const checkHeader = (row: TableRow | undefined, allowed: ReturnType<typeof allowedHeaders>) => {
      if (!row || !allowed) return;
      for (const cell of row.cells) {
        if (!allowed.keys.has(cell.value)) {
          problems.push(
            `${at(cell.location)}  table header "${cell.value}" is not a field key of ${allowed.owner} ` +
              `(allowed: ${[...allowed.keys].join(', ')})`,
          );
        }
      }
    };

    const checkSteps = (steps: readonly Step[], allowed: ReturnType<typeof allowedHeaders>) => {
      for (const step of steps) checkHeader(step.dataTable?.rows[0], allowed);
    };

    const checkScenario = (scenario: Scenario, scopes: readonly Scope[], background: readonly Step[]) => {
      scenarioCount += 1;
      resolveTags(scenario.tags);
      const own = [...scopes, scenario];
      checkSteps([...background, ...scenario.steps], allowedHeaders(own, scenario.location));
      for (const examples of scenario.examples) {
        resolveTags(examples.tags);
        checkHeader(examples.tableHeader, allowedHeaders([...own, examples], examples.location));
      }
    };

    resolveTags(feature.tags);
    let featureBackground: readonly Step[] = [];
    for (const child of feature.children) {
      if (child.background) featureBackground = child.background.steps;
      if (child.scenario) checkScenario(child.scenario, [feature], featureBackground);
      if (child.rule) {
        resolveTags(child.rule.tags);
        let ruleBackground = featureBackground;
        for (const ruleChild of child.rule.children) {
          if (ruleChild.background) ruleBackground = [...featureBackground, ...ruleChild.background.steps];
          if (ruleChild.scenario) checkScenario(ruleChild.scenario, [feature, child.rule], ruleBackground);
        }
      }
    }
  }

  const operations = Object.keys(ir.operations);
  for (const urn of operations) {
    if (!covered.has(urn)) {
      problems.push(`${displayPath(options.cwd, options.featuresDir, relative)}  operation ${urn} has no feature or scenario tagged @${urn}`);
    }
  }

  return {
    gate: 3,
    name: 'gherkin',
    ok: problems.length === 0,
    summary: `${featureCount} feature(s), ${scenarioCount} scenario(s), ${operations.filter((u) => covered.has(u)).length}/${operations.length} operations tagged`,
    problems,
  };
}
