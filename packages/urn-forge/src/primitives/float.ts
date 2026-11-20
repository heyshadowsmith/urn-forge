import * as v from 'valibot';
import { numericCoherence, numericConstraints, parseNumberCell } from './numeric.js';
import { definePrimitive } from './types.js';

/** A finite JavaScript number. */
export const float = definePrimitive({
  name: 'float',
  constraints: numericConstraints(v.pipe(v.number(), v.finite())),
  coherence: numericCoherence,
  parseCell: parseNumberCell,
});
