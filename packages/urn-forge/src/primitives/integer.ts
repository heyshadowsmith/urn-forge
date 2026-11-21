import { integerConstraints, numberBoundaries, numberCoherence, parseNumberCell } from './numeric.js';
import { definePrimitive } from './types.js';

/** An exact whole number: a safe-integer JavaScript number. Its bounds are inclusive. */
export const integer = definePrimitive({
  name: 'integer',
  constraints: integerConstraints,
  coherence: numberCoherence('integer'),
  parseCell: parseNumberCell,
  boundaries: numberBoundaries('integer'),
});
