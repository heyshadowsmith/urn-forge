# How-to guides

A how-to guide helps you do one task in a project that already uses urn-forge. To learn the basics, do [the tutorials](../tutorials/) first.

## Core guides

These guides come in the order that you meet the tasks.

1. [Install urn-forge](install): make a tarball from a clone, and install it in your project.
2. [Set up a project](set-up-a-project): make the files that `compile`, `verify` and Cucumber need.
3. [Add a definition](add-a-definition): declare a value with a type and its rules.
4. [Add an object or a list](add-an-object-or-a-list): group definitions into an object, or make a list of them.
5. [Add a rule](add-a-rule): write a rule of your own in the rule language.
6. [Add an operation](add-an-operation): declare an input and its outputs, and write the function of the core.
7. [Declare a refusal](declare-a-refusal): give an operation an output that refuses the request.
8. [Model a stored record, the caller and the time](model-the-input): give the core the data that it cannot read itself.
9. [Write scenarios](write-scenarios): run operations and break rules with the steps of urn-forge.
10. [Call an operation](call-an-operation): call `runOperation` from the shell, and handle each result.
11. [Regenerate code](regenerate-code): compile and commit after a manifest change.
12. [Fix a failing gate](fix-a-failing-gate): find the cause of a failed gate and correct it.
13. [Run verify in CI](run-verify-in-ci): make `urn-forge verify` and `urn-forge diff` steps of your pipeline.

## Extras

- [Change the contract](change-the-contract): check a change with `urn-forge diff`, and retire a part.
- [Store objects in Postgres](store-in-postgres): make tables and `CHECK` constraints from the manifest.

## Related pages

- [Tutorials](../tutorials/)
- [Reference](../reference/)
- [Explanation](../explanation/)
