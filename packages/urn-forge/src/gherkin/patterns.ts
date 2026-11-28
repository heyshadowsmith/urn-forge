/**
 * The text of each step of urn-forge, as a pattern. No import, so that gate 3 and urn-forge's own
 * harness (self/) read them without loading the test runner.
 */
/** The step texts, which gate 3 reads too. */
export const STEPS = {
  run: /^I run "([^"]+)" with:$/,
  check: /^I check an? "([^"]+)" with:$/,
  output: /^the output is "([^"]+)"$/,
  outputWith: /^the output is "([^"]+)":$/,
  inputRejected: /^the input is rejected by "([^"]+)" of "([^"]+)"$/,
  valueRejected: /^the value is rejected by "([^"]+)" of "([^"]+)"$/,
  accepted: /^the value is accepted$/,
} as const;
