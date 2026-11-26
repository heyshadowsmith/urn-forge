# Add a form to the CEL subset

This guide is for contributors who change urn-forge itself. The rule language is a subset of CEL, the Common Expression Language. urn-forge parses, types, prints and translates the subset itself, so each form of CEL touches each of these parts. A form is an operator, a function, a method, a macro or a kind of literal.

## Before you start

- You have a clone of urn-forge, and `npm ci` ran in the root folder.
- `npm test` and `npm run typecheck` pass.
- You read [How urn-forge is built](./architecture.md), the sections "The rule language" and "The generated file".
- You know the meaning of the form in the [CEL language definition](https://github.com/google/cel-spec/blob/master/doc/langdef.md).

Commands run from `packages/urn-forge`, except where a step says the root folder.

## Make sure that the form is necessary

The subset grows only for a real need (decision 23 of the [redesign notes](../planning/manifest-redesign-notes.md)). A new form must also pass the three tests of decision 10 of the [contract completeness roadmap](../planning/contract-completeness-roadmap.md):

1. Its name and its meaning do not name an idea of one domain.
2. No construct that exists can state the promise, also with more lines.
3. Its meaning is one sentence that names no domain, and the generated code enforces exactly that sentence.

Thus:

1. Find the real need: a promise of a contract in `contracts/`, a domain, or a standard rule. Name it in the pull request.
2. Write the promise with the forms that exist. If more lines can state it, do not add the form.
3. Use a form that CEL has, with the meaning of CEL. Each rule that the subset accepts must be valid CEL, and it must give the same result in CEL. Prefer a form that Kubernetes or protovalidate also use, such as a function of the Kubernetes list extension.
4. Add the smallest form that states the promise. For example, the subset has `map` and `sum()` for totals, but not `filter`, `min()` or `max()`.

If the form fails a test, the promise stays a workaround. A form that is not in the subset is a `rule-syntax` error, not a quiet addition.

## Parse the form

1. In `src/cel/parse.ts`, add the form to the lexer or to the parser. A function or a method goes in `FunctionName`, a macro in `MacroName` and `MACROS`. A new kind of node goes in the `Expr` type.
2. Check the arguments in the parser where the count or the kind is fixed. For example, `matches()` takes one argument, and `has()` takes one property. Throw a `CelSyntaxError` with a message that tells what to write.
3. If the parser has a special message for the form, such as `the method filter() is not in the subset`, remove it.
4. Add the form to the list of the subset in the comment at the top of the file.

## Print the form

In `src/cel/print.ts`, give the canonical text of the form. `diff` compares two rules by this text. Thus two spellings of one rule must print the same text, and the text must parse to the same tree. Give the precedence of a new operator in `LEVEL`.

## Type the form

In `src/cel/check.ts`, give the type of the form from the types of its parts.

- Refuse each type that CEL refuses, with `rule-type` and a message that names the types that the form takes.
- If the form takes a function of its argument, such as a macro, check that its variable is a new name (`rule-scope`).
- If the form can read an optional property, make sure that the guard facts still apply. A read of an optional property without `has()` is `rule-guard`.

## Make the code

1. In `src/generate/emit-cel.ts`, write the form as TypeScript. Where CEL and JavaScript differ, use the types of the checker to choose the code. For example, `/` of two ints goes toward 0, and `==` of two lists compares item by item.
2. If the form needs a helper, add it to `src/generate/runtime.ts`. Start its name with `$`. `runtimeSource` copies the file into each generated file. It removes the import of `valibot`, because the header of the generated file imports it as `v`. Thus the helper can use `v`, but it must import nothing else.
3. If CEL gives an error for a value, such as `timestamp()` of a text that is not a time, throw a `RuleError`. `$holds` then counts the rule as broken.
4. In `src/generate/postgres.ts`, translate the form in `toSql`. If SQL cannot say the form with the same meaning, throw `Untranslatable`. The schema then names the rule in a comment, and the harness checks it.
5. `diff` compares the canonical text, so it usually needs no change. Change `src/diff/classify.ts` only if the form gives a direction to a new argument.

A change to `runtime.ts` changes each generated file. Compile each domain again, as [CONTRIBUTING.md](../CONTRIBUTING.md) tells in "Compile the generated files again".

## Test the form

1. In `tests/cel.test.ts`:
   - Add the form to the table of "parse and print", with its canonical text.
   - Add its type, and each type problem, to "types".
   - If it was in the table of forms that do not parse, remove it from there.
2. Use the form in a rule of the booking fixture, `tests/fixtures/booking/domain.manifest.yaml`, if the fixture has a real use for it. Add a scenario that breaks the rule to `features/seat.feature`, then compile the fixture again:

   ```bash
   node bin/urn-forge.js compile --config tests/fixtures/booking/urn-forge.config.ts
   ```

3. In `tests/generated.test.ts`, add a value that keeps the rule and a value that breaks it.
4. If `toSql` translates the form, add a case to `tests/postgres.test.ts`. The test runs the schema on PGlite, so the SQL must refuse what the rule refuses.
5. Run `npm test` and `npm run typecheck` from the root folder. Run them again with `TZ=Pacific/Chatham LC_ALL=tr_TR.UTF-8` if the form reads a time or compares text.

## Update the docs

1. In [The rule language](../packages/urn-forge/AGENTS.md), add the form to its table, and remove it from "Not in the subset". Copy each message from a real run.
2. If the form changes a decision of the [redesign notes](../planning/manifest-redesign-notes.md), such as the list of decision 24, record the change in the plan of the work.
3. Run `npm run docs:build` from the root folder.

## Result

A rule can use the form. `compile` types it, the generated file runs it with the meaning of CEL, the Postgres schema translates it or names it, and `diff` compares it.

## Related pages

- [How urn-forge is built](./architecture.md)
- [Add a standard rule](./add-a-standard-rule.md)
- [The rule language](../packages/urn-forge/AGENTS.md)
- [JSON Schema and CEL](../docs/methodology.md)
