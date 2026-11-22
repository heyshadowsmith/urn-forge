/**
 * Gate 3: Gherkin traceability: tags, headers, declared errors and boundary coverage.
 * Reads the feature index; it does not run the features.
 *
 * 1. Tags. Every `@urn:…` tag resolves to an atom in the IR (a field, entity, operation or
 *    error; only operation and entity tags choose the table keys), and every operation has at
 *    least one feature or scenario tagged with it.
 * 2. Headers. In a scenario tagged (directly or via its feature, rule or examples) with an
 *    operation URN, every DataTable header and every `Examples` header must be a field key
 *    of the operation's input or output entity. Under an entity tag, headers must be that entity's keys.
 * 3. Required headers. The table of `When I run the operation with:` must have a column for
 *    every required field of the operation's input. To test a missing value, leave its
 *    cell empty: the step then sends the payload without that key.
 * 4. Declared errors. `Then the operation fails with "<urn>"` must name an error the
 *    scenario's operation declares (`undeclared-error`), and the table of its `:` form must
 *    name fields of that error. Every declared error should have a scenario that expects it:
 *    `uncovered-error` is a warning until coverage is ratcheted.
 * 5. Boundary coverage. For each constrained input field of each tagged
 *    operation, the values its scenarios send must include every boundary case of the
 *    field's primitive (`boundaries` in src/primitives/). One `uncovered-boundary` warning per
 *    field and operation lists the missing cases. It shows the cases are present; the test
 *    run shows whether they pass.
 *
 * A boundary can be waived per field with a comment in a feature file (an escape
 * hatch; a tag cannot hold a reason, because tags cannot contain whitespace):
 *
 *   # urn-forge:waive <field URN> <reason…>
 *
 * It removes that field's boundary gaps for the operations the feature tags, and is listed
 * as a note with its reason. A waiver for a field none of those operations constrain is an
 * error; one whose field has no gap is a warning.
 *
 * Checks 4's coverage half and 5 follow the coverage mode (warn, then ratchet): their
 * gaps are warnings, unless `boundaryCoverage` is `error` or a feature tagged with the
 * operation carries `@urn-forge:strict`; then they are errors.
 */

import { currentWord, emitsNoneOfUrn, emitsUrn, failsWithUrn, timeOf, recordedAsUrn, rejectedByUrn, STEP_PHRASES } from '../gherkin/phrases.js';
import { substitute } from './input-values.js';
import type { Diagnostic, DiagnosticCode, Severity, SourceLocation } from '../diagnostics.js';
import { readsTime, valueField, type UniversalIR, type Urn } from '../ir/types.js';
import { invariantsWithin, keyName } from './shapes.js';
import { listBoundaries } from '../kinds/field-refs.js';
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
  /** For an operation: its events. */
  readonly emits?: readonly Urn[];
  /** For an operation: the events that its declared errors record as (recordAs). */
  readonly records?: readonly Urn[];
  /** For an operation: the invariants of its input entity. */
  readonly invariants?: readonly Urn[];
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
  /** `<operation URN> <event URN>` for each event some scenario expects. */
  const expectedEvents = new Set<string>();
  /** Each idempotent operation that a scenario runs again. */
  const repeated = new Set<string>();
  /** Each timed change that a scenario calls for a record that is not due. */
  const notDue = new Set<string>();
  /** Each event that a scenario expects a success without: the other side of a \`when\` rule. */
  const absentEvents = new Set<string>();
  /** `<operation URN> <event URN>` for each record of a refusal some scenario expects. */
  const expectedRecords = new Set<string>();
  /** `<operation URN> <invariant URN>` for each input invariant some scenario breaks. */
  const brokenInvariants = new Set<string>();
  /** `<operation URN> <state>` for each `from` state some scenario starts from, and `<operation URN> *otherwise` for a refused state. */
  const coveredStates = new Set<string>();

  for (const feature of features.features) {
    const report = (code: DiagnosticCode, location: SourceLocation, message: string, urn?: string, severity: Severity = 'error') =>
      problems.push({ code, severity, file: feature.file, location, ...(urn === undefined ? {} : { urn }), message });

    // 1. Tags, each checked once where it is written.
    for (const tag of feature.declaredTags) {
      if (!tag.name.startsWith('@urn:')) continue;
      const urn = tag.name.slice(1);
      if (!(urn in ir.fields || urn in ir.entities || urn in ir.operations || urn in ir.events || urn in ir.errors || urn in (ir.invariants ?? {}))) {
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
      const operation = owner && owner.urn in ir.operations ? ir.operations[owner.urn as Urn]! : undefined;
      const change = operation?.changes;
      // The record that the operation changes or reads, and the verb for messages.
      const record = change ?? operation?.reads;
      const verb = change ? 'changes' : 'reads';
      /** The states of the current record that the scenario sets, and whether it expects `otherwise`. */
      const states = new Set<string>();
      let hasCurrent = false;
      let hasCaller = false;
      let hasTime = false;
      let expectsOtherwise = false;
      let runs: SourceLocation | undefined;
      for (const step of scenario.steps) {
        if (step.text === STEP_PHRASES.run) runs ??= step.location;
        // `When I run the operation again with:`: a repeat of an idempotent call.
        if (step.text === STEP_PHRASES.runAgain && owner && operation?.idempotency) repeated.add(owner.urn);
        // `Then the operation is not due`: a timed change, called too early.
        if (step.text === STEP_PHRASES.notDue) {
          if (operation?.due && owner) notDue.add(owner.urn);
          else report('uncovered-due', step.location, `"${step.text}" is for an operation with due, and ${owner?.urn ?? 'the scenario'} has none`, owner?.urn ?? '');
          continue;
        }
        // `Given the time is "<timestamp>"`: the time of the call, a UTC timestamp.
        if (timeOf(step.text) !== undefined) {
          hasTime = true;
          // In an outline, each Examples row gives the time: check each text that Cucumber runs.
          for (const time of new Set(stepTexts(scenario, step.text).map((text) => timeOf(text) ?? ''))) {
            if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$/.test(time) || Number.isNaN(Date.parse(time))) {
              report('invalid-time', step.location, `"${time}" is not a UTC timestamp; write one such as 2026-11-22T18:00:00Z`, owner?.urn ?? '');
            }
          }
          continue;
        }
        // `Given the caller is:`: who calls, in a domain whose manifest names the caller.
        if (step.text === STEP_PHRASES.caller) {
          hasCaller = true;
          if (!ir.meta.caller) report('invalid-caller', step.location, `"${step.text}" gives the caller, but the manifest names no caller`, owner?.urn ?? '');
          else if (step.table) checkHeader(step.table.header, entityOwner(ir, ir.meta.caller));
          continue;
        }
        // `Given the current <entity> is:`: the record that the operation changes or reads.
        const word = currentWord(step.text);
        if (word !== undefined) {
          hasCurrent = true;
          if (!owner || !(owner.urn in ir.operations)) continue;
          if (!record) {
            report('invalid-current', step.location, `"${step.text}" gives the record that an operation changes, but ${owner.urn} has no changes`, owner.urn);
            continue;
          }
          const identifier = record.entity.split(':').at(-1)!;
          if (word !== identifier) {
            const right = step.text.startsWith('there is no') ? `there is no current ${identifier}` : `the current ${identifier} is:`;
            report('invalid-current', step.location, `${owner.urn} ${verb} a record of ${record.entity}: write "${right}", not "${step.text}"`, owner.urn);
            continue;
          }
          if (!step.table) continue;
          checkHeader(step.table.header, entityOwner(ir, record.entity));
          if (!change) continue;
          const column = step.table.header.findIndex((cell) => cell.value === change.property);
          if (column < 0) continue;
          const blocks = scenario.examples.filter((e) => e.table);
          const rows =
            blocks.length === 0
              ? substitute(step.table)
              : blocks.flatMap((block) => block.table!.rows.flatMap((row) => substitute(step.table!, { header: block.table!.header.map((c) => c.value), row })));
          for (const row of rows) if (row[column]) states.add(row[column]!);
          continue;
        }
        if (change && stepTexts(scenario, step.text).some((text) => failsWithUrn(text) === change.otherwise)) expectsOtherwise = true;
        // An outline's step text can hold placeholders; Cucumber runs it once for each Examples
        // row, with the values of that row. Each distinct text is checked, and reported once.
        const texts = stepTexts(scenario, step.text);
        const reported = new Set<string>();
        const reportOnce = (code: DiagnosticCode, message: string, urn: string) => {
          if (reported.has(message)) return;
          reported.add(message);
          report(code, step.location, message, urn);
        };
        const headerOwners = new Map<string, Owner | undefined>();
        let kind: 'invariant' | 'error' | 'event' | 'record' | undefined;
        for (const text of texts) {
          // `the input is rejected by "<invariant URN>"`: an invariant of the operation's input.
          const invariantUrn = rejectedByUrn(text);
          if (invariantUrn !== undefined) {
            kind = 'invariant';
            if (!owner?.invariants) continue;
            if (owner.invariants.includes(invariantUrn as Urn)) brokenInvariants.add(`${owner.urn} ${invariantUrn}`);
            else
              reportOnce(
                'undeclared-invariant',
                `"${invariantUrn}" is not an invariant of the input of ${owner.urn} ` + `(invariants: ${owner.invariants.length > 0 ? owner.invariants.join(', ') : 'none'})`,
                owner.urn,
              );
            continue;
          }
          // 4. `the operation fails with "<urn>"`, with or without a table of that error's fields.
          const errorUrn = failsWithUrn(text);
          if (errorUrn !== undefined) {
            kind = 'error';
            if (owner?.errors) {
              if (owner.errors.includes(errorUrn as Urn)) expectedErrors.add(`${owner.urn} ${errorUrn}`);
              else
                reportOnce(
                  'undeclared-error',
                  `"${errorUrn}" is not a declared error of ${owner.urn} ` + `(errors: ${owner.errors.length > 0 ? owner.errors.join(', ') : 'none'})`,
                  owner.urn,
                );
            }
            headerOwners.set(errorUrn, errorOwner(ir, owner, errorUrn));
            continue;
          }
          // `the refusal is recorded as "<urn>"`: the recordAs event of a declared error of the operation.
          const recordUrn = recordedAsUrn(text);
          if (recordUrn !== undefined) {
            kind = 'record';
            if (owner?.records) {
              if (owner.records.includes(recordUrn as Urn)) expectedRecords.add(`${owner.urn} ${recordUrn}`);
              else
                reportOnce(
                  'undeclared-record',
                  `"${recordUrn}" records no declared error of ${owner.urn} (records: ${owner.records.length > 0 ? owner.records.join(', ') : 'none'})`,
                  owner.urn,
                );
            }
            headerOwners.set(recordUrn, owner?.records?.includes(recordUrn as Urn) ? eventFields(ir, recordUrn) : undefined);
            continue;
          }
          // `the operation emits "<urn>"`, with or without a table of that event's fields.
          const eventUrn = emitsUrn(text);
          if (eventUrn !== undefined) {
            kind = 'event';
            if (owner?.emits) {
              if (owner.emits.includes(eventUrn as Urn)) expectedEvents.add(`${owner.urn} ${eventUrn}`);
              else reportOnce('undeclared-event', `"${eventUrn}" is not an event of ${owner.urn} (emits: ${owner.emits.length > 0 ? owner.emits.join(', ') : 'none'})`, owner.urn);
            }
            headerOwners.set(eventUrn, eventOwner(ir, owner, eventUrn));
            continue;
          }
          // `the operation emits no "<urn>"`: a success without that event.
          const absentUrn = emitsNoneOfUrn(text);
          if (absentUrn !== undefined) {
            kind = 'event';
            if (owner?.emits) {
              if (owner.emits.includes(absentUrn as Urn)) absentEvents.add(`${owner.urn} ${absentUrn}`);
              else reportOnce('undeclared-event', `"${absentUrn}" is not an event of ${owner.urn} (emits: ${owner.emits.length > 0 ? owner.emits.join(', ') : 'none'})`, owner.urn);
            }
          }
        }
        if (kind !== undefined) {
          // The table of an error or an event: its headers are the fields of each URN that the step names.
          if (step.table && headerOwners.size > 0) {
            const owners = [...headerOwners.values()];
            checkHeader(step.table.header, owners.includes(undefined) ? undefined : owners.length === 1 ? owners[0] : mergeOwners(owners as Owner[]));
          }
          continue;
        }
        if (!step.table) continue;
        checkHeader(step.table.header, owner);
        if (step.text === STEP_PHRASES.run) checkRequired(step.table, owner);
      }
      if (operation && readsTime(operation) && owner && runs && !hasTime) {
        report('invalid-time', runs, `${owner.urn} has rules that read the time; give it with Given the time is "<timestamp>" before the operation runs`, owner.urn);
      }
      if (operation?.callers && owner && runs && !hasCaller) {
        report('invalid-caller', runs, `${owner.urn} states who may call it; give the caller with "Given the caller is:" before the operation runs`, owner.urn);
      }
      if (record && owner && runs && !hasCurrent) {
        const identifier = record.entity.split(':').at(-1)!;
        report('invalid-current', runs, `${owner.urn} ${verb} a record of ${record.entity}; give it with "Given the current ${identifier} is:" before the operation runs`, owner.urn);
      }
      if (change && owner) {
        for (const state of states) {
          if (change.from.includes(state)) coveredStates.add(`${owner.urn} ${state}`);
          else if (expectsOtherwise) coveredStates.add(`${owner.urn} *otherwise`);
        }
      }
      for (const examples of scenario.examples) {
        if (!examples.table) continue;
        const steps = scenario.steps.flatMap((step) => stepTexts(scenario, step.text).map((text) => ({ text })));
        checkHeader(examples.table.header, withCurrent(ir, withPlaceholders(withStepTables(ir, ownerOf([...scenario.tags, ...examples.tags], examples.location), steps), scenario.steps), scenario.steps));
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

  // Error coverage: a warning for each declared error that no scenario of its operation
  // expects. An untagged operation is already an error, so its errors add nothing (as with
  // boundary coverage); they still count in the summary.
  let declaredErrors = 0;
  for (const operation of Object.values(ir.operations)) {
    for (const errorUrn of operation.errors) {
      declaredErrors += 1;
      if (!covered.has(operation.urn) || expectedErrors.has(`${operation.urn} ${errorUrn}`)) continue;
      problems.push({
        code: 'uncovered-error',
        severity: coverageSeverity(operation.urn),
        file: features.directory,
        urn: errorUrn,
        message: `error ${errorUrn} of ${operation.urn} has no scenario that expects it; add one with Then the operation fails with "${errorUrn}"`,
      });
    }
  }

  // Event coverage: each event of a tagged operation needs a scenario that expects it.
  let declaredEvents = 0;
  let absentShown = 0;
  for (const operation of Object.values(ir.operations)) {
    for (const eventUrn of operation.emits) {
      declaredEvents += 1;
      if (!covered.has(operation.urn) || expectedEvents.has(`${operation.urn} ${eventUrn}`)) continue;
      problems.push({
        code: 'uncovered-event',
        severity: coverageSeverity(operation.urn),
        file: features.directory,
        urn: eventUrn,
        message: `event ${eventUrn} of ${operation.urn} has no scenario that expects it; add one with Then the operation emits "${eventUrn}"`,
      });
    }
    // An event that the operation emits only when a rule holds: a scenario must show a success without it.
    for (const item of operation.exactly ?? []) {
      if (!item.when) continue;
      declaredEvents += 1;
      if (absentEvents.has(`${operation.urn} ${item.event}`)) absentShown += 1;
      if (!covered.has(operation.urn) || absentEvents.has(`${operation.urn} ${item.event}`)) continue;
      problems.push({
        code: 'uncovered-event',
        severity: coverageSeverity(operation.urn),
        file: features.directory,
        urn: item.event,
        message: `event ${item.event} of ${operation.urn} is emitted only when ${item.when.ruleText}, and no scenario shows a success without it; add one with Then the operation emits no "${item.event}"`,
      });
    }
  }

  // Record coverage: each event that a declared error of a tagged operation records as needs a scenario that expects it.
  let declaredRecords = 0;
  for (const operation of Object.values(ir.operations)) {
    for (const recordUrn of operationOwner(ir, operation.urn).records ?? []) {
      declaredRecords += 1;
      if (!covered.has(operation.urn) || expectedRecords.has(`${operation.urn} ${recordUrn}`)) continue;
      problems.push({
        code: 'uncovered-record',
        severity: coverageSeverity(operation.urn),
        file: features.directory,
        urn: recordUrn,
        message: `the record ${recordUrn} of a refusal of ${operation.urn} has no scenario that expects it; add one with Then the refusal is recorded as "${recordUrn}"`,
      });
    }
  }

  // Invariant coverage: each invariant of a tagged operation's input needs a scenario that breaks it.
  let inputInvariants = 0;
  for (const operation of Object.values(ir.operations)) {
    for (const invariant of invariantsWithin(ir, operation.input)) {
      inputInvariants += 1;
      if (!covered.has(operation.urn) || brokenInvariants.has(`${operation.urn} ${invariant.urn}`)) continue;
      problems.push({
        code: 'uncovered-invariant',
        severity: coverageSeverity(operation.urn),
        file: features.directory,
        urn: invariant.urn,
        message: `invariant ${invariant.urn} on the input of ${operation.urn} has no scenario that breaks it; add one with Then the input is rejected by "${invariant.urn}"`,
      });
    }
  }

  // State coverage: each state that an operation starts from, and one state outside `from` that
  // expects `otherwise`, needs a scenario: the edges of the promise, as with boundary coverage.
  let declaredStates = 0;
  for (const operation of Object.values(ir.operations)) {
    const change = operation.changes;
    if (!change) continue;
    declaredStates += change.from.length + 1;
    if (!covered.has(operation.urn)) continue;
    const identifier = change.entity.split(':').at(-1)!;
    const at = { code: 'uncovered-state' as const, severity: coverageSeverity(operation.urn), file: features.directory, urn: operation.urn };
    for (const state of change.from) {
      if (coveredStates.has(`${operation.urn} ${state}`)) continue;
      problems.push({ ...at, message: `${operation.urn} starts from ${change.property} "${state}", which no scenario gives; add one with Given the current ${identifier} is: and ${change.property} ${state}` });
    }
    if (!coveredStates.has(`${operation.urn} *otherwise`)) {
      problems.push({
        ...at,
        message: `${operation.urn} has no scenario with a ${change.property} outside ${change.from.join(', ')} that expects "${change.otherwise}"; add one with Given the current ${identifier} is: and Then the operation fails with "${change.otherwise}"`,
      });
    }
  }
  // Idempotency: a scenario must repeat the call, to show that the repeat returns the first answer.
  for (const operation of Object.values(ir.operations)) {
    if (!operation.idempotency || !covered.has(operation.urn) || repeated.has(operation.urn)) continue;
    problems.push({
      code: 'uncovered-idempotency',
      severity: coverageSeverity(operation.urn),
      file: features.directory,
      urn: operation.urn,
      message: `${operation.urn} returns the first answer to a repeat with the same ${operation.idempotency.key}, and no scenario repeats a call; add one with When I run the operation again with:`,
    });
  }
  // A timed change: a scenario must call it for a record that is not due, the other side of its due rule.
  for (const operation of Object.values(ir.operations)) {
    if (!operation.due || !covered.has(operation.urn) || notDue.has(operation.urn)) continue;
    problems.push({
      code: 'uncovered-due',
      severity: coverageSeverity(operation.urn),
      file: features.directory,
      urn: operation.urn,
      message: `${operation.urn} runs when ${operation.due.ruleText}, and no scenario calls it for a record that is not due; add one with Then the operation is not due`,
    });
  }
  const coveredStateCount = [...coveredStates].filter((key) => {
    const [urn, state] = key.split(' ');
    const change = ir.operations[urn as Urn]?.changes;
    return change !== undefined && (state === '*otherwise' || change.from.includes(state!));
  }).length;

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
  const waiverFor = (operation: Urn, urn: string) => waivers.find((w) => w.field === urn && w.operations.includes(operation));
  /** `<operation URN> <field or entity URN>` for each property, at any depth, that has boundary cases. */
  const constrained = new Set<string>();
  const constrains = (operation: Urn, urn: string) => constrained.has(`${operation} ${urn}`);

  // Boundary coverage, for the operations that have scenarios (an untagged one is already an error).
  // A malformed list or object cell is an error where it is written.
  const values = inputValues(ir, features, (problem) =>
    problems.push({ code: 'invalid-cell', severity: 'error', file: problem.file, location: problem.location, message: problem.message }),
  );
  const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
  for (const operation of Object.values(ir.operations)) {
    if (!covered.has(operation.urn)) continue;
    const gap = (urn: string, at: string, missing: readonly { readonly label: string }[]) => {
      if (missing.length === 0) return;
      const waiver = waiverFor(operation.urn, urn);
      if (waiver) {
        waiver.used = true;
        return;
      }
      problems.push({
        code: 'uncovered-boundary',
        severity: coverageSeverity(operation.urn),
        file: features.directory,
        urn,
        message: `${urn}${at ? ` at ${at}` : ''} in the input of ${operation.urn} has no ${missing.map((c) => c.label).join(', no ')}`,
      });
    };
    /** The cases of each property, at any depth: an embedded entity's values are the objects that the scenarios send. */
    const cover = (entityUrn: Urn, valuesOf: (name: string) => readonly unknown[], via: string) => {
      for (const ref of ir.entities[entityUrn]?.fields ?? []) {
        const sent = valuesOf(ref.name);
        // A list's items are the property's values; the lists themselves have the count cases.
        const items = ref.many ? sent.flatMap((value) => (Array.isArray(value) ? value : [])) : sent;
        const at = via ? `${via}${ref.name}` : '';
        if ('entity' in ref) {
          const listCases = ref.many ? listBoundaries(ref.many, keyName(ir.entities[ref.entity])) : [];
          if (listCases.length > 0) constrained.add(`${operation.urn} ${ref.entity}`);
          gap(ref.entity, `${via}${ref.name}`, listCases.filter((c) => !sent.some((value) => c.covers(value))));
          const objects = items.filter(isObject);
          cover(ref.entity, (name) => objects.flatMap((o) => (o[name] === undefined ? [] : [o[name]])), `${via}${ref.name}.`);
          continue;
        }
        const fieldUrn = valueField(ir, ref);
        const field = fieldUrn && ir.fields[fieldUrn];
        if (!field) continue;
        const cases = [...boundaryCases(field.primitive, field.constraints).map((c) => ({ c, list: false })), ...(ref.many ? listBoundaries(ref.many).map((c) => ({ c, list: true })) : [])];
        if (cases.length > 0) constrained.add(`${operation.urn} ${field.urn}`);
        // A link or an `as` names the column apart from the field: say which column.
        const column = at || (ref.name === field.urn.split(':').at(-1) ? '' : ref.name);
        gap(field.urn, column, cases.filter(({ c, list }) => !(list ? sent : items).some((value) => c.covers(value))).map(({ c }) => c));
      }
    };
    const sent = values.get(operation.urn);
    cover(operation.input, (name) => sent?.get(name) ?? [], '');
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
  const errorSummary =
    (declaredErrors > 0 ? `, ${expectedErrors.size}/${declaredErrors} errors expected` : '') +
    (declaredEvents > 0 ? `, ${expectedEvents.size + absentShown}/${declaredEvents} events expected` : '') +
    (declaredRecords > 0 ? `, ${expectedRecords.size}/${declaredRecords} records expected` : '') +
    (inputInvariants > 0 ? `, ${brokenInvariants.size}/${inputInvariants} invariants broken` : '') +
    (declaredStates > 0 ? `, ${coveredStateCount}/${declaredStates} states covered` : '');
  const featureCount = features.features.length;

  // The ratchet trigger: once every feature is strict and the gate passes, the
  // config can say so. While the gate fails, the errors come first.
  const passes = !problems.some((p) => p.severity === 'error');
  if (passes && boundaryCoverage === 'warn' && featureCount > 0 && strictFeatures.length === featureCount) {
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
    emits: op.emits,
    records: [...new Set(op.errors.flatMap((e) => (ir.errors[e]?.recordAs ? [ir.errors[e]!.recordAs!] : [])))],
    invariants: invariantsWithin(ir, op.input).map((i) => i.urn),
  };
}

/** The fields an error table may name: those of `errorUrn`, when the scenario's operation declares it. */
function errorOwner(ir: UniversalIR, owner: Owner | undefined, errorUrn: string): Owner | undefined {
  // An error the operation does not declare is reported on its own (gate 3, undeclared-error).
  if (!owner?.errors?.includes(errorUrn as Urn)) return undefined;
  const error = ir.errors[errorUrn as Urn]!;
  return { urn: errorUrn, description: `the error ${errorUrn}`, keys: new Set(error.fields.map((f) => f.name)) };
}

/** The fields an event table may name: those of `eventUrn`, when the scenario's operation emits it. */
function eventOwner(ir: UniversalIR, owner: Owner | undefined, eventUrn: string): Owner | undefined {
  // An event the operation does not emit is reported on its own (gate 3, undeclared-event).
  if (!owner?.emits?.includes(eventUrn as Urn)) return undefined;
  const event = ir.events[eventUrn as Urn]!;
  return { urn: eventUrn, description: `the event ${eventUrn}`, keys: new Set(event.fields.map((f) => f.name)) };
}

/** `<name>`: a placeholder of a Scenario Outline. */
const PLACEHOLDER = /<([^<>]+)>/gu;

/** The texts that Cucumber runs for a step: one for each Examples row of an outline, or the text itself. */
function stepTexts(scenario: { readonly examples: readonly { readonly table?: IndexedTable }[] }, text: string): string[] {
  if (!PLACEHOLDER.test(text)) return [text];
  PLACEHOLDER.lastIndex = 0;
  const texts = new Set<string>();
  for (const examples of scenario.examples) {
    if (!examples.table) continue;
    const names = examples.table.header.map((cell) => cell.value);
    for (const row of examples.table.rows) {
      texts.add(text.replace(PLACEHOLDER, (whole, name: string) => (names.includes(name) ? row[names.indexOf(name)]! : whole)));
    }
  }
  return texts.size > 0 ? [...texts] : [text];
}

/** An Examples column may also be a placeholder in the text of a step: Cucumber fills it, and it is no field. */
function withPlaceholders(owner: Owner | undefined, steps: readonly { readonly text: string }[]): Owner | undefined {
  if (!owner) return undefined;
  const names = steps.flatMap((step) => [...step.text.matchAll(PLACEHOLDER)].map((m) => m[1]!));
  if (names.length === 0) return owner;
  return { ...owner, description: `${owner.description}, or a placeholder in a step text`, keys: new Set([...owner.keys, ...names]) };
}

/** The fields of several errors or events, for a table whose step names a different one in each Examples row. */
function mergeOwners(owners: readonly Owner[]): Owner {
  return { urn: owners[0]!.urn, description: owners.map((o) => o.description).join(' or '), keys: new Set(owners.flatMap((o) => [...o.keys])) };
}

/**
 * An Examples column fills a placeholder in any step of its outline, so it may name a field of
 * the owner, or of an error or event that a step of the outline expects.
 */
/** With a current-record table in the scenario, the fields of the changed entity may be Examples columns too. */
function withCurrent(ir: UniversalIR, owner: Owner | undefined, steps: readonly { readonly text: string; readonly table?: IndexedTable }[]): Owner | undefined {
  const operation = owner && owner.urn in ir.operations ? ir.operations[owner.urn as Urn]! : undefined;
  const change = operation?.changes ?? operation?.reads;
  let widened = owner;
  if (owner && change && steps.some((step) => step.table && currentWord(step.text) !== undefined)) {
    widened = { ...owner, description: `${owner.description}, or of the current ${change.entity}`, keys: new Set([...owner.keys, ...propertyNames(ir, change.entity)]) };
  }
  // With a caller table, the fields of the caller may be Examples columns too.
  const caller = ir.meta.caller;
  if (widened && caller && steps.some((step) => step.table && step.text === STEP_PHRASES.caller)) {
    widened = { ...widened, description: `${widened.description}, or of the caller ${caller}`, keys: new Set([...widened.keys, ...propertyNames(ir, caller)]) };
  }
  return widened;
}

function withStepTables(ir: UniversalIR, owner: Owner | undefined, steps: readonly { readonly text: string }[]): Owner | undefined {
  if (!owner) return undefined;
  const extra = steps.flatMap((step) => {
    const errorUrn = failsWithUrn(step.text);
    if (errorUrn !== undefined && owner.errors?.includes(errorUrn as Urn)) return [{ kind: 'error', urn: errorUrn }];
    const eventUrn = emitsUrn(step.text);
    if (eventUrn !== undefined && owner.emits?.includes(eventUrn as Urn)) return [{ kind: 'event', urn: eventUrn }];
    return [];
  });
  if (extra.length === 0) return owner;
  return {
    ...owner,
    description: `${owner.description}, or of ${extra.map((e) => `the ${e.kind} ${e.urn}`).join(', ')}`,
    keys: new Set([...owner.keys, ...extra.flatMap((e) => (e.kind === 'error' ? ir.errors[e.urn as Urn]! : ir.events[e.urn as Urn]!).fields.map((f) => f.name))]),
  };
}

/** The fields of an event, for the table of a step that names it. */
function eventFields(ir: UniversalIR, eventUrn: string): Owner {
  return { urn: eventUrn, description: `the event ${eventUrn}`, keys: new Set(ir.events[eventUrn as Urn]!.fields.map((f) => f.name)) };
}

function entityOwner(ir: UniversalIR, urn: Urn): Owner {
  return { urn, description: urn, keys: new Set(propertyNames(ir, urn)) };
}

export const gherkinGate: Gate = { number: 3, name: 'gherkin', run: checkGherkin };
