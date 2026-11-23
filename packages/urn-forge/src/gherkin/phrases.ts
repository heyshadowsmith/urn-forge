/**
 * The texts of urn-forge's generic steps. The step library registers them, and gate 3 reads
 * them to know which table of a scenario is the operation's input.
 */
export const STEP_PHRASES = {
  /** The record that the operation changes, as the shell loads it: one header row and one data row. */
  current: 'the current {word} is:',
  /** The shell found no record that the operation changes. */
  noCurrent: 'there is no current {word}',
  /** Records of an entity with unique values, as the store holds them before the call: one header row and a row for each. */
  stored: 'these {word} records are stored:',
  /** Who calls, as the shell authenticated them: one header row and one data row. */
  caller: 'the caller is:',
  /** The time of the call, as the shell's clock would give it: a UTC timestamp. */
  time: 'the time is {string}',
  run: 'I run the operation with:',
  /** The same operation once more in the scenario, as a repeat of the caller: the answers of the scenario are kept. */
  runAgain: 'I run the operation again with:',
  /** The answer of the last run is the answer of the first run that succeeded. */
  firstAnswer: 'the answer is the first answer',
  output: 'the output is:',
  rejected: 'the input is rejected on {string}',
  /** The input breaks the invariant with this URN. */
  rejectedBy: 'the input is rejected by {string}',
  failsWith: 'the operation fails with {string}',
  /** The same, followed by a table of the error's fields. */
  failsWithFields: 'the operation fails with {string}:',
  /** The operation succeeded and returned this event. */
  emits: 'the operation emits {string}',
  /** The same, followed by a table of the event's fields. */
  emitsWithFields: 'the operation emits {string}:',
  emitsNone: 'the operation emits no event',
  /** The call refused, so it changed nothing: no output, no event, and no statement from commit. */
  nothingChanges: 'nothing changes',
  /** A timed change, called for a record that is not due: the shell's clock must not call it. */
  notDue: 'the operation is not due',
  /** The operation succeeded without this event. */
  emitsNoneOf: 'the operation emits no {string}',
  /** The operation refused, and the error records this event for an audit trail. */
  recordedAs: 'the refusal is recorded as {string}',
  /** The same, followed by a table of the event's fields. */
  recordedAsWithFields: 'the refusal is recorded as {string}:',
} as const;

/** Matches the text of the current-record step: group 1 is the word, such as `booking`. */
export const CURRENT_TEXT = /^the current (\S+) is:$/;

/** Matches the text of the no-record step: group 1 is the word. */
export const NO_CURRENT_TEXT = /^there is no current (\S+)$/;

/** The word of a current-record step, or of a no-record step, or undefined for any other step. */
export function currentWord(text: string): string | undefined {
  return CURRENT_TEXT.exec(text)?.[1] ?? NO_CURRENT_TEXT.exec(text)?.[1];
}

/**
 * Matches the text of either `fails with` step. Cucumber's `{string}` accepts double or
 * single quotes, so this does too: group 1 or group 2 is the error URN.
 */
export const FAILS_WITH_TEXT = /^the operation fails with (?:"([^"]*)"|'([^']*)')(:?)$/;

/** Matches the text of the `rejected by` step, in double or single quotes. */
export const REJECTED_BY_TEXT = /^the input is rejected by (?:"([^"]*)"|'([^']*)')$/;

/** The invariant URN of a `rejected by` step text, or `undefined` for any other step. */
export function rejectedByUrn(text: string): string | undefined {
  const match = REJECTED_BY_TEXT.exec(text);
  return match ? (match[1] ?? match[2]) : undefined;
}

/** Matches the text of either `emits` step, in double or single quotes: group 1 or group 2 is the event URN. */
export const EMITS_TEXT = /^the operation emits (?:"([^"]*)"|'([^']*)')(:?)$/;

/** The event URN of an `emits` step text, or `undefined` for any other step. */
export function emitsUrn(text: string): string | undefined {
  const match = EMITS_TEXT.exec(text);
  return match ? (match[1] ?? match[2]) : undefined;
}

/** Matches the text of the time step, in double or single quotes: group 1 or group 2 is the time. */
export const TIME_TEXT = /^the time is (?:"([^"]*)"|'([^']*)')$/;

/** The time of a time step text, or `undefined` for any other step. */
export function timeOf(text: string): string | undefined {
  const match = TIME_TEXT.exec(text);
  return match ? (match[1] ?? match[2]) : undefined;
}

/** Matches the text of the step that expects a success without an event, in double or single quotes. */
export const EMITS_NONE_OF_TEXT = /^the operation emits no (?:"([^"]*)"|'([^']*)')$/;

/** The event URN of an `emits no "<urn>"` step text, or `undefined` for any other step. */
export function emitsNoneOfUrn(text: string): string | undefined {
  const match = EMITS_NONE_OF_TEXT.exec(text);
  return match ? (match[1] ?? match[2]) : undefined;
}

/** Matches the text of either `recorded as` step, in double or single quotes: group 1 or group 2 is the event URN. */
export const RECORDED_AS_TEXT = /^the refusal is recorded as (?:"([^"]*)"|'([^']*)')(:?)$/;

/** The event URN of a `recorded as` step text, or `undefined` for any other step. */
export function recordedAsUrn(text: string): string | undefined {
  const match = RECORDED_AS_TEXT.exec(text);
  return match ? (match[1] ?? match[2]) : undefined;
}

/** The error URN of a `fails with` step text, or `undefined` for any other step. */
export function failsWithUrn(text: string): string | undefined {
  const match = FAILS_WITH_TEXT.exec(text);
  return match ? (match[1] ?? match[2]) : undefined;
}
