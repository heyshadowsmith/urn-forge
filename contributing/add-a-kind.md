# Add a kind

This guide is for contributors who change urn-forge itself. A kind is a type of atom: `field`, `entity`, `invariant`, `operation`, `event` or `error`. Each kind is one descriptor module in `src/kinds/`. The descriptor gives the schema of an entry, its references and its IR node. The reference pass (pass 4) needs no new code: it reads the reference slots of each descriptor.

The real example is the `error` kind. The [error kind plan](../planning/error-kind-plan.md) added it in six steps. Step 1 (commit `fcfa0f3`, "Add the error kind to the compiler") is the part that this guide covers in full. The later steps made each plugin, the steps and gate 3 handle it.

The second real example is the `invariant` kind, from the [invariants plan](../planning/invariants-plan.md). Its step 2 (commit `195b88d`, "Invariants step 2: the invariant kind in the compiler") shows a kind that reads the nodes of other kinds.

The third real example is the `event` kind, from the [events plan](../planning/events-plan.md). Its commit `c5ec094` ("Events steps 0 and 1: the target, and the event kind") added the kind, a reference slot on `operation` and a reference slot on `error`.

## Before you start

- You have a clone of urn-forge, and `npm ci` ran in the root folder.
- `npm test` and `npm run typecheck` pass.
- You read `src/kinds/README.md` and [The manifest](../docs/reference/manifest.md).
- You know the properties of the new entry, and which kinds each reference may name.

Commands run from `packages/urn-forge`, except where a step says the root folder.

## Add the name

1. Add the name to `KindName` in `src/kinds/types.ts`.
2. Run `npm run typecheck` from the root folder. `tsc` fails until the registry has a descriptor for the name.

   For example, with `'widget'` added to `KindName`, the first error in `src/kinds/index.ts` is this:

   ```
   src/kinds/index.ts(18,85): error TS1360: Type '{ readonly field: KindDescriptor<"field", FieldDecl, IRField, "fields">; readonly entity: KindDescriptor<"entity", { description: string; key?: string | undefined; fields: { ...; }[]; }, IREntity, "entities">; readonly invariant: KindDescriptor<...>; readonly operation: KindDescriptor<...>; readonly event: KindDescr...' does not satisfy the expected type '{ readonly error: KindDescriptor<"error", any, unknown, string>; readonly field: KindDescriptor<"field", any, unknown, string>; readonly entity: KindDescriptor<"entity", any, unknown, string>; readonly invariant: KindDescriptor<...>; readonly operation: KindDescriptor<...>; readonly event: KindDescriptor<...>; reado...'.
   ```

   The error says that `KINDS` has no `widget`. The other errors of the run come from it.

`widget` is only an example. urn-forge has each kind of the specification at this time. Refer to [Scope](../docs/explanation/the-contract.md).

## Write the descriptor

1. Make the file `src/kinds/<name>.ts`.
2. Export a descriptor made with `defineKind<Decl, Node>()`. It has six necessary members and one optional member, `after`:

   | Member | What it gives | Used by |
   | --- | --- | --- |
   | `name` | The kind segment of a short key and a URN | Pass 2 |
   | `group` | The key that holds the nodes of the kind in `UniversalIR` | The IR builder, the plugins |
   | `article` | `a` or `an`, for messages such as "must name an error" | Pass 4 messages |
   | `schema` | A Valibot schema for one entry | Pass 1 |
   | `references` | Each place in the entry that names an atom, and the kinds that it may name | Pass 4 |
   | `after` | Optional. The kinds whose nodes `build` reads. The IR builder builds them first | The IR builder |
   | `build` | The IR node, made from the entry and its resolved references | The IR builder |

3. Declare each reference as a slot. A slot is a path in the entry, with `'*'` for each index of a list, and the kinds that it may name. Pass 4 reports `unresolved-ref` and `wrong-ref-kind` at the position of the reference.
4. In `build`, get each resolved reference with `ref(path)`. Return `undefined` if a reference that the node needs did not resolve.
5. In `build`, report the problems that belong to one entry with `report`, for example a duplicate property. Each problem needs a code from `DIAGNOSTIC_CODES` in `src/diagnostics.ts`.

This is the descriptor of `error`. It shares the `fields` slot and its checks with `entity` through `src/kinds/field-refs.ts`:

<<< @/../packages/urn-forge/src/kinds/error.ts

The `error` kind also added a slot to `operation`, so that `errors` can name only errors:

```ts
{ path: ['errors', '*'], targets: ['error'] },
```

In the same way, the `event` kind added `{ path: ['emits', '*'], targets: ['event'] }` to `operation`, and `{ path: ['recordAs'], targets: ['event'] }` to `error`.

### Read the nodes of other kinds

`ref(path)` gives only the atom that a reference names. If `build` needs the IR node of that atom, do these steps:

1. Set `after` to the kinds whose nodes `build` reads. The IR builder builds each atom of a kind without `after` first.
2. In `build`, get a node with `node(kind, urn)`. It returns `undefined` if that node did not build.

The `invariant` kind uses both. It reads the entity that `on` names and the fields of that entity, and then types the rule against them (pass 6):

<<< @/../packages/urn-forge/src/kinds/invariant.ts{29,38,42}

## Add it to the registry and the IR

1. Import the descriptor in `src/kinds/index.ts` and add it to `KINDS`. The order of `KINDS` is the order in which messages list the kinds. For example, `event` is before `error`.
2. Run `npm run typecheck`. `tsc` fails until `UniversalIR` has a record for the group:

   ```
   src/kinds/index.ts(30,7): error TS2322: Type 'true' is not assignable to type 'false'.
   ```

   This line is the check that the groups of the registry are the same as the records of `UniversalIR`.

3. Add the node type and the record to `src/ir/types.ts`. The `error` kind added `IRError` and this record:

   ```ts
   readonly errors: Readonly<Record<Urn, IRError>>;
   ```

4. Run `npm run typecheck` again until it passes. `ValidManifest` comes from the registry, so it needs no change.

## Decide what each plugin does

A plugin declares the kinds that it handles in `supports.kinds`. Until a plugin declares the new kind, a manifest that uses the kind fails at each atom of that kind. Here the `valibot` and `fcis` plugins do not declare `event`, and the insurance manifest has three events:

```
insurance/domain.manifest.yaml:143:1  error  unsupported-construct  urn:acme:insurance:policy:event:policy_cancelled: the valibot plugin does not handle kind "event"
insurance/domain.manifest.yaml:136:1  error  unsupported-construct  urn:acme:insurance:policy:event:policy_issued: the valibot plugin does not handle kind "event"
insurance/domain.manifest.yaml:148:1  error  unsupported-construct  urn:acme:insurance:policy:event:refund_refused: the valibot plugin does not handle kind "event"
insurance/domain.manifest.yaml:143:1  error  unsupported-construct  urn:acme:insurance:policy:event:policy_cancelled: the fcis plugin does not handle kind "event"
insurance/domain.manifest.yaml:136:1  error  unsupported-construct  urn:acme:insurance:policy:event:policy_issued: the fcis plugin does not handle kind "event"
insurance/domain.manifest.yaml:148:1  error  unsupported-construct  urn:acme:insurance:policy:event:refund_refused: the fcis plugin does not handle kind "event"
```

This is correct. The compiler knows the kind, and no plugin makes code for it yet.

1. For each plugin in `src/plugins/`, decide what it makes for the kind. To handle a kind can mean to make nothing, on purpose.
2. Add the kind to `supports.kinds` of the plugin, and make its output.
3. Do one plugin at a time. The `error` kind did Valibot in step 2 and FCIS in step 3. Until FCIS declared `error`, the `errors-valibot` fixture ran the Valibot plugin alone. Refer to [Add a test fixture](./add-a-fixture.md).

If the kind changes what a handler returns or what a scenario can expect, the generated runtime, the steps and gate 3 change too. Plan these as their own steps, as the [error kind plan](../planning/error-kind-plan.md) did.

## Update the tests and self/

1. Update `tests/kinds.test.ts`. It lists each kind with its group and its reference slots.
2. Add the new kind to the `values` list of `naming.field.kind` in `self/domain.manifest.yaml`. This field is an `enum`. A test keeps its list equal to `KIND_NAMES`.
3. Add entries with problems to the `invalid-structure` and `broken-references` fixtures, for each new code. If the kind has many new codes, make a fixture of its own. The `invariant` kind added `invalid-rules`.
4. Add a producer for each new code to `PRODUCERS` in `tests/every-code.test.ts`. `tsc` and the test fail until each code in `DIAGNOSTIC_CODES` has one.
5. Write the expected files again, then run the harness a second time:

   ```bash
   npx vitest run tests/fixtures.test.ts -u
   npx vitest run tests/fixtures.test.ts
   ```

## Compile the committed domains again

The fingerprint includes the kind names. Thus a new kind changes the fingerprint line of every generated file. The manifest hash does not change, because it leaves out an empty kind group.

1. Compile each domain:

   ```bash
   npm run compile:example
   npm run compile:self
   npm run compile:insurance
   npx urn-forge compile --config tutorial/1-first-domain/urn-forge.config.ts
   npx urn-forge compile --config tutorial/2-declared-errors/urn-forge.config.ts
   npx urn-forge compile --config tutorial/3-strict-coverage/urn-forge.config.ts
   ```

2. Commit the generated files with the change.

## Document the kind

1. Add the kind, its properties and its references to [The manifest](../docs/reference/manifest.md).
2. Add each new code to `DIAGNOSTIC_CODES` and to [Diagnostics](../docs/reference/diagnostics.md). A test in `tests/diagnostics.test.ts` fails until the page lists each code.
3. Update [Scope](../docs/explanation/the-contract.md).

## Result

`npm test`, `npm run typecheck`, `npm run verify:example`, `npm run verify:self`, `npm run verify:insurance` and `npm run verify:tutorial` pass. A manifest entry of the new kind compiles, or fails with `unsupported-construct` for each plugin that does not declare it yet.

## Related pages

- [Add a plugin](./add-a-plugin.md)
- [Add a test fixture](./add-a-fixture.md)
- [The manifest](../docs/reference/manifest.md)
- [Compiler passes](compiler-passes.md)
- [How urn-forge is built](./architecture.md)
