/**
 * The texts of urn-forge's generic steps. The step library registers them, and gate 3 reads
 * them to know which table of a scenario is the operation's input.
 */
export const STEP_PHRASES = {
  run: 'I run the operation with:',
  output: 'the output is:',
  rejected: 'the input is rejected on {string}',
  failsWith: 'the operation fails with {string}',
  /** The same, followed by a table of the error's fields. */
  failsWithFields: 'the operation fails with {string}:',
} as const;

/**
 * Matches the text of either `fails with` step. Cucumber's `{string}` accepts double or
 * single quotes, so this does too: group 1 or group 2 is the error URN.
 */
export const FAILS_WITH_TEXT = /^the operation fails with (?:"([^"]*)"|'([^']*)')(:?)$/;

/** The error URN of a `fails with` step text, or `undefined` for any other step. */
export function failsWithUrn(text: string): string | undefined {
  const match = FAILS_WITH_TEXT.exec(text);
  return match ? (match[1] ?? match[2]) : undefined;
}
