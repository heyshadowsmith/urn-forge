/**
 * The feature index (foundations plan, phase 5): every `.feature` file under a directory,
 * parsed once into scenarios with their tags, steps, tables and `Examples` values.
 *
 * It only reads: it reports files it cannot read or parse, and leaves every rule to the
 * gates. Gate 3 checks tags and headers against it today; boundary coverage and error
 * coverage read the same index, the example values above all.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator, type Location, type Scenario, type Step, type TableRow, type Tag } from '@cucumber/messages';
import type { Diagnostic, SourceLocation } from '../diagnostics.js';
import { displayPath } from './types.js';

export interface IndexedTag {
  /** With its `@`, e.g. `@urn:demo:math:arithmetic:operation:safe_divide`. */
  readonly name: string;
  readonly location: SourceLocation;
}

export interface IndexedComment {
  /** The whole line as written, `#` included. */
  readonly text: string;
  readonly location: SourceLocation;
}

export interface IndexedCell {
  readonly value: string;
  readonly location: SourceLocation;
}

export interface IndexedTable {
  readonly location: SourceLocation;
  /** The first row. */
  readonly header: readonly IndexedCell[];
  /** The rows after the header, as text. */
  readonly rows: readonly (readonly string[])[];
}

export interface IndexedStep {
  /** `When `, `Then `, `And `… as written. */
  readonly keyword: string;
  /** Without the keyword: `I run the operation with:`. */
  readonly text: string;
  readonly location: SourceLocation;
  readonly table?: IndexedTable;
  /** True when the step comes from a `Background`. */
  readonly background: boolean;
}

export interface IndexedExamples {
  /** The `Examples` block's own tags. */
  readonly tags: readonly IndexedTag[];
  readonly location: SourceLocation;
  readonly table?: IndexedTable;
}

export interface IndexedScenario {
  readonly name: string;
  readonly location: SourceLocation;
  /** The tags in scope: the feature's, the rule's and the scenario's own. */
  readonly tags: readonly IndexedTag[];
  /** Background steps first, then the scenario's own. */
  readonly steps: readonly IndexedStep[];
  readonly examples: readonly IndexedExamples[];
}

export interface IndexedFeature {
  /** Display path, relative to the current directory. */
  readonly file: string;
  readonly name: string;
  /** The feature's own tags, such as `@urn-forge:strict`. */
  readonly tags: readonly IndexedTag[];
  /** Every comment line in the file, such as `# urn-forge:waive …`. */
  readonly comments: readonly IndexedComment[];
  /** Every tag written in the file (feature, rules, scenarios, examples), each once. */
  readonly declaredTags: readonly IndexedTag[];
  readonly scenarios: readonly IndexedScenario[];
}

export interface FeatureIndex {
  /** Display path of the directory that was searched. */
  readonly directory: string;
  readonly features: readonly IndexedFeature[];
  /** Directories and files that could not be read or parsed. */
  readonly problems: readonly Diagnostic[];
}

const at = (location: Location): SourceLocation => ({ line: location.line, column: location.column ?? 1 });
const tag = (t: Tag): IndexedTag => ({ name: t.name, location: at(t.location) });

function table(rows: readonly TableRow[], location: Location): IndexedTable | undefined {
  const [header, ...body] = rows;
  if (!header) return undefined;
  return {
    location: at(location),
    header: header.cells.map((cell) => ({ value: cell.value, location: at(cell.location) })),
    rows: body.map((row) => row.cells.map((cell) => cell.value)),
  };
}

function step(s: Step, background: boolean): IndexedStep {
  const dataTable = s.dataTable && table(s.dataTable.rows, s.dataTable.location);
  return {
    keyword: s.keyword,
    text: s.text,
    location: at(s.location),
    background,
    ...(dataTable ? { table: dataTable } : {}),
  };
}

function scenario(s: Scenario, scope: readonly Tag[], background: readonly Step[]): IndexedScenario {
  return {
    name: s.name,
    location: at(s.location),
    tags: [...scope, ...s.tags].map(tag),
    steps: [...background.map((b) => step(b, true)), ...s.steps.map((own) => step(own, false))],
    examples: s.examples.map((e) => {
      const examplesTable = e.tableHeader && table([e.tableHeader, ...e.tableBody], e.location);
      return { tags: e.tags.map(tag), location: at(e.location), ...(examplesTable ? { table: examplesTable } : {}) };
    }),
  };
}

/** Parses one feature file's source. */
export function indexFeatureSource(source: string, file: string): IndexedFeature | undefined {
  const parser = new Parser(new AstBuilder(IdGenerator.incrementing()), new GherkinClassicTokenMatcher());
  const document = parser.parse(source);
  const feature = document.feature;
  if (!feature) return undefined;

  const declared: Tag[] = [...feature.tags];
  const scenarios: IndexedScenario[] = [];
  let featureBackground: readonly Step[] = [];
  for (const child of feature.children) {
    if (child.background) featureBackground = child.background.steps;
    if (child.scenario) {
      declared.push(...child.scenario.tags, ...child.scenario.examples.flatMap((e) => e.tags));
      scenarios.push(scenario(child.scenario, feature.tags, featureBackground));
    }
    if (child.rule) {
      declared.push(...child.rule.tags);
      let ruleBackground = featureBackground;
      for (const ruleChild of child.rule.children) {
        if (ruleChild.background) ruleBackground = [...featureBackground, ...ruleChild.background.steps];
        if (ruleChild.scenario) {
          declared.push(...ruleChild.scenario.tags, ...ruleChild.scenario.examples.flatMap((e) => e.tags));
          scenarios.push(scenario(ruleChild.scenario, [...feature.tags, ...child.rule.tags], ruleBackground));
        }
      }
    }
  }
  return {
    file,
    name: feature.name,
    tags: feature.tags.map(tag),
    comments: document.comments.map((c) => ({ text: c.text.trim(), location: at(c.location) })),
    declaredTags: declared.map(tag),
    scenarios,
  };
}

/** Every `.feature` file under `dir` (recursively), in path order. */
export async function indexFeatures(dir: string, cwd: string): Promise<FeatureIndex> {
  const label = displayPath(cwd, dir, relative);
  let paths: string[];
  try {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    paths = entries
      .filter((e) => e.isFile() && e.name.endsWith('.feature'))
      .map((e) => join(e.parentPath, e.name))
      .sort();
  } catch (error) {
    return {
      directory: label,
      features: [],
      problems: [{ code: 'features-unreadable', severity: 'error', file: label, message: `cannot read features: ${(error as Error).message}` }],
    };
  }

  const features: IndexedFeature[] = [];
  const problems: Diagnostic[] = [];
  for (const path of paths) {
    const file = displayPath(cwd, path, relative);
    try {
      const feature = indexFeatureSource(await readFile(path, 'utf8'), file);
      if (feature) features.push(feature);
    } catch (error) {
      problems.push({
        code: 'feature-parse-error',
        severity: 'error',
        file,
        message: `cannot parse: ${(error as Error).message.split('\n')[0]}`,
      });
    }
  }
  return { directory: label, features, problems };
}
