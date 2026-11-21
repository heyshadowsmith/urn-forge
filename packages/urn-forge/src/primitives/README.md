# Primitives

One module per primitive. Each exports a descriptor made with `definePrimitive`:

| Property | Used by |
| --- | --- |
| `name` | The `primitive:` value in the manifest; `FieldInfo.primitive` in the generated runtime |
| `constraints` | The meta-schema (pass 1). Each entry's `schema` validates the constraint's value. Key order is the order plugins emit constraints in |
| `coherence` | Pass 7. Returns the combinations of constraints that admit no value |
| `parseCell` | The Gherkin step library and gate 3, to turn a table cell into a value (`""` is the empty string for `string`) |
| `boundaries` | Gate 3's boundary coverage: the cases a field's examples must include, each with a label and a `covers(value)` test |

## Adding a primitive

1. Write `src/primitives/<name>.ts` and add it to `PRIMITIVES` in `index.ts`.
2. Run `npm run typecheck`. Each plugin that does not handle the new primitive fails at its translation table (today: `TRANSLATIONS` in `src/plugins/valibot.plugin.ts`). Add an entry there.
3. Add a fixture that uses the primitive under `tests/fixtures/` (see `tests/fixtures.test.ts`), and document the primitive in `docs/reference/primitives.md` and `docs/reference/manifest.md`.

Adding a constraint to an existing primitive works the same way: add it to the descriptor's `constraints`, then follow `tsc` to each translation table.

Keep descriptors free of plugin details. A property belongs here only when a part of urn-forge that is not a plugin needs it.

The how-to guides `docs/how-to/add-a-primitive.md` and `docs/how-to/add-a-constraint.md` give the full procedure.
