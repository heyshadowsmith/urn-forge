# The conformance tests of CEL

`testdata/` is a copy of the files of `tests/simple/testdata/` of [cel-spec](https://github.com/google/cel-spec), at the commit `3dd8162270505540492e4198a35717c173e1506a`, under the Apache License 2.0 in `LICENSE`. The files are not changed.

`runner.ts` runs each test with urn-forge's parser, type checker and generated code. A test is out of scope only for a type or a feature that a manifest does not have; the reasons are in `REASONS`. `known-gaps.txt` lists the tests in scope that do not pass yet, and `tests/conformance.test.ts` fails if that list is wrong.

Print the counts with `npm run conformance`, and write the list again with `npm run conformance -- --write`.
