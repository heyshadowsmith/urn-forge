# Gate 2 cases (gate 2 plan, step 0)

Each directory is one rule of gate 2 on a copy of the insurance domain: `core-append.ts` is
added to the end of insurance's `core.ts`, `shell.ts` becomes a shell file, and
`expected.txt` lists the codes that gate 2 reports, one per line (empty for none).
`tests/gate-2.test.ts` runs every case.
