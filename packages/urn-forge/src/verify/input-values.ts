/**
 * The input values each operation's scenarios send (boundary coverage plan, step 2).
 *
 * For every scenario tagged with one operation, the tables of `When I run the operation
 * with:` give the values of the operation's input fields. A `<placeholder>` takes each value
 * of its `Examples` column, as Cucumber substitutes it (anywhere in a cell), and each
 * `Examples` block may add its own tags. A cell becomes a value with the field's primitive,
 * as the steps convert it; an empty cell sends no key, so it is no value.
 *
 * Reads the feature index only; problems such as unknown headers are gate 3's to report.
 */
import { STEP_PHRASES } from '../gherkin/phrases.js';
import type { UniversalIR, Urn } from '../ir/types.js';
import { parseCell } from '../primitives/index.js';
import type { FeatureIndex, IndexedScenario, IndexedTable, IndexedTag } from './feature-index.js';

/** Operation URN → input property name → the values sent, in order of appearance. */
export type InputValues = Map<Urn, Map<string, unknown[]>>;

const PLACEHOLDER = /<([^<>]+)>/g;

/** The one operation a set of tags names, or undefined when there is none or more than one. */
function operationOf(ir: UniversalIR, tags: readonly IndexedTag[]): Urn | undefined {
  const urns = [...new Set(tags.map((t) => t.name.slice(1)))].filter((u) => u in ir.operations) as Urn[];
  return urns.length === 1 ? urns[0] : undefined;
}

/** Each data row of `table` as cells; with an `Examples` row, its placeholders substituted. */
function substitute(table: IndexedTable, example?: { header: readonly string[]; row: readonly string[] }): string[][] {
  if (!example) return table.rows.map((row) => [...row]);
  return table.rows.map((row) =>
    row.map((cell) =>
      cell.replace(PLACEHOLDER, (whole, name: string) => {
        const column = example.header.indexOf(name);
        return column >= 0 ? (example.row[column] ?? '') : whole;
      }),
    ),
  );
}

export function inputValues(ir: UniversalIR, features: FeatureIndex): InputValues {
  const values: InputValues = new Map(Object.keys(ir.operations).map((urn) => [urn as Urn, new Map()]));

  const record = (operation: Urn | undefined, table: IndexedTable, rows: readonly (readonly string[])[]) => {
    if (!operation) return;
    const op = ir.operations[operation]!;
    const fields = ir.entities[op.input]?.fields ?? [];
    table.header.forEach((cell, column) => {
      const ref = fields.find((f) => f.name === cell.value);
      const field = ref && ir.fields[ref.field];
      if (!ref || !field) return;
      for (const row of rows) {
        const text = row[column] ?? '';
        if (text === '') continue;
        const list = values.get(operation)!.get(ref.name) ?? [];
        list.push(parseCell(field.primitive, text));
        values.get(operation)!.set(ref.name, list);
      }
    });
  };

  const scan = (scenario: IndexedScenario) => {
    for (const step of scenario.steps) {
      if (step.text !== STEP_PHRASES.run || !step.table) continue;
      const table = step.table;
      const examples = scenario.examples.filter((e) => e.table);
      if (examples.length === 0) {
        record(operationOf(ir, scenario.tags), table, substitute(table));
        continue;
      }
      for (const block of examples) {
        const header = block.table!.header.map((c) => c.value);
        const operation = operationOf(ir, [...scenario.tags, ...block.tags]);
        for (const row of block.table!.rows) record(operation, table, substitute(table, { header, row }));
      }
    }
  };

  for (const feature of features.features) for (const scenario of feature.scenarios) scan(scenario);
  return values;
}
