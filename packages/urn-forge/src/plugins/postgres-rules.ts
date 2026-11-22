/**
 * An invariant rule as a SQL condition. The rule has passed
 * pass 6, so every field exists, both sides of each operator agree, and every optional field
 * is guarded. A guard (`x is absent or …`) makes SQL's three-valued logic give the answer of
 * the rule: `NULL` can only meet `TRUE OR …` or `FALSE AND …`.
 *
 * Each comparison follows its primitive, as in the Valibot schema: `decimal` as NUMERIC
 * (exact), `date` as DATE, `timestamp` as TIMESTAMPTZ (instants), the rest as their types.
 * Days use the date operators of Postgres: `date ± integer` and `date - date`.
 * Integer arithmetic is in BIGINT, so a sum of two INTEGER columns cannot overflow.
 */
import type { IRPropertyRef, UniversalIR } from '../ir/types.js';
import type { Primitive } from '../primitives/index.js';
import { valueType, type RuleExpr } from '../rules/index.js';
import { ident, literal } from './postgres.plugin.js';

export type RuleSql = { readonly ok: true; readonly sql: string } | { readonly ok: false; readonly reason: string };

const SQL_OPERATOR: Readonly<Record<string, string>> = { '=': '=', '!=': '<>', '<': '<', '<=': '<=', '>': '>', '>=': '>=' };

class Untranslatable extends Error {}

/** A literal of a primitive in SQL. */
function literalOf(primitive: Primitive, e: RuleExpr): string {
  if (e.op === 'boolean') return e.value ? 'TRUE' : 'FALSE';
  if (e.op === 'number') return e.value;
  if (e.op !== 'text') throw new Error(`internal error: ${e.op} is not a literal`);
  switch (primitive) {
    case 'date':
      return `DATE ${literal(e.value)}`;
    case 'timestamp':
      return `TIMESTAMPTZ ${literal(e.value)}`;
    case 'decimal':
      return `${literal(e.value)}::NUMERIC`;
    default:
      return literal(e.value);
  }
}

/** The rule over the properties of an entity, as a condition on the columns of its table. */
export function ruleSql(ir: UniversalIR, rule: RuleExpr, properties: readonly IRPropertyRef[]): RuleSql {
  const byName = new Map(properties.map((p) => [p.name, p]));

  const primitiveOf = (name: string): Primitive => {
    const ref = byName.get(name)!;
    const field = 'field' in ref ? ref.field : 'link' in ref ? ir.entities[ref.link]!.key! : undefined;
    return ir.fields[field!]!.primitive;
  };
  /** A property in a row: a column. A list or an embedded entity is rows of another table. */
  const column = (name: string): string => {
    const ref = byName.get(name)!;
    if ('entity' in ref || ref.many !== undefined) {
      throw new Untranslatable(`"${name}" is ${'entity' in ref ? 'an embedded entity' : 'a list'}, which is rows of a child table, and a CHECK sees one row`);
    }
    return ident(name);
  };
  const typeOf = (e: RuleExpr): Primitive | undefined => valueType(e, primitiveOf);

  const value = (e: RuleExpr, primitive: Primitive): string => {
    switch (e.op) {
      case '*':
        return `(${value(e.left, typeOf(e.left) ?? primitive)} * ${value(e.right, typeOf(e.right) ?? primitive)})`;
      case 'sum':
        throw new Untranslatable(`a sum adds up the rows of the child table "${e.list}", and a CHECK sees one row`);
      case 'field':
        return column(e.name);
      case 'number':
      case 'text':
      case 'boolean':
        return literalOf(primitive, e);
      case '+':
      case '-': {
        // Days: Postgres's own date - date, date + integer and date - integer.
        if (typeOf(e.left) === 'date' || typeOf(e.right) === 'date') {
          if (primitive === 'integer') return `(${value(e.left, 'date')} - ${value(e.right, 'date')})`;
          // date + integer has no form for BIGINT, so a column or a sum of days is cast to INTEGER.
          const days = e.right.op === 'number' ? e.right.value : `${value(e.right, 'integer')}::INTEGER`;
          return `(${value(e.left, 'date')} ${e.op} ${days})`;
        }
        const [left, right] = [value(e.left, primitive), value(e.right, primitive)];
        return primitive === 'integer' ? `(${left}::BIGINT ${e.op} ${right})` : `(${left} ${e.op} ${right})`;
      }
      default:
        throw new Error(`internal error: ${e.op} is not a value`);
    }
  };

  const condition = (e: RuleExpr): string => {
    switch (e.op) {
      case 'present':
        return `${column(e.field)} IS NOT NULL`;
      case 'absent':
        return `${column(e.field)} IS NULL`;
      case 'not':
        return `NOT (${condition(e.operand)})`;
      case 'and':
      case 'or':
        return `(${condition(e.left)} ${e.op === 'and' ? 'AND' : 'OR'} ${condition(e.right)})`;
      case '<':
      case '<=':
      case '=':
      case '!=':
      case '>=':
      case '>': {
        const primitive = typeOf(e.left) ?? typeOf(e.right);
        if (primitive === undefined) throw new Error('internal error: a comparison of two literals passed pass 6');
        return `${value(e.left, primitive)} ${SQL_OPERATOR[e.op]} ${value(e.right, primitive)}`;
      }
      default:
        throw new Error(`internal error: ${e.op} is not a condition`);
    }
  };

  try {
    return { ok: true, sql: condition(rule) };
  } catch (error) {
    if (error instanceof Untranslatable) return { ok: false, reason: error.message };
    throw error;
  }
}
