/**
 * Each code that urn-forge can give, with its fix: one sentence that says what to do. A code is
 * stable: a tool or an agent can act on it without reading the message. The message says what is
 * wrong in this case; the fix says what to do about each case of the code.
 *
 * The reference of the package (AGENTS.md) lists each code with its fix, and a test keeps the two the
 * same.
 */
export const CODES = {
  // The command line.
  usage: { fix: 'Run urn-forge --help, and call the command with the arguments and options that it shows.' },
  'config-unreadable': { fix: 'Give --config the path of a config file that exists, or remove --config to use urn-forge.config.ts.' },
  'config-invalid': { fix: 'Change the config to use only the options of defineConfig, with the types that the message names.' },
  'manifest-unreadable': { fix: 'Give --manifest, or manifest in the config, the path of a manifest that exists.' },

  // The manifest.
  'yaml-syntax': { fix: 'Correct the YAML at the line that the problem gives.' },
  'manifest-shape': { fix: 'Use only the keys that the message lists, with values of the type that it names; manifest.schema.json has the full shape.' },
  'unknown-definition': { fix: 'Add the definition to definitions:, or correct the name to one that is in definitions:.' },
  'type-cycle': { fix: 'Give one definition of the cycle a type of JSON Schema (string, number, integer, boolean, object or array) in place of the name of another definition.' },
  'duplicate-property': { fix: 'Remove the second copy of the name from properties:.' },
  'unknown-property': { fix: 'Add the name to properties: of the object, or remove it from the rule.' },
  'not-an-object': { fix: 'Make the input or the output of the operation a definition of type: object.' },
  'duplicate-output': { fix: 'Remove the second copy of the object from output:.' },
  'invalid-identifier': { fix: 'Make the identifier a property of the object, list it in the required rule of the object, and give it one value: not an object or a list.' },
  'deprecated-use': { fix: 'Use a definition or a rule that is not deprecated, or remove deprecated: true if it is still the right one.' },
  'standard-name': { fix: 'Give the rule of the manifest a name that is not the name of a standard rule.' },
  'unknown-rule': { fix: 'Add the rule to rules:, or correct the name to a rule of the manifest or a standard rule.' },
  'rule-argument': { fix: 'Give the rule an argument that its parameters accept, or no argument when the rule has no parameters.' },
  'rule-syntax': { fix: 'Write the rule in the CEL subset of urn-forge: the names, operators, functions and macros of the reference.' },
  'rule-type': { fix: 'Change the rule so that each part has the type that the message names, and the rule gives a bool.' },
  'rule-guard': { fix: 'Read an optional property only after has(): has(self.x) && self.x > 0, or !has(self.x) || self.x > 0.' },
  'rule-scope': { fix: 'Use only the names that the message lists: self, input, output, the parameters of the rule, and the variable of a macro.' },
  'invalid-message': { fix: 'Use in {braces} only the names of the parameters of the rule.' },

  // The Postgres schema.
  'postgres-config': { fix: 'Name in postgres: only object definitions that have an identifier, and their properties.' },
  'postgres-column': { fix: 'Give the definitions shorter names, or rename a property so that no two parts give one column name.' },

  // Gate 1: the core.
  'tsconfig-unreadable': { fix: 'Give --tsconfig, or tsconfig in the config, the path of a tsconfig that TypeScript can read.' },
  'core-not-found': { fix: 'Create the core file, or give --core, or core in the config, its path.' },
  'type-error': { fix: 'Correct the type error at the line that the problem gives; do not suppress it.' },
  'core-not-satisfying': { fix: 'Export the core as export const core = { … } satisfies DomainCore, with one function for each operation.' },

  // Gate 2: the boundary.
  'direct-call': { fix: 'Call the core through runOperation(core, operation, input), which checks the input and the answer.' },
  'suppressed-check': { fix: 'Remove the @ts- comment and correct the type error that it hides.' },

  // Gate 3: the scenarios.
  'feature-syntax': { fix: 'Correct the Gherkin of the feature file at the line that the message gives.' },
  'unknown-name': { fix: 'Use in the step the name of an operation, a definition, an output or a rule of the manifest, as the message says.' },
  'uncovered-operation': { fix: 'Add a scenario with When I run "<operation>" with:.' },
  'uncovered-output': { fix: 'Add a scenario of the operation that ends with Then the output is "<output>".' },
  'uncovered-rule': { fix: 'Add a scenario that breaks the rule and ends with Then the input is rejected by "<rule>" of "<definition>", or Then the value is rejected by "<rule>" of "<definition>".' },

  // Gate 4: the generated files.
  drift: { fix: 'Run urn-forge compile, and do not edit a generated file by hand.' },

  // Gate 5: the contract against the base.
  'base-unreadable': { fix: 'Fetch the base ref (git fetch origin <branch>, with enough depth), or give --base a ref that exists.' },
  'removed-rule': { fix: 'Put the rule back; if the contract must accept more, bump manifest.version to a new major version (in 0.x, to a new version) and say why in the change.' },
  'wider-rule': { fix: 'Put the argument back; if the contract must accept more, bump manifest.version to a new major version (in 0.x, to a new version) and say why in the change.' },
  'removed-output': { fix: 'Put the output back; if the operation must no longer give it, bump manifest.version to a new major version (in 0.x, to a new version).' },
  'removed-scenario': { fix: 'Put the scenario back, or bump manifest.version to a new major version (in 0.x, to a new version) when the behaviour it tests is removed on purpose.' },
} as const satisfies Record<string, { readonly fix: string }>;

export type Code = keyof typeof CODES;

/** The fix of a code. */
export function fixOf(code: Code): string {
  return CODES[code].fix;
}
