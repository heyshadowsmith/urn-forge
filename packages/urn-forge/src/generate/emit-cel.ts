/**
 * A rule as TypeScript: the code that the generated file runs to check it. The types of the checker
 * choose the code where CEL and JavaScript differ: `/` of two ints goes toward 0, `+` of two lists
 * joins them, `==` compares lists and objects item by item. A duration is its milliseconds, and a
 * timestamp is its milliseconds since 1970: they compare and add as numbers.
 */
import type { CelType } from '../cel/check.js';
import { resolve } from '../cel/functions.js';
import type { Expr } from '../cel/parse.js';

export { durationMs } from '../cel/time.js';
import { durationMs } from '../cel/time.js';

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
        if (e.fn === 'has') {
          const select = e.args[0] as Expr & { kind: 'select' };
          return `((${emit(select.operand, scope)} as any)[${JSON.stringify(select.field)}] !== undefined)`;
        }
        if (e.fn === 'duration') {
          const arg = e.args[0]!;
          return arg.kind === 'string' ? String(durationMs(arg.value)) : emit(arg, scope);
        }
        const target = e.target ? typeOf(e.target) : undefined;
        const resolved = resolve(e.fn, target, e.args.map((a) => typeOf(a)!));
        if (!resolved) throw new Error(`no overload of ${e.fn}`);
        const operands = [...(e.target ? [e.target] : []), ...e.args].map((a) => emit(a, scope));
        if (resolved.overload.typed) operands.push(JSON.stringify([...(e.target ? [e.target] : []), ...e.args].map((a) => typeOf(a))));
        return `${resolved.overload.helper}(${operands.join(', ')})`;
      }
      case 'macro': {
        const variable = `v_${e.variable}`;
        const index = e.index !== undefined ? `v_${e.index}` : '_i';
        const inner = { ...scope, [e.variable]: variable, ...(e.index !== undefined ? { [e.index]: index } : {}) };
        const list = `(${emit(e.target, scope)} as any[])`;
        const fn = (body: Expr): string => `(${variable}: any, ${index}: number) => ${emit(body, inner)}`;
        switch (e.macro) {
          case 'all':
            return `$all(${list}, ${fn(e.body)})`;
          case 'exists':
            return `$exists(${list}, ${fn(e.body)})`;
          case 'exists_one':
          case 'existsOne':
            return `(${list}.filter(${fn(e.body)}).length === 1)`;
          case 'map':
            return `${list}.map(${fn(e.body)})`;
          case 'filter':
            return `${list}.filter(${fn(e.body)})`;
          case 'transformList':
            return e.filter ? `${list}.flatMap((${variable}: any, ${index}: number) => (${emit(e.filter, inner)} ? [${emit(e.body, inner)}] : []))` : `${list}.map(${fn(e.body)})`;
          case 'sortBy':
            return `$sortBy(${list}, ${fn(e.body)})`;
        }
        break;
      }
      case 'unary':
        return isInt(e) && e.op === '-' ? `$int53(-${emit(e.operand, scope)})` : `(${e.op}${emit(e.operand, scope)})`;
      case 'conditional':
        return `(${emit(e.condition, scope)} ? ${emit(e.then, scope)} : ${emit(e.otherwise, scope)})`;
      case 'binary': {
        const left = emit(e.left, scope);
        const right = emit(e.right, scope);
        switch (e.op) {
          case '&&':
            return `$and(() => ${left}, () => ${right})`;
          case '||':
            return `$or(() => ${left}, () => ${right})`;
          case '==':
            return `$eq(${left}, ${right})`;
          case '!=':
            return `!$eq(${left}, ${right})`;
          case 'in':
            return `$in(${left}, ${right})`;
          case '+':
            if (typeOf(e)?.kind === 'list') return `$add(${left}, ${right})`;
            if (typeOf(e)?.kind === 'timestamp') return `$timestampInRange((${left} as number) + (${right} as number))`;
            if (typeOf(e)?.kind === 'duration') return `$durationInRange((${left} as number) + (${right} as number))`;
            return isInt(e) ? `$int53((${left} as number) + (${right} as number))` : `((${left} as any) + (${right} as any))`;
          case '-':
          case '*':
            if (typeOf(e)?.kind === 'timestamp') return `$timestampInRange((${left} as number) ${e.op} (${right} as number))`;
            if (typeOf(e)?.kind === 'duration') return `$durationInRange((${left} as number) ${e.op} (${right} as number))`;
            return isInt(e) ? `$int53((${left} as number) ${e.op} (${right} as number))` : `((${left} as any) ${e.op} (${right} as any))`;
          case '/':
            return isInt(e) ? `$divInt(${left}, ${right})` : `((${left} as number) / (${right} as number))`;
          case '%':
            return `$mod(${left}, ${right})`;
          default:
            return `((${left} as any) ${e.op} (${right} as any))`;
        }
      }
    }
    throw new Error(`no code for ${(e as Expr).kind}`);
  };
  return emit(expr, {});
}
