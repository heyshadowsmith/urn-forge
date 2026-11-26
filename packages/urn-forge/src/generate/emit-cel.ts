/**
 * A rule as TypeScript: the code that the generated file runs to check it. The types of the checker
 * choose the code where CEL and JavaScript differ: `/` of two ints goes toward 0, `+` of two lists
 * joins them, `==` compares lists and objects item by item. A duration is its milliseconds, and a
 * timestamp is its milliseconds since 1970: they compare and add as numbers.
 */
import type { CelType } from '../cel/check.js';
import type { Expr } from '../cel/parse.js';

/** The milliseconds of a CEL duration literal, such as '1h30m'. */
export function durationMs(text: string): number {
  const UNITS: Readonly<Record<string, number>> = { h: 3_600_000, m: 60_000, s: 1000, ms: 1, us: 0.001, ns: 0.000001 };
  let total = 0;
  for (const [, amount, unit] of text.matchAll(/(\d+(?:\.\d+)?)(ms|us|ns|h|m|s)/g)) total += Number(amount) * UNITS[unit!]!;
  return total;
}

/**
 * The TypeScript of a rule. `names` gives the code of each name of the scope, such as `self` →
 * `value`. The variable of a macro becomes a parameter of an arrow function.
 */
export function emitRule(expr: Expr, types: ReadonlyMap<Expr, CelType>, names: Readonly<Record<string, string>>): string {
  const typeOf = (e: Expr): CelType | undefined => types.get(e);
  const isInt = (e: Expr): boolean => typeOf(e)?.kind === 'int';

  const emit = (e: Expr, scope: Readonly<Record<string, string>>): string => {
    switch (e.kind) {
      case 'name':
        return scope[e.name] ?? names[e.name] ?? e.name;
      case 'int':
      case 'double':
        return e.value < 0 ? `(${e.value})` : String(e.value);
      case 'string':
        return JSON.stringify(e.value);
      case 'bool':
        return String(e.value);
      case 'list':
        return `[${e.items.map((i) => emit(i, scope)).join(', ')}]`;
      case 'select':
        return `(${emit(e.operand, scope)} as any)[${JSON.stringify(e.field)}]`;
      case 'index':
        return `$index(${emit(e.operand, scope)}, ${emit(e.index, scope)})`;
      case 'call': {
        const target = e.target ?? e.args[0]!;
        switch (e.fn) {
          case 'has': {
            const select = e.args[0] as Expr & { kind: 'select' };
            return `((${emit(select.operand, scope)} as any)[${JSON.stringify(select.field)}] !== undefined)`;
          }
          case 'size':
            return `$size(${emit(target, scope)})`;
          case 'sum':
            return `$sum(${emit(target, scope)})`;
          case 'matches':
            return `$matches(${emit(target, scope)}, ${emit(e.args[0]!, scope)})`;
          case 'timestamp':
            return `$timestamp(${emit(target, scope)})`;
          case 'duration':
            return String(durationMs((e.args[0] as Expr & { kind: 'string' }).value));
        }
        break;
      }
      case 'macro': {
        const variable = `v_${e.variable}`;
        const inner = { ...scope, [e.variable]: variable };
        const list = `(${emit(e.target, scope)} as any[])`;
        const body = emit(e.body, inner);
        switch (e.macro) {
          case 'all':
            return `${list}.every((${variable}: any) => ${body})`;
          case 'exists':
            return `${list}.some((${variable}: any) => ${body})`;
          case 'exists_one':
            return `(${list}.filter((${variable}: any) => ${body}).length === 1)`;
          case 'map':
            return `${list}.map((${variable}: any) => ${body})`;
          case 'filter':
            return `${list}.filter((${variable}: any) => ${body})`;
        }
        break;
      }
      case 'unary':
        return `(${e.op}${emit(e.operand, scope)})`;
      case 'binary': {
        const left = emit(e.left, scope);
        const right = emit(e.right, scope);
        switch (e.op) {
          case '&&':
          case '||':
            return `(${left} ${e.op} ${right})`;
          case '==':
            return `$eq(${left}, ${right})`;
          case '!=':
            return `!$eq(${left}, ${right})`;
          case 'in':
            return `$in(${left}, ${right})`;
          case '+':
            return typeOf(e)?.kind === 'list' ? `$add(${left}, ${right})` : `((${left} as any) + (${right} as any))`;
          case '/':
            return isInt(e) ? `$divInt(${left}, ${right})` : `((${left} as number) / (${right} as number))`;
          case '%':
            return `$mod(${left}, ${right})`;
          default:
            return `((${left} as any) ${e.op} (${right} as any))`;
        }
      }
    }
    throw new Error(`no code for ${e.kind}`);
  };
  return emit(expr, {});
}
