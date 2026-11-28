/**
 * Each code that urn-forge can give: what it means, its severity, and its fix, one sentence that says
 * what to do. A code is stable: a tool or an agent can act on it without reading the message. The
 * message says what is wrong in this case; the meaning and the fix are the same for each case.
 *
 * The severity is `by-version` for the codes of gate 5 that a new version can allow: a warning when
 * the version allows the change, and an error when it does not.
 *
 * Each code also lists the commands that report it: verify and diff compile the manifest too, so a code of
 * the manifest comes from each of them.
 *
 * AGENTS.md lists each code with its meaning, severity, commands and fix, and the CLI reference lists each
 * code with its meaning, severity and commands. Tests keep them the same, and self/ states each one.
 */
/** The commands that report problems with a code. init gives a wrong command line as text, with no code. */
export const COMMANDS = ['compile', 'verify', 'diff'] as const;
export type Command = (typeof COMMANDS)[number];

export const CODES = {
  // The command line.
  usage: { meaning: 'The command line is wrong', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Run urn-forge --help, and call the command with the arguments and options that it shows.' },
  'config-unreadable': { meaning: 'The manifest file, or the file that `--config` names, does not exist', severity: 'error', commands: ['compile', 'verify'], fix: 'Give --config the path of a config file that exists, or remove --config to use urn-forge.config.ts.' },
  'config-invalid': { meaning: 'The config does not load, or an option is unknown or of the wrong type', severity: 'error', commands: ['compile', 'verify'], fix: 'Change the config to use only the options of defineConfig, with the types that the message names.' },
  'manifest-unreadable': { meaning: 'The manifest file, or the file that `--config` names, does not exist', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Give --manifest, or manifest in the config, the path of a manifest that exists.' },

  // The manifest.
  'yaml-syntax': { meaning: 'The file is not valid YAML, or a map has one key two times', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Correct the YAML at the line that the problem gives.' },
  'manifest-shape': { meaning: 'A key that is not allowed, a key that is not there, or a value of the wrong shape', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Use only the keys that the message lists, with values of the type that it names; the definition manifest in self/domain.manifest.yaml of the package states each key.' },
  'unknown-definition': { meaning: 'A name that the manifest does not have', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Add the definition to definitions:, or correct the name to one that is in definitions:.' },
  'type-cycle': { meaning: 'A chain of `type` names goes back to its start', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Give one definition of the cycle a base type (string, number, integer, boolean, object, array, map or union) in place of the name of another definition.' },
  'duplicate-property': { meaning: 'A list names a property or an output two times', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Remove the second copy of the name from properties:.' },
  'unknown-property': { meaning: 'A name that the manifest does not have', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Add the name to properties: of the object, or remove it from the rule.' },
  'not-an-object': { meaning: 'The input or an output is not an object', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Make the input or the output of the operation a definition of type: object.' },
  'duplicate-output': { meaning: 'A list names a property or an output two times', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Remove the second copy of the object from output:.' },
  'invalid-identifier': { meaning: 'The identifier is not a required property with one value', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Make the identifier a property of the object, list it in the required rule of the object, and give it one value: not an object or a list.' },
  'deprecated-use': { meaning: 'A live part uses a deprecated part', severity: 'warning', commands: ['compile', 'verify'], fix: 'Use a definition or a rule that is not deprecated, or remove deprecated: true if it is still the right one.' },
  'standard-name': { meaning: 'A rule of the manifest has the name of a standard rule', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Give the rule of the manifest a name that is not the name of a standard rule.' },
  'unknown-rule': { meaning: 'A name that the manifest does not have', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Add the rule to rules:, or correct the name to a rule of the manifest or a standard rule.' },
  'rule-argument': { meaning: 'An argument does not agree with the parameters of the rule', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Give the rule an argument that its parameters accept, or no argument when the rule has no parameters.' },
  'rule-syntax': { meaning: 'The rule does not parse, or uses a form that is not in the rule language', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Write the rule in the rule language of urn-forge: the names, operators, functions and macros of the reference.' },
  'rule-type': { meaning: 'A type in the rule is wrong, the rule does not give a `bool`, or `has()` reads a required property', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Change the rule so that each part has the type that the message names, and the rule gives a bool.' },
  'rule-guard': { meaning: 'The rule reads an optional property without `has()`', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Read an optional property only after has(): has(self.x) && self.x > 0, or !has(self.x) || self.x > 0.' },
  'rule-scope': { meaning: 'The rule reads a name that is not available where you apply the rule, such as `output` in a rule of a definition', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Use only the names that the message lists: self, input, output, the parameters of the rule, and the variable of a macro.' },
  'invalid-message': { meaning: 'A message names `{x}`, but `x` is not a parameter', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Use in {braces} only the names of the parameters of the rule.' },


  // Gate 1: the core.
  'tsconfig-unreadable': { meaning: 'Gate 1 or gate 2: the tsconfig does not exist, or does not parse', severity: 'error', commands: ['verify'], fix: 'Give --tsconfig, or tsconfig in the config, the path of a tsconfig that TypeScript can read.' },
  'core-not-found': { meaning: 'Gate 1: the file of the core does not exist', severity: 'error', commands: ['verify'], fix: 'Create the core file, or give --core, or core in the config, its path.' },
  'type-error': { meaning: 'Gate 1: `tsc` finds a type error in the core, with the tsconfig of the project', severity: 'error', commands: ['verify'], fix: 'Correct the type error at the line that the problem gives; do not suppress it.' },
  'core-not-satisfying': { meaning: 'Gate 1: no export of the core `satisfies DomainCore`', severity: 'error', commands: ['verify'], fix: 'Export the core as export const core = { … } satisfies DomainCore, with one function for each operation.' },

  // Gate 2: the boundary.
  'direct-call': { meaning: 'Gate 2: a shell file calls a function of the core directly, without `runOperation`', severity: 'error', commands: ['verify'], fix: 'Call the core through runOperation(core, operation, input), which checks the input and the answer.' },
  'suppressed-check': { meaning: 'Gate 2: a core or shell file has `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck`', severity: 'error', commands: ['verify'], fix: 'Remove the @ts- comment and correct the type error that it hides.' },

  // Gates 2 and 3: a path that the config or a flag names for a gate.
  'missing-input': { meaning: 'Gate 2 or gate 3: a shell path or a features path does not exist, or the features path is a file that is not a `.feature` file, so the gate would check nothing of it', severity: 'error', commands: ['verify'], fix: 'Correct the path in shell or features of the config, or in --features, to a file or a folder that exists.' },

  // Gate 3: the scenarios.
  'feature-syntax': { meaning: 'Gate 3: a `.feature` file does not parse', severity: 'error', commands: ['verify'], fix: 'Correct the Gherkin of the feature file at the line that the message gives.' },
  'unknown-name': { meaning: 'Gate 3: a step names a part that the manifest does not have', severity: 'error', commands: ['verify'], fix: 'Use in the step the name of an operation, a definition, an output or a rule of the manifest, as the message says.' },
  'uncovered-operation': { meaning: 'Gate 3: no scenario runs an operation', severity: 'error', commands: ['verify'], fix: 'Add a scenario with When I run "<operation>" with:.' },
  'uncovered-output': { meaning: 'Gate 3: no scenario of an operation ends with one of its outputs', severity: 'error', commands: ['verify'], fix: 'Add a scenario of the operation that ends with Then the output is "<output>".' },
  'uncovered-variant': { meaning: 'Gate 3: no scenario reaches a variant of a union', severity: 'error', commands: ['verify'], fix: 'Add a scenario whose table has a value of the variant: for a union with a tag, a value with that value of the tag.' },
  'uncovered-rule': { meaning: 'Gate 3: no scenario breaks a rule of a definition', severity: 'error', commands: ['verify'], fix: 'Add a scenario that breaks the rule and ends with Then the input is rejected by "<rule>" of "<definition>", or Then the value is rejected by "<rule>" of "<definition>".' },

  // Gate 4: the generated files.
  drift: { meaning: 'Gate 4: a generated file is not what `compile` writes now, or it is missing, or `compile` no longer writes it', severity: 'error', commands: ['verify'], fix: 'Run urn-forge compile, and do not edit a generated file by hand.' },

  // Gate 5: the contract against the base.
  'base-unreadable': { meaning: 'Gate 5: the folder is not in a git repository, or the ref is not a commit', severity: 'error', commands: ['verify'], fix: 'Fetch the base ref (git fetch origin <branch>, with enough depth), or give --base a ref that exists.' },
  'removed-rule': { meaning: 'Gate 5: a rule of the base is gone', severity: 'by-version', commands: ['verify'], fix: 'Put the rule back; if the change is on purpose, stop and ask a person, because only a person decides a new manifest.version.' },
  'wider-rule': { meaning: 'Gate 5: a rule accepts more than at the base', severity: 'by-version', commands: ['verify'], fix: 'Put the argument or the text of the rule back; if the change is on purpose, stop and ask a person, because only a person decides a new manifest.version.' },
  'removed-output': { meaning: 'Gate 5: an output of the base is gone', severity: 'by-version', commands: ['verify'], fix: 'Put the output back; if the change is on purpose, stop and ask a person, because only a person decides a new manifest.version.' },
  'removed-scenario': { meaning: 'Gate 5: a scenario of the base is gone', severity: 'by-version', commands: ['verify'], fix: 'Put the scenario back; if the change is on purpose, stop and ask a person, because only a person decides a new manifest.version.' },

  // The files: a file or a folder that the command cannot read or write.
  'io-error': { meaning: 'A file or a folder cannot be read or written: it does not exist, it is not a folder, or the permissions refuse it', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Correct the path or the permissions that the message names, and run the command again.' },

  // urn-forge itself: it checks its own decisions against its contract, self/, and exits with 3 on a failure of its own.
  'internal-error': { meaning: 'urn-forge failed in a way that it does not expect, which is a bug of urn-forge', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Report it in an issue of urn-forge, with the message; run the command again with URN_FORGE_DEBUG=1 to add the stack.' },
  'internal-contract': { meaning: 'urn-forge broke its own contract: an answer of urn-forge does not keep a rule of `self/domain.manifest.yaml`, which is a bug of urn-forge', severity: 'error', commands: ['compile', 'verify', 'diff'], fix: 'Report it in an issue of urn-forge, with the message: urn-forge broke its own contract, and your project did not cause it.' },
} as const satisfies Record<string, { readonly meaning: string; readonly severity: 'error' | 'warning' | 'by-version'; readonly commands: readonly Command[]; readonly fix: string }>;

export type Code = keyof typeof CODES;

/** The fix of a code. */
export function fixOf(code: Code): string {
  return CODES[code].fix;
}
