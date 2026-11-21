/**
 * Gate 3: Gherkin traceability (spec §8: tags, headers, declared errors and boundary coverage).
 * Reads the feature index; it does not run the features.
 *
 * 1. Tags. Every `@urn:…` tag resolves to a URN in the IR, and every operation has at
 *    least one feature or scenario tagged with it.
 * 2. Headers. In a scenario tagged (directly or via its feature, rule or examples) with an
 *    operation URN, every DataTable header and every `Examples` header must be a field key
 *    of the operation's input or output entity (the plan's "Spec gaps" #2 widens spec §8,
 *    which allowed input keys only). Under an entity tag, headers must be that entity's keys.
 * 3. Required headers. The table of `When I run the operation with:` must have a column for
 *    every required field of the operation's input. To test a missing value, leave its
 *    cell empty: the step then sends the payload without that key.
 * 4. Declared errors. `Then the operation fails with "<urn>"` must name an error the
 *    scenario's operation declares (`undeclared-error`), and the table of its `:` form must
 *    name fields of that error. Every declared error should have a scenario that expects it
 *    (spec §8 error coverage): `uncovered-error` is a warning until coverage is ratcheted.
 * 5. Boundary coverage (spec §8 check 3). For each constrained input field of each tagged
 *    operation, the values its scenarios send must include every boundary case of the
 *    field's primitive (`boundaries` in src/primitives/). One `uncovered-boundary` warning per
 *    field and operation lists the missing cases. It shows the cases are present; the test
 *    run shows whether they pass.
 *
 * A boundary can be waived per field with a comment in a feature file (spec §8's escape
 * hatch; a tag cannot hold a reason, because tags cannot contain whitespace):
 *
 *   # urn-forge:waive <field URN> <reason…>
 *
 * It removes that field's boundary gaps for the operations the feature tags, and is listed
 * as a note with its reason. A waiver for a field none of those operations constrain is an
 * error; one whose field has no gap is a warning.
 *
 * Checks 4's coverage half and 5 follow the coverage mode (spec §8, warn then ratchet): their
 * gaps are warnings, unless `boundaryCoverage` is `error` or a feature tagged with the
 * operation carries `@urn-forge:strict`; then they are errors.
 */

import { FAILS_WITH_TEXT, STEP_PHRASES } from '../gherkin/phrases.js';
import type { Diagnostic, DiagnosticCode, Severity, SourceLocation } from '../diagnostics.js';
import type { UniversalIR, Urn } from '../ir/types.js';
import { boundaryCases } from '../primitives/index.js';
import { inputValues } from './input-values.js';
import type { IndexedCell, IndexedTag, IndexedTable } from './feature-index.js';
import type { Gate, GateContext, GateOutcome } from './types.js';

/** The feature tag that makes the coverage gaps of a feature's operations errors. */
export const STRICT_TAG = '@urn-forge:strict';

const WAIVER_PREFIX = /^#\s*urn-forge:waive\b/;
const WAIVER = /^#\s*urn-forge:waive\s+(urn:\S+)\s+(\S.*)$/;

interface Waiver {
  readonly file: string;
  readonly location: SourceLocation;
  readonly field: string;
  readonly reason: string;
  /** The operations of the waiver's feature. */
  readonly operations: readonly Urn[];
  /** Set when the waiver removed a gap. */
  used: boolean;
}

/** What a scope's URN tags allow in its tables. */
interface Owner {
  readonly urn: string;
  /** For messages: `the input or output of urn:…`. */
  readonly description: string;
  readonly keys: ReadonlySet<string>;
  /** For an operation: its input's required property names. */
  readonly requiredInput?: readonly string[];
  /** For an operation: its declared errors. */
  readonly errors?: readonly Urn[];
}

export function checkGherkin({ ir, features, boundaryCoverage }: GateContext): GateOutcome {
  const problems: Diagnostic[] = [...features.problems];

  // An operation is strict when any feature tagged with it is strict.
  const strictFeatures = features.features.filter((f) => f.tags.some((t) => t.name === STRICT_TAG));
  const strictOperations = new Set(
    strictFeatures.flatMap((f) => f.declaredTags.map((t) => t.name.slice(1)).filter((urn) => urn in ir.operations)),
  );
  const coverageSeverity = (operation: string): Severity =>
    boundaryCoverage === 'error' || strictOperations.has(operation) ? 'error' : 'warning';
  const covered = new Set<string>();
  /** `<operation URN> <error URN>` for each declared error some scenario expects. */
  const expectedErrors = new Set<string>();

  for (const feature of features.features) {
    const report = (code: DiagnosticCode, location: SourceLocation, message: string, urn?: string, severity: Severity = 'error') =>
      problems.push({ code, severity, file: feature.file, location, ...(urn === undefined ? {} : { urn }), message });

    // 1. Tags, each checked once where it is written.
    for (const tag of feature.declaredTags) {
      if (!tag.name.startsWith('@urn:')) continue;
      const urn = tag.name.slice(1);
      if (!(urn in ir.fields || urn in ir.entities || urn in ir.operations)) {
        report('unresolved-tag', tag.location, `tag ${tag.name} does not resolve to a URN in the manifest`);
      }
      if (urn in ir.operations) covered.add(urn);
    }

    /** The one operation or entity a set of tags names, if any. Reports more than one. */
    const ownerOf = (tags: readonly IndexedTag[], where: SourceLocation): Owner | undefined => {
      const urns = [...new Set(tags.map((t) => t.name.slice(1)))];
      const operations = urns.filter((u) => u in ir.operations) as Urn[];
      const entities = urns.filter((u) => u in ir.entities) as Urn[];
      if (operations.length + entities.length > 1) {
        report('ambiguous-tag', where, `scenario is tagged with more than one operation or entity: ${[...operations, ...entities].join(', ')}`);
        return undefined;
      }
      return operations[0] ? operationOwner(ir, operations[0]) : entities[0] ? entityOwner(ir, entities[0]) : undefined;
    };

    // 2. Unknown headers.
    const checkHeader = (header: readonly IndexedCell[], owner: Owner | undefined) => {
      if (!owner) return;
      for (const cell of header) {
        if (!owner.keys.has(cell.value)) {
          report(
            'unknown-header',
            cell.location,
            `table header "${cell.value}" is not a field key of ${owner.description} (allowed: ${[...owner.keys].join(', ')})`,
            owner.urn,
          );
        }
      }
    };

    // 3. Required input headers on the step that runs the operation.
    const checkRequired = (table: IndexedTable, owner: Owner | undefined) => {
      if (!owner?.requiredInput) return;
      const present = new Set(table.header.map((cell) => cell.value));
      const missing = owner.requiredInput.filter((name) => !present.has(name));
      if (missing.length > 0) {
        report(
          'missing-column',
          table.location,
          `the table of "${STEP_PHRASES.run}" has no column for required input field(s) ${missing.map((m) => `"${m}"`).join(', ')} ` +
            `of ${owner.urn}; to test a missing value, keep the column and leave the cell empty`,
          owner.urn,
        );
      }
    };

    for (const scenario of feature.scenarios) {
      const owner = ownerOf(scenario.tags, scenario.location);
      for (const step of scenario.steps) {
        // 4. `the operation fails with "<urn>"`, with or without a table of that error's fields.
        const failsWith = FAILS_WITH_TEXT.exec(step.text);
        if (failsWith) {
          const errorUrn = failsWith[1]!;
          if (owner?.errors) {
            if (owner.errors.includes(errorUrn as Urn)) {
              expectedErrors.add(`${owner.urn} ${errorUrn}`);
            } else {
              report(
                'undeclared-error',
                step.location,
                `"${errorUrn}" is not a declared error of ${owner.urn} ` +
                  `(errors: ${owner.errors.length > 0 ? owner.errors.join(', ') : 'none'})`,
                owner.urn,
              );
            }
          }
          if (step.table) checkHeader(step.table.header, errorOwner(ir, owner, errorUrn));
          continue;
        }
        if (!step.table) continue;
        checkHeader(step.table.header, owner);
        if (step.text === STEP_PHRASES.run) checkRequired(step.table, owner);
      }
      for (const examples of scenario.examples) {
        if (examples.table) checkHeader(examples.table.header, ownerOf([...scenario.tags, ...examples.tags], examples.location));
      }
    }
  }

  const operations = Object.keys(ir.operations);
  for (const urn of operations) {
    if (!covered.has(urn)) {
      problems.push({
        code: 'untagged-operation',
        severity: 'error',
        file: features.directory,
        urn,
        message: `operation ${urn} has no feature or scenario tagged @${urn}`,
      });
    }
  }

  // Error coverage: a warning for each declared error that no scenario of its operation expects.
  let declaredErrors = 0;
  for (const operation of Object.values(ir.operations)) {
    for (const errorUrn of operation.errors) {
      declaredErrors += 1;
      if (expectedErrors.has(`${operation.urn} ${errorUrn}`)) continue;
      problems.push({
        code: 'uncovered-error',
        severity: coverageSeverity(operation.urn),
        file: features.directory,
        urn: errorUrn,
        message: `error ${errorUrn} of ${operation.urn} has no scenario that expects it; add one with Then the operation fails with "${errorUrn}"`,
      });
    }
  }

  // Waivers: `# urn-forge:waive <field URN> <reason…>` comments.
  const waivers: Waiver[] = [];
  for (const feature of features.features) {
    const operations = [...new Set(feature.declaredTags.map((t) => t.name.slice(1)))].filter((u) => u in ir.operations) as Urn[];
    for (const comment of feature.comments) {
      if (!WAIVER_PREFIX.test(comment.text)) continue;
      const match = WAIVER.exec(comment.text);
      if (!match) {
        problems.push({
          code: 'invalid-waiver',
          severity: 'error',
          file: feature.file,
          location: comment.location,
          message: `a waiver must read "# urn-forge:waive <field URN> <reason>": ${comment.text}`,
        });
        continue;
      }
      waivers.push({ file: feature.file, location: comment.location, field: match[1]!, reason: match[2]!.trim(), operations, used: false });
    }
  }
  /** Whether a field of an operation has boundary cases, so a waiver for it can mean something. */
  const constrains = (operation: Urn, fieldUrn: string) => {
    const op = ir.operations[operation];
    const ref = op && ir.entities[op.input]?.fields.find((f) => f.field === fieldUrn);
    const field = ref && ir.fields[ref.field];
    return field !== undefined && boundaryCases(field.primitive, field.constraints).length > 0;
  };
  const waiverFor = (operation: Urn, fieldUrn: string) =>
    waivers.find((w) => w.field === fieldUrn && w.operations.includes(operation));

  // Boundary coverage, for the operations that have scenarios (an untagged one is already an error).
  const values = inputValues(ir, features);
  for (const operation of Object.values(ir.operations)) {
    if (!covered.has(operation.urn)) continue;
    for (const ref of ir.entities[operation.input]?.fields ?? []) {
      const field = ir.fields[ref.field];
      if (!field) continue;
      const sent = values.get(operation.urn)?.get(ref.name) ?? [];
      const missing = boundaryCases(field.primitive, field.constraints).filter((c) => !sent.some((value) => c.covers(value)));
      if (missing.length === 0) continue;
      const waiver = waiverFor(operation.urn, field.urn);
      if (waiver) {
        waiver.used = true;
        continue;
      }
      problems.push({
        code: 'uncovered-boundary',
        severity: coverageSeverity(operation.urn),
        file: features.directory,
        urn: field.urn,
        message: `${field.urn} in the input of ${operation.urn} has no ${missing.map((c) => c.label).join(', no ')}`,
      });
    }
  }

  // Every waiver stays visible: a note when it removed a gap, otherwise a problem.
  for (const waiver of waivers) {
    const at = { file: waiver.file, location: waiver.location, urn: waiver.field };
    if (!waiver.operations.some((op) => constrains(op, waiver.field))) {
      problems.push({
        ...at,
        code: 'unknown-waiver',
        severity: 'error',
        message: `waiver for ${waiver.field}, which is not a constrained input field of ${waiver.operations.length > 0 ? waiver.operations.join(', ') : 'any operation of this feature'}`,
      });
    } else if (waiver.used) {
      problems.push({ ...at, code: 'waived-boundary', severity: 'note', message: `boundary coverage of ${waiver.field} is waived: ${waiver.reason}` });
    } else {
      problems.push({
        ...at,
        code: 'unused-waiver',
        severity: 'warning',
        message: `waiver for ${waiver.field} waives nothing: the field has no boundary gap; remove the waiver`,
      });
    }
  }

  const scenarioCount = features.features.reduce((n, f) => n + f.scenarios.length, 0);
  const errorSummary = declaredErrors > 0 ? `, ${expectedErrors.size}/${declaredErrors} errors expected` : '';
  const featureCount = features.features.length;

  // The ratchet trigger (spec §8): once every feature is strict, the config can say so.
  if (boundaryCoverage === 'warn' && featureCount > 0 && strictFeatures.length === featureCount) {
    problems.push({
      code: 'ratchet-ready',
      severity: 'note',
      file: features.directory,
      message: `every feature is ${STRICT_TAG}; set boundaryCoverage: 'error' in the config so new features are strict too`,
    });
  }

  return {
    summary:
      `${featureCount} feature(s), ${scenarioCount} scenario(s), ` +
      `${operations.filter((u) => covered.has(u)).length}/${operations.length} operations tagged${errorSummary}, ` +
      `strict: ${strictFeatures.length}/${featureCount} features${boundaryCoverage === 'error' ? ' (boundaryCoverage: error)' : ''}` +
      (waivers.length > 0 ? `, ${waivers.length} waiver(s)` : ''),
    problems,
  };
}

function propertyNames(ir: UniversalIR, entity: Urn): string[] {
  return ir.entities[entity]?.fields.map((f) => f.name) ?? [];
}

function operationOwner(ir: UniversalIR, urn: Urn): Owner {
  const op = ir.operations[urn]!;
  return {
    urn,
    description: `the input or output of ${urn}`,
    keys: new Set([...propertyNames(ir, op.input), ...propertyNames(ir, op.output)]),
    requiredInput: ir.entities[op.input]?.fields.filter((f) => f.required).map((f) => f.name) ?? [],
    errors: op.errors,
  };
}

/** The fields an error table may name: those of `errorUrn`, when the scenario's operation declares it. */
function errorOwner(ir: UniversalIR, owner: Owner | undefined, errorUrn: string): Owner | undefined {
  // An error the operation does not declare is reported on its own (gate 3, undeclared-error).
  if (!owner?.errors?.includes(errorUrn as Urn)) return undefined;
  const error = ir.errors[errorUrn as Urn]!;
  return { urn: errorUrn, description: `the error ${errorUrn}`, keys: new Set(error.fields.map((f) => f.name)) };
}

function entityOwner(ir: UniversalIR, urn: Urn): Owner {
  return { urn, description: urn, keys: new Set(propertyNames(ir, urn)) };
}

export const gherkinGate: Gate = { number: 3, name: 'gherkin', run: checkGherkin };
