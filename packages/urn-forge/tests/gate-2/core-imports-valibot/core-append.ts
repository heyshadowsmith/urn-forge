import * as v from 'valibot';
export const isText = (x: unknown) => v.is(v.string(), x);
