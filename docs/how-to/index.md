# How-to guides

A how-to guide helps you do one task. Each guide starts from a project that already uses urn-forge. It does not teach the basics. To learn the basics, do [the tutorials](../tutorials/) first.

## Setup

- [Install urn-forge](install): make a tarball from a clone, and install it in your project.
- [Set up a project](set-up-a-project): make the files that a project needs.

## The manifest

- [Add a field](add-a-field): declare a value with a primitive and its constraints.
- [Add an entity](add-an-entity): group fields into an input, an output or an error payload.
- [Add an operation](add-an-operation): declare an operation, write its handler and tag a feature with it.
- [Declare an error](declare-an-error): give an operation a named rejection.
- [Add an invariant](add-an-invariant): declare a rule over the fields of one entity, and break it in a scenario.
- [Retire a URN](retire-a-urn): deprecate an atom for a replacement, then set it to sunset.

## Scenarios

- [Write scenarios](write-scenarios): use the six steps, tables and Scenario Outlines.
- [Waive a boundary](waive-a-boundary): remove the coverage gaps of one field, with a reason.

## The core and the shell

- [Use branded values in the core](use-branded-values): read and compare the branded input of a handler.
- [Call an operation from the shell](call-an-operation): call `executeOperation` and handle each result.
- [Store entities in Postgres](store-in-postgres): make tables from the manifest, write rows, and map a Postgres error to a URN.
- [Regenerate the code after a manifest change](regenerate-code): compile, commit, and fix drift.

## Verify and CI

- [Fix a gate that fails](fix-a-failing-gate): find the cause of a failed gate and correct it.
- [Adopt strict coverage](adopt-strict-coverage): make coverage gaps errors, one feature at a time.
- [Check compatibility in CI](check-compatibility): run `urn-forge diff`, and fix a breaking change to a URN.
- [Run verify in CI](run-verify-in-ci): make `urn-forge verify` a gate of your pipeline.

## Contributors

These guides are for people who change urn-forge itself.

- [Add a primitive](add-a-primitive)
- [Add a constraint](add-a-constraint)
- [Add a kind](add-a-kind)
- [Add a plugin](add-a-plugin)
- [Add a test fixture](add-a-fixture)

## Related pages

- [Tutorials](../tutorials/)
- [Reference](../reference/)
- [Explanation](../explanation/)
