import * as v from 'valibot';
import { definePrimitive, type CoherenceProblem, type ConstraintSpec } from './types.js';

const length: ConstraintSpec<number> = { schema: v.pipe(v.number(), v.safeInteger(), v.minValue(0)) };

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
};

const oneOf: ConstraintSpec<string[]> = {
  schema: v.pipe(
    v.array(v.string()),
    v.minLength(1, 'must list at least one value'),
    v.check((values) => new Set(values).size === values.length, 'must not list a value more than once'),
  ),
};

/** A JavaScript string. `regex` limits its form, and `oneOf` limits it to a fixed set of values. */
export const string = definePrimitive({
  name: 'string',
  constraints: { minLength: length, maxLength: length, regex, oneOf },
  coherence: ({ minLength, maxLength, regex: pattern, oneOf: values }) => {
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
      } else if (pattern !== undefined && !wholeValuePattern(pattern).test(value)) {
        problems.push({ constraint: 'oneOf', message: `oneOf value "${value}" does not match regex ${pattern}, so it is never valid` });
      }
    }
    return problems;
  },
  parseCell: (cell) => cell,
});
