# Diff cases

Each directory holds one rule of the classification tables of `planning/lifecycle-plan.md`:
an old manifest, a new manifest, and `expected.txt`, one line `<class> <urn>` for each change
that `urn-forge diff` reports. A `tables.json` lists the Postgres tables, for a Stored use.
`tests/diff.test.ts` runs every case.
