import * as v from 'valibot';
import { definePrimitive } from './types.js';

/**
 * A JavaScript boolean. `mustBe` pins the value, for a flag that only one value may pass,
 * such as `terms_accepted: { primitive: boolean, mustBe: true }`.
 */
export const boolean = definePrimitive({
  name: 'boolean',
  constraints: { mustBe: { schema: v.boolean() } },
  // One constraint with one value always admits that value.
  coherence: () => [],
  // `true` and `false` become booleans; any other text stays a string, for the schema to reject.
  parseCell: (cell) => (cell === 'true' ? true : cell === 'false' ? false : cell),
});
