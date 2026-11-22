import * as v from 'valibot';
import { definePrimitive, type ConstraintSpec } from './types.js';

const values: ConstraintSpec<string[]> = {
  schema: v.pipe(
    v.array(v.pipe(v.string(), v.minLength(1, 'must not list an empty value'))),
    v.minLength(1, 'must list at least one value'),
    v.check((list) => new Set(list).size === list.length, 'must not list a value more than once'),
  ),
  aspect: 'membership',
  required: true,
};

/**
 * One of a fixed set of names, such as
 * `zone: { primitive: enum, values: [domestic, international] }`. A closed set is its own
 * kind of value, so no length or shape constraint can meet a membership constraint.
 */
export const enumPrimitive = definePrimitive({
  name: 'enum',
  constraints: { values },
  // `values` is a non-empty list of distinct names, so each one is valid.
  coherence: () => [],
  // The cell as written. `""` is the empty string, which no `enum` lists, so the schema refuses it.
  parseCell: (cell) => (cell === '""' ? '' : cell),
  // Every listed value, and one value that is not listed.
  boundaries: ({ values: listed }) =>
    listed === undefined
      ? []
      : [
          ...listed.map((name) => ({ label: `value "${name}" (values)`, covers: (value: unknown) => value === name })),
          { label: 'value outside values', covers: (value: unknown) => typeof value === 'string' && !listed.includes(value) },
        ],
});
