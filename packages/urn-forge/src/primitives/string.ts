import * as v from 'valibot';
import { definePrimitive, type BoundaryCase, type ConstraintSpec } from './types.js';

const length: ConstraintSpec<number> = { schema: v.pipe(v.number(), v.safeInteger(), v.minValue(0)), aspect: 'size' };

/**
 * A `regex` pattern matches the whole value: `[a-z]+` means `^(?:[a-z]+)$`. It is a
 * JavaScript regular expression in Unicode mode (the `u` flag), with no other flags.
 */
export function wholeValuePattern(pattern: string): RegExp {
  return new RegExp(`^(?:${pattern})$`, 'u');
}

/** Why `pattern` does not compile, or undefined when it does. */
function patternError(pattern: string): string | undefined {
  try {
    // The raw pattern first, so the message describes what the manifest says (the wrapped
    // form can fail differently: in `[a-`, the wrapper's `)` would join the class).
    new RegExp(pattern, 'u');
    wholeValuePattern(pattern);
    return undefined;
  } catch (error) {
    return (error as Error).message;
  }
}

const regex: ConstraintSpec<string> = {
  schema: v.pipe(
    v.string(),
    v.minLength(1, 'must not be empty'),
    v.check((pattern) => patternError(pattern) === undefined, (issue) => `must be a valid regular expression: ${patternError(issue.input as string)}`),
  ),
  aspect: 'shape',
};


/**
 * Named shapes that a `regex` cannot express clearly (primitives plan). A name joins the
 * list only when that is true, so `format` does not become a second `regex`.
 */
export const FORMATS = ['uuid', 'email', 'uri'] as const;
export type Format = (typeof FORMATS)[number];

const FORMAT_SCHEMAS: { readonly [F in Format]: v.GenericSchema<string, string> } = {
  uuid: v.pipe(v.string(), v.uuid()),
  email: v.pipe(v.string(), v.email()),
  uri: v.pipe(v.string(), v.url()),
};

/** Whether `value` is a string of the named format, as the generated schema decides it. */
export function matchesFormat(format: Format, value: unknown): boolean {
  return v.is(FORMAT_SCHEMAS[format], value);
}

/** Every UUID has this length, so length constraints that exclude it admit no value. */
const UUID_LENGTH = 36;

const format: ConstraintSpec<Format> = {
  schema: v.picklist(FORMATS, `must be one of ${FORMATS.join(', ')}`),
  aspect: 'shape',
};

/** Free text. `minLength` and `maxLength` limit its size, and `regex` its shape. A fixed set of values is an `enum`. */
export const string = definePrimitive({
  name: 'string',
  constraints: { minLength: length, maxLength: length, regex, format },
  exclusive: [{ keys: ['regex', 'format'], what: 'the shape' }],
  coherence: ({ minLength, maxLength, format: shape }) => {
    if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
      return [{ constraint: 'maxLength', message: `minLength (${minLength}) is greater than maxLength (${maxLength}), so no value is valid` }];
    }
    if (shape === 'uuid' && ((minLength ?? 0) > UUID_LENGTH || (maxLength ?? UUID_LENGTH) < UUID_LENGTH)) {
      return [{ constraint: 'format', message: `a uuid has ${UUID_LENGTH} characters, which the length constraints exclude, so no value is valid` }];
    }
    return [];
  },
  // `""` is the empty string: an empty cell means "absent", so it could not send one.
  parseCell: (cell) => (cell === '""' ? '' : cell),
  boundaries: ({ minLength, maxLength, regex: pattern, format: shape }) => {
    const isString = (value: unknown): value is string => typeof value === 'string';
    // A length counts Unicode code points (Postgres plan, decision 5).
    const ofLength = (n: number) => (value: unknown) => isString(value) && [...value].length === n;
    const cases: BoundaryCase[] = [];
    if (minLength !== undefined) {
      cases.push({ label: `value of length ${minLength} (minLength)`, covers: ofLength(minLength) });
      if (minLength > 0) cases.push({ label: `value of length ${minLength - 1} (below minLength)`, covers: ofLength(minLength - 1) });
    }
    if (maxLength !== undefined) {
      cases.push({ label: `value of length ${maxLength} (maxLength)`, covers: ofLength(maxLength) });
      cases.push({ label: `value of length ${maxLength + 1} (above maxLength)`, covers: ofLength(maxLength + 1) });
    }
    if (pattern !== undefined) {
      const whole = wholeValuePattern(pattern);
      cases.push({ label: `valid value for regex ${pattern}`, covers: (value) => isString(value) && whole.test(value) });
      cases.push({ label: `invalid value for regex ${pattern}`, covers: (value) => isString(value) && !whole.test(value) });
    }
    if (shape !== undefined) {
      cases.push({ label: `valid ${shape} (format)`, covers: (value) => matchesFormat(shape, value) });
      cases.push({ label: `value that is not a valid ${shape}`, covers: (value) => isString(value) && !matchesFormat(shape, value) });
    }
    return cases;
  },
});
