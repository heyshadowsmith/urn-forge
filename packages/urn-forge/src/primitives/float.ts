import { BOUND_GROUPS, floatConstraints, numberBoundaries, numberCoherence, parseNumberCell } from './numeric.js';
import { definePrimitive } from './types.js';

/** An approximate measurement: a finite JavaScript number. Its bounds can be inclusive or exclusive. */
export const float = definePrimitive({
  name: 'float',
  constraints: floatConstraints,
  exclusive: BOUND_GROUPS,
  coherence: numberCoherence('float'),
  parseCell: parseNumberCell,
  boundaries: numberBoundaries('float'),
});
