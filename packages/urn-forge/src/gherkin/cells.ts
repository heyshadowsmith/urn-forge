/**
 * The cells of a Gherkin table as a value of a definition. The header names the properties, with a
 * dot for a property of an embedded object: `stored_booking.state`. Each cell is read by the type of
 * its definition:
 *
 * - an empty cell: the property is absent;
 * - a string: the text of the cell; `""` is the empty string, and a cell in double quotes is JSON;
 * - an integer or a number: the number, when the cell is one;
 * - true or false: the boolean, when the cell is one;
 * - a list: JSON (`[1, 2]`, `[{"course": "main"}]`), or items between commas: `[confirmed, seated]`;
 * - an object: JSON.
 *
 * A cell that is not a value of its type is given as text, so that the check reports it.
 */

/** What the steps know of each definition: the generated `Definitions`. */
export type DefinitionsTable = Readonly<Record<string, { readonly base: string; readonly items?: string; readonly properties?: readonly string[] }>>;

function json(text: string): { value: unknown } | undefined {
  try {
    return { value: JSON.parse(text) };
  } catch {
    return undefined;
  }
}

/** A cell as a value of a definition. */
export function cellValue(text: string, definition: string, definitions: DefinitionsTable): unknown {
  const meta = definitions[definition];
  const cell = text.trim();
  if (!meta) return cell;
  switch (meta.base) {
    case 'string':
      if (cell.startsWith('"') && cell.endsWith('"')) return json(cell)?.value ?? cell;
      return cell;
    case 'integer':
    case 'number':
      return cell !== '' && /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(cell) ? Number(cell) : cell;
    case 'boolean':
      return cell === 'true' ? true : cell === 'false' ? false : cell;
    case 'map':
    case 'union':
      return json(cell)?.value ?? cell;
    case 'array': {
      const parsed = json(cell);
      if (parsed) return parsed.value;
      if (cell.startsWith('[') && cell.endsWith(']')) {
        const inner = cell.slice(1, -1).trim();
        if (inner === '') return [];
        return inner.split(',').map((item) => cellValue(item, meta.items!, definitions));
      }
      return cell;
    }
    default:
      return json(cell)?.value ?? cell;
  }
}

/** The value of a table with a header row and one row: an object of the definition. */
export function tableValue(rows: readonly (readonly string[])[], definition: string, definitions: DefinitionsTable): Record<string, unknown> {
  if (rows.length !== 2) throw new Error(`the table must have a header row and one row of values; it has ${rows.length} rows`);
  const [header, values] = rows as [readonly string[], readonly string[]];
  const value: Record<string, unknown> = {};
  header.forEach((column, index) => {
    const cell = values[index] ?? '';
    if (cell.trim() === '') return;
    // Walk the path of the column: each step but the last is an embedded object.
    const steps = column.trim().split('.');
    let target = value;
    let owner = definition;
    steps.forEach((step, i) => {
      const meta = definitions[owner];
      if (!meta?.properties?.includes(step)) throw new Error(`${steps.slice(0, i + 1).join('.')} is not a property of ${owner}`);
      if (i === steps.length - 1) {
        target[step] = cellValue(cell, step, definitions);
        return;
      }
      const next = (target[step] ??= {}) as Record<string, unknown>;
      target = next;
      // The generated table gives a definition named as a type the properties of its root.
      owner = step;
    });
  });
  return value;
}
