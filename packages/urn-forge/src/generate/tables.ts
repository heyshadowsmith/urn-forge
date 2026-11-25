/**
 * The tables of a value in Postgres, which the schema and the store file share. An object that the
 * config names is a table, keyed by its identifier. Its parts go into it:
 *
 * - a value: a column, named by its path, `contact_email` for the email of the contact;
 * - an embedded object: the columns of its parts, at any depth;
 * - a list: a child table, `<table>__<path>`, keyed by the parent's key and `position`. A list of
 *   values has one column, `value`; a list of objects has the columns of the item. A list inside an
 *   item is a table of the child, at any depth. An optional list adds a column `has_<path>` to its
 *   parent, so that an absent list and an empty list stay apart.
 */
import type { Model } from '../model.js';
import { requiredOf } from '../model.js';

export interface Column {
  readonly name: string;
  /** The definition of the value, or undefined for a key column of the parent, a position, or a flag. */
  readonly definition?: string;
  readonly base: string;
  readonly notNull: boolean;
  /** The path of the value in the row's value: `['contact', 'email']`. */
  readonly path: readonly string[];
}

/** An object whose parts are columns of a table: the table's own value, or an embedded object. */
export interface ObjectPart {
  readonly definition: string;
  readonly path: readonly string[];
  readonly optional: boolean;
  /** The columns of its parts, by the path of each part below the object, joined with dots. */
  readonly columns: Readonly<Record<string, string>>;
}

export interface Table {
  readonly name: string;
  readonly kind: 'root' | 'objects' | 'values';
  /** The definition of a row: the object of a table, the item of a list. */
  readonly definition: string;
  /** For a child table: the list's definition, its parent and its path in the parent's row. */
  readonly list?: { readonly definition: string; readonly parent: Table; readonly path: readonly string[]; readonly flag?: string };
  /** The columns that refer to the parent's key, in the order of the parent's key. */
  readonly parentKey: readonly Column[];
  /** The primary key. */
  readonly key: readonly Column[];
  /** The columns of the row's value, and the flags of its optional lists. */
  readonly columns: readonly Column[];
  readonly objects: readonly ObjectPart[];
  readonly children: Table[];
}

/** A problem of the tables, such as two parts that give one column name. */
export interface TableProblem {
  readonly table: string;
  readonly message: string;
}

const SCALARS = new Set(['string', 'integer', 'number', 'boolean']);

export function buildTables(model: Model, roots: readonly string[], problems: TableProblem[] = []): Table[] {
  const root = (name: string) => model.definitions[model.definitions[name]!.root]!;

  /** The columns of an object's parts, into `table`, with the given prefix and path. */
  const flatten = (
    table: { columns: Column[]; objects: ObjectPart[]; children: Table[] },
    tableName: string,
    definition: string,
    prefix: string,
    path: readonly string[],
    optional: boolean,
    allRequired: boolean,
    self: () => Table,
  ): Record<string, string> => {
    const object = root(definition);
    const required = requiredOf(object);
    const columns: Record<string, string> = {};
    for (const property of object.properties ?? []) {
      const part = model.definitions[property]!;
      const name = `${prefix}${property}`;
      const isRequired = required.has(property);
      const partPath = [...path, property];
      if (SCALARS.has(part.base)) {
        table.columns.push({ name, definition: property, base: part.base, notNull: allRequired && isRequired, path: partPath });
        columns[property] = name;
      } else if (part.base === 'object') {
        const inner = flatten(table, tableName, property, `${name}_`, partPath, optional || !isRequired, allRequired && isRequired, self);
        for (const [sub, column] of Object.entries(inner)) columns[`${property}.${sub}`] = column;
        table.objects.push({ definition: property, path: partPath, optional: optional || !isRequired, columns: inner });
      } else {
        const flag = isRequired && allRequired ? undefined : `has_${name}`;
        if (flag) {
          table.columns.push({ name: flag, base: 'boolean', notNull: true, path: partPath });
          columns[property] = flag;
        }
        table.children.push(listTable(`${tableName}__${name}`, property, self, partPath, flag));
      }
    }
    return columns;
  };

  /** The child table of a list. */
  const listTable = (name: string, listDefinition: string, parent: () => Table, path: readonly string[], flag: string | undefined): Table => {
    const items = root(listDefinition).items!;
    const itemDefinition = model.definitions[items]!;
    const parentTable = parent();
    // The parent's key, with its position renamed by the parent's path: a grandchild has two positions.
    const parentKey = parentTable.key.map((c) => ({
      ...c,
      name: c.name === 'position' ? `${parentTable.list!.path.join('_')}_position` : c.name,
      notNull: true,
    }));
    const position: Column = { name: 'position', base: 'integer', notNull: true, path: [] };
    const table: { -readonly [K in keyof Table]: Table[K] } = {
      name,
      kind: SCALARS.has(itemDefinition.base) ? 'values' : 'objects',
      definition: items,
      list: { definition: listDefinition, parent: parentTable, path, ...(flag ? { flag } : {}) },
      parentKey,
      key: [...parentKey, position],
      columns: [],
      objects: [],
      children: [],
    };
    if (SCALARS.has(itemDefinition.base)) {
      table.columns = [{ name: 'value', definition: items, base: itemDefinition.base, notNull: true, path: [] }];
    } else if (itemDefinition.base === 'object') {
      const columns: Column[] = [];
      const objects: ObjectPart[] = [];
      const children: Table[] = [];
      const holder = { columns, objects, children };
      const own = flatten(holder, name, items, '', [], false, true, () => table as Table);
      table.columns = columns;
      table.objects = [{ definition: items, path: [], optional: false, columns: own }, ...objects];
      table.children = children;
    } else {
      problems.push({ table: name, message: `${listDefinition} is a list of lists, which is not a table of Postgres` });
    }
    checkNames(table as Table);
    return table as Table;
  };

  const checkNames = (table: Table): void => {
    const seen = new Set<string>();
    for (const column of [...table.key.filter((k) => !table.columns.some((c) => c.name === k.name)), ...table.columns]) {
      if (seen.has(column.name)) problems.push({ table: table.name, message: `two parts give the column ${column.name}` });
      seen.add(column.name);
    }
    for (const name of [table.name, ...table.columns.map((c) => c.name)]) {
      if (Buffer.byteLength(name) > 63) problems.push({ table: table.name, message: `${name} is longer than 63 bytes, the most that Postgres takes for a name` });
    }
  };

  return roots.map((name) => {
    const definition = root(name);
    // The key first: the child tables of the flatten below refer to it.
    const identifier = model.definitions[definition.identifier!]!;
    const table: { -readonly [K in keyof Table]: Table[K] } = {
      name,
      kind: 'root',
      definition: name,
      parentKey: [],
      key: [{ name: identifier.name, definition: identifier.name, base: identifier.base, notNull: true, path: [identifier.name] }],
      columns: [],
      objects: [],
      children: [],
    };
    const columns: Column[] = [];
    const objects: ObjectPart[] = [];
    const children: Table[] = [];
    const own = flatten({ columns, objects, children }, name, name, '', [], false, true, () => table as Table);
    table.columns = columns;
    table.objects = [{ definition: name, path: [], optional: false, columns: own }, ...objects];
    table.children = children;
    checkNames(table as Table);
    return table as Table;
  });
}

/** Each table of a tree of tables: the table, then its children, depth first. */
export function allTables(tables: readonly Table[]): Table[] {
  return tables.flatMap((t) => [t, ...allTables(t.children)]);
}
