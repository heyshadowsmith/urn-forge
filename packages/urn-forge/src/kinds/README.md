# Kinds

One module per kind of atom. Each exports a descriptor made with `defineKind<Decl, Node>()`:

| Property | Used by |
| --- | --- |
| `name` | The kind segment of a short key and a URN |
| `group` | The key that holds this kind's entries in the validated manifest and its nodes in `UniversalIR` |
| `article` | Messages such as "must name an entity" |
| `schema` | Pass 1. Validates one entry of this kind |
| `references` | Pass 4. Each slot is a path in the entry (`'*'` for every list index) and the kinds it may name. The IR builder resolves every slot generically and reports `unresolved-ref` and `wrong-ref-kind` at the reference's position |
| `build` | Builds the IR node from the entry and its resolved references (`ref(path)`), and reports problems that belong to one kind, such as an entity's duplicate properties or a field's incoherent constraints (pass 7) |

## Adding a kind

1. Add its name to `KindName` in `types.ts`. `tsc` then fails until the registry in `index.ts` has a descriptor for it, and, if the spec named it, until it leaves `NOT_YET_SUPPORTED_KINDS`.
2. Write `src/kinds/<name>.ts`, declaring every reference the kind makes in `references`, and add it to `KINDS`.
3. Add its group to `UniversalIR`. `tsc` fails until the registry's groups and the IR's records match. `ValidManifest` is derived from the registry, so it needs no change.
4. Decide what each plugin does with it, and document the kind in `docs/guide/manifest.md`.

Pass 4 needs no new code for a new kind: its reference slots are enough.
