import * as v from 'valibot';
import { numericBoundaries, numericCoherence, numericConstraints, parseNumberCell } from './numeric.js';
import { definePrimitive } from './types.js';

/** A safe-integer JavaScript number. */
export const integer = definePrimitive({
  name: 'integer',
  constraints: numericConstraints(v.pipe(v.number(), v.safeInteger())),
  coherence: numericCoherence,
  parseCell: parseNumberCell,
  boundaries: numericBoundaries('integer'),
});
