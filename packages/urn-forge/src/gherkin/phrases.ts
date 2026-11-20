/**
 * The texts of urn-forge's generic steps. The step library registers them, and gate 3 reads
 * them to know which table of a scenario is the operation's input.
 */
export const STEP_PHRASES = {
  run: 'I run the operation with:',
  output: 'the output is:',
  rejected: 'the input is rejected on {string}',
} as const;
