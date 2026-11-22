# How-to guides

A how-to guide helps you do one task in a project that already uses urn-forge. To learn the basics, do [the tutorials](../tutorials/) first.

## Core guides

These guides come in the order that you meet the tasks.

1. [Install urn-forge](install): make a tarball from a clone, and install it in your project.
2. [Set up a project](set-up-a-project): make the files that `compile`, `verify` and Cucumber need.
3. [Add a field](add-a-field): declare a value with a primitive and its constraints.
4. [Add an entity](add-an-entity): group fields, lists, embedded entities and links.
5. [Add an operation](add-an-operation): declare an operation, write its handler and tag a feature.
6. [Declare an error](declare-an-error): give an operation a named rejection.
7. [Add an invariant](add-an-invariant): declare a rule over the fields of one entity.
8. [Write scenarios](write-scenarios): use the generic steps, tables and Scenario Outlines.
9. [Use branded values in the core](use-branded-values): read the branded input of a handler.
10. [Call an operation from the shell](call-an-operation): call `executeOperation` and handle each result.
11. [Regenerate the code](regenerate-code): compile and commit after a manifest change.
12. [Fix a gate that fails](fix-a-failing-gate): find the cause of a failed gate and correct it.
13. [Run verify in CI](run-verify-in-ci): make `urn-forge verify` a step of your pipeline.

## Extras

- [Store entities in Postgres](store-in-postgres): make tables and statements from the manifest.
- [Emit an event](emit-an-event): give an operation a fact that the shell publishes.
- [Change the contract](change-the-contract): retire a URN, and check a change with `urn-forge diff`.
- [Close boundary gaps](close-boundary-gaps): make coverage gaps errors, or waive a boundary.

## Related pages

- [Tutorials](../tutorials/)
- [Reference](../reference/)
- [Explanation](../explanation/)
