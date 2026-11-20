import * as v from 'valibot';
import { definePrimitive, type ConstraintSpec } from './types.js';

const length: ConstraintSpec<number> = { schema: v.pipe(v.number(), v.safeInteger(), v.minValue(0)) };

/** A JavaScript string. */
export const string = definePrimitive({
  name: 'string',
  constraints: { minLength: length, maxLength: length },
  coherence: ({ minLength, maxLength }) =>
    minLength !== undefined && maxLength !== undefined && minLength > maxLength
      ? [{ constraint: 'maxLength', message: `minLength (${minLength}) is greater than maxLength (${maxLength}), so no value is valid` }]
      : [],
  parseCell: (cell) => cell,
});
