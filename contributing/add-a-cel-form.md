# Change the rule language

This guide is for contributors who change urn-forge itself. The rule language is CEL, the Common Expression Language, and its standard extensions, for the types of a manifest. urn-forge parses, types, prints and translates it itself.

## Before you start

- You have a clone of urn-forge, and `npm ci` ran in the root folder.
- `npm test` and `npm run typecheck` pass.
- You read [How urn-forge is built](./architecture.md), the sections "The rule language" and "The generated file".
- You know the meaning of the form in the [CEL language definition](https://github.com/google/cel-spec/blob/master/doc/langdef.md), or in the documentation of its extension.

Commands run from `packages/urn-forge`, except where a step says the root folder.

## What is in the language

The language is each form of CEL and its extensions, for strings, numbers, bools, times and lists (decision 1 of the [plan of the full rule language](../planning/full-rule-language-plan.md)). A form is out for a type or a feature that a manifest does not have, such as maps, bytes or `null`, or because a rule is unlikely to need it, such as `format()` or `sort()`. "Not in the language" of [The rule syntax](../docs/reference/syntax.md) lists them. To add a form back, name the rule of a real domain that needs it, and build it as below.

## Find what to change

Write the rule of the real domain that needs the form, and check its meaning in the CEL language definition: each rule that urn-forge accepts must give the same result in CEL.

## Add a function or a method

1. In `src/cel/functions.ts`, add each overload of the name to `FUNCTIONS`: the types that it takes, the type that it gives, and the helper that runs it. A name with a dot, such as `math.greatest`, is a function of a namespace: add the namespace to `NAMESPACES` in `src/cel/parse.ts` if it is new. The parser, the type checker and the code generator read the table.
2. In `src/generate/runtime.ts`, add the helper. Start its name with `$`. A generated file holds only the helpers that its rules use, and the helpers that they call, so the helper can call other helpers. It must import nothing.
3. If CEL gives an error for a value, such as `substring()` out of the string, throw a `RuleError`. `$holds` then counts the rule as broken.
4. Count a position in a string in characters, not in the units of a JavaScript string: `[...text]`.

## Add another form

A macro, an operator, a kind of literal or a special form such as `cel.bind` touches each part:

1. `src/cel/parse.ts`: the lexer or the parser, and the comment at the top of the file.
2. `src/cel/print.ts`: the canonical text. `diff` compares two rules by this text, so the text must parse to the same tree.
3. `src/cel/check.ts`: the type, and `rule-type` for each type that CEL refuses.
4. `src/generate/emit-cel.ts`: the TypeScript. Use the types of the checker where CEL and JavaScript differ.
5. `src/generate/postgres.ts`: see the next section.

## SQL

Translate a form in `toSql` only if Postgres gives the same result as CEL for each value. If not, throw `Untranslatable`: the schema names the rule in a comment, and the harness checks it.

Add each translated form to "the SQL of each form" in `tests/rule-forms.test.ts`, with the values at the edges where SQL and CEL can differ. The test runs the schema on PGlite and compares each row with the generated check. Examples of edges that were found: Postgres casts `' 12'` to a number, orders `NaN` above each number, rounds a double half to even, and reads an offset such as `'+02:00'` with the other sign.

## Test and finish

1. In `tests/cel.test.ts`, add the form to the table of "parse and print", with its canonical text. In `tests/rule-forms.test.ts`, add a value that keeps the rule, a value that breaks it, and a wrong type.
2. A change to `runtime.ts` changes each generated file. Compile each domain again, as [CONTRIBUTING.md](../CONTRIBUTING.md) tells in "Compile the generated files again".
3. Run `npm run check` from the root folder. Run the tests again with `TZ=Pacific/Chatham LC_ALL=tr_TR.UTF-8` if the form reads a time or compares text.
4. Add the form to [The rule syntax](../docs/reference/syntax.md) and to the package's `AGENTS.md`. A test fails if a function of the table is not in `AGENTS.md`.

## Related pages

- [How urn-forge is built](./architecture.md)
- [Add a standard rule](./add-a-standard-rule.md)
- [The rule syntax](../docs/reference/syntax.md)
