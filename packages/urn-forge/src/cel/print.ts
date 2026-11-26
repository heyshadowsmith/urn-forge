/**
 * The canonical text of a rule: one space around each operator, and parentheses only where the
 * precedence needs them. Two rules with the same canonical text are the same rule.
 */
import type { BinaryOp, Expr } from './parse.js';

const LEVEL: Readonly<Record<BinaryOp, number>> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 3,
  '<=': 3,
  '>': 3,
  '>=': 3,
  in: 3,
  '+': 4,
  '-': 4,
  '*': 5,
  '/': 5,
  '%': 5,
};
const UNARY = 6;
const MEMBER = 7;

function level(expr: Expr): number {
  switch (expr.kind) {
    case 'binary':
      return LEVEL[expr.op];
    case 'unary':
      return UNARY;
    case 'int':
    case 'double':
      // A negative literal binds as a unary minus.
      return expr.value < 0 || Object.is(expr.value, -0) ? UNARY : MEMBER + 1;
    default:
      return MEMBER + 1;
  }
}

function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r')}'`;
}

/** `expr`, in parentheses when its level is below `min`. */
function at(expr: Expr, min: number): string {
  const text = print(expr);
  return level(expr) < min ? `(${text})` : text;
}

/** The canonical text of a rule. */
export function print(expr: Expr): string {
  switch (expr.kind) {
    case 'name':
      return expr.name;
    case 'int':
      return String(expr.value);
    case 'double':
      return expr.text;
    case 'string':
      return quote(expr.value);
    case 'bool':
      return String(expr.value);
    case 'list':
      return `[${expr.items.map(print).join(', ')}]`;
    case 'select':
      return `${at(expr.operand, MEMBER)}.${expr.field}`;
    case 'index':
      return `${at(expr.operand, MEMBER)}[${print(expr.index)}]`;
    case 'call': {
      const args = expr.args.map(print).join(', ');
      return expr.target ? `${at(expr.target, MEMBER)}.${expr.fn}(${args})` : `${expr.fn}(${args})`;
    }
    case 'macro':
      return `${at(expr.target, MEMBER)}.${expr.macro}(${expr.variable}, ${print(expr.body)})`;
    case 'unary':
      return `${expr.op}${at(expr.operand, UNARY)}`;
    case 'binary': {
      const own = LEVEL[expr.op];
      // Left to right: the left side binds at its own level, the right side one level higher.
      // A relation does not chain, so both of its sides bind one level higher.
      const left = at(expr.left, own === 3 ? own + 1 : own);
      const right = at(expr.right, own + 1);
      return `${left} ${expr.op} ${right}`;
    }
  }
}
