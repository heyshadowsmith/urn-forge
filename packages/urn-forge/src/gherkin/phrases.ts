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

/** Matches the text of either `fails with` step, capturing the error URN. */
export const FAILS_WITH_TEXT = /^the operation fails with "([^"]*)"(:?)$/;
