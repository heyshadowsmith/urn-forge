/**
 * Gherkin table cells for lists and embedded entities (structure plan, decisions 7 and 7a).
 *
 *   value  := list | object | quoted | bare
 *   list   := '[' (value (',' value)*)? ']'
 *   object := '{' (name ':' value (',' name ':' value)*)? '}'
 *   quoted := a JSON string literal: "Smith, Ada", "x{y}", "a \"quoted\" word"
 *   bare   := text up to the next ',', ']' or '}', with the spaces at its ends removed
 *
 * A bare value cannot hold a comma, a bracket, a brace or a double quote; quote it to hold
 * one. Each value is then read by the primitive of its field, as a plain cell is. A plain cell
 * of a single-valued field is not read here: it means what it meant before.
 *
 * A formula (formula cells plan) makes a long value: a cell, or a value in a list or an object,
 * that starts with `=`.
 *
 *   formula := '=' term ('+' term)*
 *   term    := 'repeat' '(' count ',' value ')' | quoted | list | object
 *
 * `repeat` makes text from text, or a list from an item of a list property; `+` joins text to
 * text or a list to a list. A term is not bare, so an old literal such as `=x` is refused, not
 * read in silence as `x`.
 */
import { parseCell, type Primitive } from '../primitives/index.js';

/** What a cell reader needs to know about a property: the shape the runtime's PropertyInfo has. */
export type PropertyShape =
  | { readonly primitive: Primitive; readonly many?: boolean }
  | { readonly entity: string; readonly many?: boolean; readonly fields: Readonly<Record<string, PropertyShape>> };

/** The largest count of `repeat`, and the largest text or list that a formula makes (decision 7). */
export const MAX_REPEAT = 10_000;
export const MAX_FORMULA_SIZE = 1_000_000;

type Term = { readonly kind: 'repeat'; readonly count: number; readonly value: Node; readonly at: number } | Node;

type Node =
  | { readonly kind: 'formula'; readonly terms: readonly Term[]; readonly at: number }
  | { readonly kind: 'list'; readonly items: readonly Node[]; readonly at: number }
  | { readonly kind: 'object'; readonly entries: readonly (readonly [string, Node, number])[]; readonly at: number }
  | { readonly kind: 'quoted' | 'bare'; readonly text: string; readonly at: number };

export class CellSyntaxError extends Error {
  constructor(
    message: string,
    /** 1-based column in the cell. */
    readonly column: number,
  ) {
    super(`${message} (at column ${column} of the cell)`);
  }
}

/** Parses the structure of a list or object cell. */
export function parseStructure(cell: string): Node {
  let i = 0;
  const space = () => {
    while (i < cell.length && /\s/u.test(cell[i]!)) i += 1;
  };
  /** Inside a formula, a bare value also ends at "(", ")" and "+". */
  let inFormula = false;
  const formula = (at: number): Node => {
    if (inFormula) throw new CellSyntaxError('a formula cannot hold another formula', at);
    inFormula = true;
    const terms: Term[] = [];
    for (;;) {
      space();
      const termAt = i + 1;
      if (/^repeat\s*\(/u.test(cell.slice(i))) {
        i = cell.indexOf('(', i) + 1;
        space();
        const count = /^[0-9]+/u.exec(cell.slice(i));
        if (!count || Number(count[0]) > MAX_REPEAT) throw new CellSyntaxError(`repeat needs a count from 0 to ${MAX_REPEAT}`, i + 1);
        i += count[0].length;
        space();
        if (cell[i] !== ',') throw new CellSyntaxError('expected "," after the count of repeat', i + 1);
        i += 1;
        const item = value();
        space();
        if (cell[i] !== ')') throw new CellSyntaxError('expected ")" at the end of repeat', i + 1);
        i += 1;
        terms.push({ kind: 'repeat', count: Number(count[0]), value: item, at: termAt });
      } else {
        const c = cell[i];
        if (c !== '"' && c !== '[' && c !== '{') {
          throw new CellSyntaxError('a formula is repeat(n, value), a quoted text, a list or an object, joined with "+"; to write a text that starts with "=", write ="=…"', termAt);
        }
        terms.push(value());
      }
      space();
      if (cell[i] !== '+') break;
      i += 1;
    }
    inFormula = false;
    return { kind: 'formula', terms, at };
  };
  const value = (): Node => {
    space();
    const at = i + 1;
    const c = cell[i];
    if (c === '=') {
      i += 1;
      return formula(at);
    }
    if (c === '[') {
      i += 1;
      const items: Node[] = [];
      space();
      if (cell[i] === ']') {
        i += 1;
        return { kind: 'list', items, at };
      }
      for (;;) {
        items.push(value());
        space();
        if (cell[i] === ',') {
          i += 1;
          continue;
        }
        if (cell[i] === ']') {
          i += 1;
          return { kind: 'list', items, at };
        }
        throw new CellSyntaxError(`expected "," or "]"`, i + 1);
      }
    }
    if (c === '{') {
      i += 1;
      const entries: [string, Node, number][] = [];
      space();
      if (cell[i] === '}') {
        i += 1;
        return { kind: 'object', entries, at };
      }
      for (;;) {
        space();
        const nameAt = i + 1;
        const name = /^[a-z][a-z0-9_]*/u.exec(cell.slice(i));
        if (!name) throw new CellSyntaxError('expected a property name', i + 1);
        i += name[0].length;
        space();
        if (cell[i] !== ':') throw new CellSyntaxError(`expected ":" after "${name[0]}"`, i + 1);
        i += 1;
        if (entries.some(([n]) => n === name[0])) throw new CellSyntaxError(`property "${name[0]}" occurs more than once`, at);
        entries.push([name[0], value(), nameAt]);
        space();
        if (cell[i] === ',') {
          i += 1;
          continue;
        }
        if (cell[i] === '}') {
          i += 1;
          return { kind: 'object', entries, at };
        }
        throw new CellSyntaxError(`expected "," or "}"`, i + 1);
      }
    }
    if (c === '"') {
      // The longest JSON string literal from here: a backslash escapes the next character.
      let end = i + 1;
      while (end < cell.length && cell[end] !== '"') end += cell[end] === '\\' ? 2 : 1;
      if (end >= cell.length) throw new CellSyntaxError('a quoted value has no closing quote', at);
      let text: string;
      try {
        text = JSON.parse(cell.slice(i, end + 1)) as string;
      } catch {
        throw new CellSyntaxError('a quoted value is not a valid JSON string', at);
      }
      i = end + 1;
      return { kind: 'quoted', text, at };
    }
    const bare = (inFormula ? /^[^,[\]{}"()+]*/u : /^[^,[\]{}"]*/u).exec(cell.slice(i))![0];
    i += bare.length;
    return { kind: 'bare', text: bare.trim(), at };
  };
  const node = value();
  space();
  if (i < cell.length) throw new CellSyntaxError(`unexpected "${cell[i]}"`, i + 1);
  return node;
}

/** The text of a formula for a single value: each term is text, or `repeat` of text. */
function formulaText(node: Extract<Node, { kind: 'formula' }>): string {
  let text = '';
  for (const term of node.terms) {
    const value = term.kind === 'repeat' ? term.value : term;
    if (value.kind !== 'quoted' && value.kind !== 'bare') throw new CellSyntaxError('a formula for a single value joins texts; a list or an object is not text', term.at);
    const part = term.kind === 'repeat' ? value.text.repeat(term.count) : value.text;
    if ([...text].length + [...part].length > MAX_FORMULA_SIZE) throw new CellSyntaxError(`a formula makes at most ${MAX_FORMULA_SIZE} characters`, term.at);
    text += part;
  }
  return text;
}

/** A parsed node as the value of a property; a node of the wrong shape stays text, for the schema to refuse. */
function toValue(node: Node, shape: PropertyShape, cell: string, single = false): unknown {
  if (node.kind === 'formula') {
    if (shape.many && !single) {
      const list: unknown[] = [];
      for (const term of node.terms) {
        if (term.kind === 'repeat') {
          if (list.length + term.count > MAX_FORMULA_SIZE) throw new CellSyntaxError(`a formula makes at most ${MAX_FORMULA_SIZE} items`, term.at);
          const item = toValue(term.value, shape, cell, true);
          for (let n = 0; n < term.count; n += 1) list.push(item);
        } else if (term.kind === 'list') {
          list.push(...(toValue(term, shape, cell) as unknown[]));
        } else {
          throw new CellSyntaxError('a formula for a list joins lists and repeat(n, item)', term.at);
        }
      }
      return list;
    }
    if ('entity' in shape) {
      const [only] = node.terms;
      if (node.terms.length !== 1 || only!.kind !== 'object') throw new CellSyntaxError('a formula for an embedded entity is one object', node.at);
      return toValue(only!, shape, cell);
    }
    const text = formulaText(node);
    return shape.primitive === 'string' || shape.primitive === 'enum' || text === '' ? text : parseCell(shape.primitive, text);
  }
  if (shape.many && !single) {
    if (node.kind !== 'list') return cell;
    return node.items.map((item) => toValue(item, shape, cell, true));
  }
  if ('entity' in shape) {
    if (node.kind !== 'object') return cell;
    const object: Record<string, unknown> = {};
    for (const [name, child, nameAt] of node.entries) {
      const property = Object.hasOwn(shape.fields, name) ? shape.fields[name] : undefined;
      if (!property) throw new CellSyntaxError(`"${name}" is not a property of ${shape.entity} (properties: ${Object.keys(shape.fields).join(', ')})`, nameAt);
      object[name] = toValue(child, property, cell);
    }
    return object;
  }
  if (node.kind === 'bare') return node.text === '' ? '' : parseCell(shape.primitive, node.text);
  if (node.kind === 'quoted') {
    // A quoted value protects its characters; the primitive still reads it (a quoted "10" is a number for an integer).
    return shape.primitive === 'string' || shape.primitive === 'enum' || node.text === '' ? node.text : parseCell(shape.primitive, node.text);
  }
  return cell;
}

/**
 * The value of a non-empty cell for a property. A list or an embedded entity is read with the
 * syntax above; a single value is read by its primitive, as before.
 */
export function readCell(cell: string, shape: PropertyShape): unknown {
  // A formula: a cell that starts with "=", for any property.
  if (cell.trimStart().startsWith('=')) return toValue(parseStructure(cell), shape, cell);
  if (!shape.many && !('entity' in shape)) return parseCell(shape.primitive, cell);
  // A cell that does not open a list or an object stays text, so the schema refuses it.
  const opens = shape.many ? '[' : '{';
  if (!cell.trimStart().startsWith(opens)) return cell;
  return toValue(parseStructure(cell), shape, cell);
}
