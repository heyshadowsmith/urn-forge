import * as v from 'valibot';
import { definePrimitive, type CoherenceProblem, type ConstraintSpec } from './types.js';

const length: ConstraintSpec<number> = { schema: v.pipe(v.number(), v.safeInteger(), v.minValue(0)) };

const oneOf: ConstraintSpec<string[]> = {
  schema: v.pipe(
    v.array(v.string()),
    v.minLength(1, 'must list at least one value'),
    v.check((values) => new Set(values).size === values.length, 'must not list a value more than once'),
  ),
};

/** A JavaScript string. `oneOf` limits it to a fixed set of values. */
export const string = definePrimitive({
  name: 'string',
  constraints: { minLength: length, maxLength: length, oneOf },
  coherence: ({ minLength, maxLength, oneOf: values }) => {
    if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
      return [{ constraint: 'maxLength', message: `minLength (${minLength}) is greater than maxLength (${maxLength}), so no value is valid` }];
    }
    // A listed value that the length constraints exclude can never be valid.
    const problems: CoherenceProblem[] = [];
    for (const value of values ?? []) {
      if (minLength !== undefined && value.length < minLength) {
        problems.push({ constraint: 'oneOf', message: `oneOf value "${value}" is shorter than minLength (${minLength}), so it is never valid` });
      } else if (maxLength !== undefined && value.length > maxLength) {
        problems.push({ constraint: 'oneOf', message: `oneOf value "${value}" is longer than maxLength (${maxLength}), so it is never valid` });
      }
    }
    return problems;
  },
  parseCell: (cell) => cell,
});
