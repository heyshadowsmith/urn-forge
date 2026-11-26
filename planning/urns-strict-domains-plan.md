# urn-forge plan: URNs, always strict, and several domains

Nov 26, 2026 · @Shadow Smith

Three changes, planned together because they touch the same places: the config, the CLI output, the failures and the docs.

1. **URNs come back, as identity.** Each part of a contract has a URN, `urn:<namespace>:<domain>:<kind>:<name>`, built from the header. You still write short names in the manifest and the scenarios. The URN names a part wherever it is seen outside its own manifest.
2. **Always strict.** The `coverage` option goes. A gap in the scenarios is always an error.
3. **Several domains in one repository.** One config lists the domains. Each command handles all of them in one run. The domains are independent: they do not share or refer to each other's definitions.

## What changes for a user

```ts
// urn-forge.config.ts
export default defineConfig({
  tsconfig: 'tsconfig.json',
  shell: ['src/shell'],
  domains: [
    { manifest: 'billing/domain.manifest.yaml', out: 'billing/generated', core: 'billing/core.ts', features: 'billing/features' },
    { manifest: 'shipping/domain.manifest.yaml', out: 'shipping/generated', core: 'shipping/core.ts', features: 'shipping/features' },
  ],
});
```

```console
$ npx urn-forge verify
urn:acme:billing
gate 1  completeness  PASS  …
…
urn:acme:shipping
gate 1  completeness  PASS  …
…
verify passed (2 domains, gates 1, 2, 3, 4)
```

```console
$ npx urn-forge diff old.manifest.yaml domain.manifest.yaml
breaking    urn:acme:shipping:definition:weight_grams  maximum is now 20000, not 30000: it accepts less
```

```ts
runOperation(core, 'seat_booking', input);
// { ok: false, domain: 'urn:demo:booking', operation: 'seat_booking', kind: 'ContractViolation', failures: [...] }
```

## Decisions to confirm

### URNs

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | The form | **`urn:<namespace>:<domain>:<kind>:<name>`. The kinds are `definition`, `rule` and `operation`. The domain itself is `urn:<namespace>:<domain>`. A standard rule is `urn:urn-forge:standard:rule:<name>`** | The three kinds are the three sections of the manifest. An output is an object, so it is a definition |
| 2 | The namespace | **The namespace must be a valid URN namespace: lowercase letters, digits and hyphens, from 2 to 32 characters, starting with a letter (`^[a-z][a-z0-9-]{1,31}$`). The domain and the names keep their pattern. The standard set's namespace becomes `urn-forge`** | A URN namespace cannot have `_`. Today's namespaces are `demo`, `acme`, `corpus` and `urn_forge`: only the standard set's and `self/` change. A manifest with `_` in its namespace fails with `manifest-shape`, and its fix says what to write |
| 3 | Where a URN is seen | **Wherever a part is named outside its own manifest: the result of `runOperation` and `check` (`domain`), the generated `Definitions` and `Operations` (`urn` of each), the generated file's header and a new export `DOMAIN`, the places in the output of `diff` and gate 5, the `domain` of each problem and gate in `--format json`, and the comments of the Postgres schema** | The short names stay where a reader works inside one manifest: the manifest, the scenarios, the steps, and the messages of gates 1 to 4 |
| 4 | A failure | **The result gets `domain`. A failure keeps `{ definition, rule, path, message }` with short names** | All the failures of one call come from one domain, so one URN on the result is enough. A standard rule's name, such as `minimum`, is the same in each domain |

### Always strict

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 5 | The option | **Remove `coverage`. A config that sets it fails with `config-invalid`, and the message says that gaps are always errors** | An option that an agent can loosen is a gap that no gate sees |
| 6 | The codes | **`uncovered-operation`, `uncovered-output` and `uncovered-rule` are always errors. `deprecated-use` stays a warning** | A deprecation is a note to the reader, not a gap |
| 7 | The tutorial | **Part 3 shows the real failure of gate 3 after the refusal is added, and the agent adds the two scenarios. Part 4 becomes "Test the edges" only. The folder `3-strict-coverage` becomes `3-edges`** | There is no longer a step that makes the checks strict |
| 8 | Adoption | **The docs say plainly: an existing project must have a scenario for each operation, output and rule before `verify` passes the first time. "Add urn-forge to a project" suggests one operation first** | This is the cost of decision 5 |

### Several domains

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 9 | The config | **One shape. The paths of each domain go in `domains: [{ manifest, out, core, features, postgres? }]`. `tsconfig` and `shell` stay at the top, shared. With no `domains`, there is one domain at the default paths. The top-level `manifest`, `out`, `core`, `features` and `postgres` move into `domains`** | One way to write a config, also for one domain. The flags `--manifest`, `--out`, `--core` and `--features` still work when there is one domain, and fail with `usage` when there are more |
| 10 | Two domains that clash | **Two domains with the same URN, the same `out` or the same `features` fail with `config-invalid`** | Their generated files or their scenarios would mix |
| 11 | The commands | **`compile` and `verify` handle each domain in one run, in the order of the config. The text output starts each domain with its URN. The JSON output has `domains: [{ urn, gates }]`, and each problem has `domain`. The exit code is the worst of all the domains. `diff` is unchanged: it compares two manifests** | An agent runs one command and sees each domain |
| 12 | The gates | **Gates 1, 3, 4 and 5 run for each domain. Gate 2 checks the shell against each core: a shell file that calls any core without its harness fails** | The shell is shared, so it can call any domain |
| 13 | The scenarios | **Each domain has its own `features` folder and its own Cucumber profile. `registerSteps` is unchanged** | The steps use short names, so two domains in one run of Cucumber could clash. One profile for each domain keeps the scenarios short |
| 14 | `init` | **Unchanged: it writes one domain, with a config of `defineConfig({})`. The docs show how to add a second domain to the config** | A second domain is a later step for a project |

## Scope

- **In scope:** decisions 1 to 14; each domain, contract, tutorial and fixture of the repository; the starter; the skill and both `AGENTS.md` files; the docs.
- **Out of scope:**
  - domains that refer to each other (relation B);
  - URNs in the manifest or the scenarios;
  - a flag to run one domain of several.

## The target, written first

Step 0 adds tests that fail for the reason expected:

- `runOperation` gives `domain: 'urn:demo:booking'`, and `Definitions` has the `urn` of each definition;
- `diff` names the place of each change by URN;
- a namespace with `_` fails with `manifest-shape`;
- a config with `coverage` fails with `config-invalid`, and a missing scenario fails gate 3 with no config at all;
- a config with two domains compiles and verifies both, and a missing scenario in the second fails `verify` with the second domain's URN;
- two domains with the same `out` fail with `config-invalid`.

## Build order

| Step | Commit | Done when |
| --- | --- | --- |
| 0 | The target | Its tests fail for the reason expected |
| 1 | Always strict: `coverage` goes, gaps are errors | Each domain verifies; the tutorial's snapshots and the starter pass |
| 2 | The namespace pattern, and `urn-forge` for the standard set and `self/` | Each manifest compiles |
| 3 | URNs in the generated code, the results, `diff`, gate 5, the JSON and the Postgres comments | The URN tests pass; each committed generated file is current |
| 4 | `domains` in the config; the commands and the gates for each domain | The multi-domain tests pass on a fixture with two domains |
| 5 | Each config of the repository in the new shape; the skill, both `AGENTS.md` files and the JSON Schema of the config, if any | CI passes |
| 6 | The docs: the tutorial (parts 3 and 4), the CLI reference, the set-up and CI guides, and a section "Several domains" | Each output is real; the docs build |

## Sabotages at the end

Each must turn CI red:

1. Put `coverage: 'warn'` in a config → `config-invalid`.
2. Remove a scenario of the second domain of the fixture → gate 3 of that domain.
3. Give two domains the same `out` → `config-invalid`.
4. Generate a result with no `domain` → the URN test.

## Risks

- **A breaking change to each config.** The paths of a domain move into `domains`. urn-forge is 0.x, and each config in the repository changes in step 5. The error for an old config names the option and where it moved.
- **A breaking change to namespaces with `_`.** Only `urn_forge` uses one in this repository. A user's manifest gets one clear error.
- **Longer output.** A URN is longer than a short name. It appears only where a part is seen from outside its manifest, and the messages of gates 1 to 4 keep short names.
- **Strict from the first run.** Adoption is harder. The docs say how to start with one operation.
