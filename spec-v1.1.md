# urn-forge Project Specification v1.1

Nov 19, 2026 · @Shadow Smith

## Changes from v1.0

v1.1 makes the build deterministic, adds invariants and a failure model, moves optionality onto entities, and pulls the URN-to-test traceability path into the first vertical slice.

| Area | v1.0 | v1.1 | Why |
| --- | --- | --- | --- |
| Audience | Unstated | The author's own projects; no public release commitment | Sets the bar for polish, scope and defaults |
| Determinism | `compiledAt` in IR; sunset checked against wall clock | No wall-clock data in output; sunsets checked against `referenceDate` | Same commit must produce the same bytes and the same verdict |
| Drift gate | Two inconsistent mechanisms (git diff vs. manifest hash) | Regenerate-and-diff is the gate; header fingerprint covers manifest + generator + config | A manifest hash alone misses hand edits and generator upgrades |
| Optionality | `required` on the field | `required` / `nullable` on each entity field reference | The same field can be required in one entity and optional in another |
| Invariants | Mentioned, never specified | First-class `invariant` kind, single-entity, small expression language | Cross-field rules (`start < end`) were not expressible |
| Failure model | Handlers return output only | New `error` kind; operations declare `errors`; handlers return `Result<Out, Err>` | Domain rejections had no path except throwing, and are not events |
| Events | Valid URN kind, no IR node | `IREvent`; operations declare `emits`; events are success facts only | The kind existed with nothing behind it |
| Handlers | "Configurable for async" | Synchronous only | All I/O stays in the shell |
| Primitives | 5 primitives; money as JS `number` | Adds `decimal` (as string), `list`, `ref`; `timestamp` fixed to ISO-8601 string | Float money and missing collections block real domains |
| URN versioning | None | Compatibility classes + `urn-forge diff`; `stability: experimental` softens breaks | Tightening a constraint silently broke consumers |
| Proof 1 | Custom AST scan for missing handlers and `as unknown as` | `satisfies` against generated interface + enforced lint profile | `tsc` already proves completeness; the AST scan was easy to bypass |
| Gherkin coverage | One value at or beyond a bound | min−1 / min / max / max+1, plus `oneOf`, `format` and error coverage; warn-then-ratchet adoption | One sample does not exercise a boundary; existing suites need a ramp |
| DDL plugin | "SQL Migrations" | `CREATE` DDL only, in M4; migrations out of scope | Migration diffing is a separate product |
| Claims | "Mathematically guaranteed", "proof" | "Gate", "check", with stated limits | The mechanisms show conformance, not correctness |
| Roadmap | Gherkin last | End-to-end vertical slice in Milestone 2 | Traceability is the differentiator; prove it early |
| Spec defects | Garbled `identifier` row; `inspect` vs `graph`; config unspecified | Fixed; config schema defined | Housekeeping |

## 1. Summary and principles

urn-forge compiles one URN manifest into types, runtime parsers, handler contracts, DDL and test scaffolding, then gates CI on every declared URN being implemented, tested and unchanged by hand.

Developers declare domain atoms once: fields, entities, invariants, operations and events. Each atom gets a stable URN. Every generated artifact and every acceptance test traces back to that URN. That traceability, from declaration to handler to scenario, is the product. Schema-to-type codegen is table stakes.

**Audience.** v1 serves the author's own projects. Defaults favor simplicity over configurability, and there is no commitment to a public release. Existing Cucumber suites must be able to adopt the gates gradually.

**Design principles**

1. **One source of truth.** The manifest is authoritative. Generated files are build outputs that happen to be committed.
2. **Deterministic.** The same manifest, config and generator version produce byte-identical output and the same verdict, on any machine, on any date.
3. **Parse at the edge, trust in the core.** Untrusted data is parsed and branded once, in the shell. Core handlers receive only branded values.
4. **Fail with a URN.** Every error, warning and rejected payload names the URN it concerns.
5. **Lean on existing tools.** Use `tsc`, typescript-eslint and `@cucumber/gherkin` where they already do the job; write custom checks only for what they cannot see.

**What the gates do and do not show**

The gates show *conformance*: every operation has a handler with the generated signature, every boundary crossing is parsed, every bounded field has boundary scenarios, and no generated file was edited by hand. They do not show that handler logic is *correct*. That remains the job of the tests the gates require to exist.

**Non-goals for v1**

- Database migrations or schema diffing against a live database.
- Runtimes other than Node.js / TypeScript.
- Authorization, transport (HTTP, queues) or persistence adapters.
- Async core handlers. All I/O stays in the shell.
- Cross-manifest imports and multi-file manifests. One domain, one YAML file.
- Authoring front ends other than YAML (no TypeScript DSL, no visual editor).
- A public release or third-party support.

## 2. System topology

The manifest is parsed once into a canonical IR; plugins and gates read only that IR, never the raw YAML.

&#91;embedded content: compile and verify pipeline · 3 stages, 4 plugins, 5 gates\]

Solid boxes are urn-forge; dashed boxes are code your team writes. `verify` reads all three inputs and fails the build if any gate fails.

## 3. URN grammar and versioning

Every atom has exactly one URN of six segments, and a URN, once published, never changes meaning.

```
urn:<namespace>:<domain>:<context>:<kind>:<identifier>
```

| Segment | Rule | Example |
| --- | --- | --- |
| `namespace` | Organization or system root | `acme` |
| `domain` | Bounded context or business vertical | `insurance` |
| `context` | Aggregate or sub-domain | `policy` |
| `kind` | `field` \| `entity` \| `invariant` \| `operation` \| `event` \| `error` | `field` |
| `identifier` | Unique within its context and kind | `deductible_amount` |

Every non-kind segment matches `^[a-z][a-z0-9_]{0,62}$`: lowercase snake\_case, starting with a letter, at most 63 characters. The full URN is matched case-sensitively.

**Manifest scope.** A manifest is one YAML file that declares one `namespace` and one `domain`, set once in its header. Entries are written with a short key (`policy.field.deductible_amount`) and the compiler expands them to full URNs. A manifest cannot reference another manifest in v1.

**Brand identifiers.** `brandIdentifier` is the PascalCase of `context` + `identifier` (`PolicyDeductibleAmount`). A collision within a manifest is a compile error, not a silent suffix.

### Compatibility classes

A change to an existing URN is classified by `urn-forge diff <old> <new>`:

| Class | Examples | Allowed on an existing URN? |
| --- | --- | --- |
| Compatible | Description edits; widening a constraint (raising `maxLength`, lowering `min`); adding an optional field ref; adding a declared error | Yes |
| Breaking | Tightening a constraint; changing a primitive; making an optional ref required; removing a field ref, error or operation | No: declare a new URN and deprecate the old one |
| Lifecycle | `active` → `deprecated` → `sunset` | Yes, forward only |

The CI gate runs `urn-forge diff` against the manifest at the merge base and fails on any breaking change to a URN whose status is `active` or `deprecated`.

**Experimental stability.** A manifest header may set `stability: experimental`. While it is set, breaking changes are reported as warnings, not failures. Removing the flag is itself a one-way, compatible change: from then on, Gate 5 is strict.

### Lifecycle metadata

```yaml
status: deprecated           # active | deprecated | sunset
supersededBy: urn:acme:insurance:policy:field:collision_deductible
sunsetDate: 2027-01-01       # compared against referenceDate, never the clock
```

Referencing a `deprecated` URN is a warning. Referencing a URN whose `sunsetDate <= referenceDate`, or whose status is `sunset`, is an error. Section 6 defines `referenceDate`.

## 4. Manifest model

A manifest declares six kinds of atom: fields carry constraints, entities carry optionality, invariants carry cross-field rules, operations carry their contracts, events record what happened, and errors name what was refused.

### 4.1 Primitives and constraints

| Primitive | Constraints | TS type (branded) | SQL type |
| --- | --- | --- | --- |
| `string` | `minLength`, `maxLength`, `regex`, `format` (`uuid`, `email`, `iso-date`), `oneOf` | `string` | `VARCHAR(n)` / `UUID` / `TEXT` |
| `integer` | `min`, `max`, `notEqual` | `number` (safe integer) | `INTEGER` / `BIGINT` |
| `decimal` | `min`, `max`, `notEqual`, `precision: [p, s]` | `string` (canonical decimal) | `NUMERIC(p, s)` |
| `float` | `min`, `max`, `notEqual` | `number` | `DOUBLE PRECISION` |
| `boolean` | `mustBe` | `boolean` | `BOOLEAN` |
| `timestamp` | `after`, `before` (ISO-8601 literals) | `string` (ISO-8601, UTC, `Z` suffix) | `TIMESTAMPTZ` |
| `list` | `of` (a field or entity URN), `minItems`, `maxItems`, `unique` | `ReadonlyArray<T>` | `JSONB` or child table (plugin option) |
| `record` | `keyType` (`string` only), `valueType` (a field URN) | `Readonly<Record<string, V>>` | `JSONB` |
| `ref` | `to` (an entity URN) | branded ID of the target | Foreign key to target's key |

v1.0's `number` splits into `integer`, `decimal` and `float` so money is never a binary float. `decimal` values cross the boundary as strings; they stay strings inside the core, which converts them with any decimal library it likes when it does arithmetic.

Constraint literals are validated against their primitive at compile time: `min: "abc"` on an `integer` is a meta-schema error.

### 4.2 Entities

Optionality lives on the reference, not the field.

```yaml
policy.entity.policy:
  description: An issued insurance policy
  key: policy.field.policy_id          # required for DDL; must be required + non-null
  fields:
    - ref: policy.field.policy_id
      required: true
    - ref: policy.field.effective_date
      required: true
    - ref: policy.field.expiry_date
      required: true
    - ref: policy.field.deductible_amount
      required: false
      nullable: false                  # may be absent, may not be null
  invariants:
    - policy.invariant.term_is_positive
```

`required: false` means the key may be absent. `nullable: true` means the key may be present with `null`. Both default to `required: true`, `nullable: false`.

### 4.3 Invariants

An invariant is a named, URN-addressed boolean rule over one entity's fields.

```yaml
policy.invariant.term_is_positive:
  on: policy.entity.policy
  rule: expiry_date > effective_date
  message: Expiry must be after the effective date
```

The rule language is deliberately small: field names of the owning entity, literals, comparison (`< <= = != >= >`), `and`, `or`, `not`, `is present`, and `+ -` on `integer` and `decimal`. No function calls, no cross-entity references. Each plugin translates rules it supports (Valibot `v.check`, SQL `CHECK`) and must report any rule it cannot translate as a compile error, never skip it silently.

### 4.4 Operations

```yaml
policy.operation.cancel_policy:
  description: Cancel an active policy
  input: policy.entity.cancellation_request
  output: policy.entity.policy
  errors:
    - policy.error.already_cancelled
    - policy.error.cancellation_after_expiry
  emits:
    - policy.event.policy_cancelled
```

`errors` are the expected domain rejections, each an `error` URN (4.6). `emits` are the events produced on success (4.5). Handlers are synchronous; anything that needs I/O happens in the shell before or after the call. Unexpected failures (bugs, I/O faults) are not declared and are not part of the contract.

### 4.5 Events

An event is a named payload, declared like an entity, that records a fact which happened. Operations list events under `emits` and return them only on success. Events never describe a rejection, so anything that consumes an event stream can trust every item in it.

### 4.6 Errors

An error is a named, URN-addressed rejection: the operation was refused and nothing changed.

```yaml
policy.error.already_cancelled:
  description: The policy is already cancelled
  category: conflict          # validation | conflict | not_found | forbidden | precondition
  retryable: false
  message: Policy {policy_id} is already cancelled
  fields:
    - ref: policy.field.policy_id
  recordAs: policy.event.cancellation_rejected   # optional
```

- `fields` is an entity-shaped payload, optional; an error with no fields is valid.
- `message` is a template whose `{placeholders}` must name fields of the error. The compiler checks this.
- `category` and `retryable` are metadata for the shell, for example to map an error to an HTTP status. The core never reads them.
- `recordAs` names an event that the shell may record when this error is returned, for an audit trail. The event's fields must be a superset of the error's. The core never emits it; the event stays separate from the operation's `emits`.

The five categories are fixed for v1. `validation` covers domain rules the core checks, such as a coverage limit. Malformed input never reaches the core; the shell reports it as `InputRejected`.

## 5. Universal IR

The IR is an immutable, fully resolved, JSON-serializable graph; plugins read only the IR, never the raw manifest.

v1.0 used `Map`, which does not serialize. v1.1 uses plain objects keyed by full URN, with keys sorted, so `urn-forge inspect --json` and the fingerprint hash see the same canonical form.

```ts
export interface UniversalIR {
  readonly meta: {
    readonly namespace: string;
    readonly domain: string;
    readonly manifestVersion: string;   // author-set semver from the manifest header
    readonly stability: 'experimental' | 'stable';
    readonly manifestHash: string;      // SHA-256 of canonical manifest JSON
    readonly irSchemaVersion: 1;
  };
  readonly fields: Readonly<Record<Urn, IRField>>;
  readonly entities: Readonly<Record<Urn, IREntity>>;
  readonly invariants: Readonly<Record<Urn, IRInvariant>>;
  readonly operations: Readonly<Record<Urn, IROperation>>;
  readonly events: Readonly<Record<Urn, IREntity>>;   // events share the entity shape
  readonly errors: Readonly<Record<Urn, IRError>>;
}

export type Urn = string & { readonly __urn: unique symbol };

export interface Lifecycle {
  readonly status: 'active' | 'deprecated' | 'sunset';
  readonly supersededBy?: Urn;
  readonly sunsetDate?: string;        // YYYY-MM-DD
}

export interface IRField {
  readonly urn: Urn;
  readonly brandIdentifier: string;
  readonly primitive: 'string' | 'integer' | 'decimal' | 'float' | 'boolean'
                    | 'timestamp' | 'list' | 'record' | 'ref';
  readonly constraints: Readonly<Record<string, unknown>>;  // validated per primitive
  readonly description?: string;
  readonly lifecycle: Lifecycle;
}

export interface IRFieldRef {
  readonly field: Urn;
  readonly required: boolean;
  readonly nullable: boolean;
}

export interface IREntity {
  readonly urn: Urn;
  readonly brandIdentifier: string;
  readonly description: string;
  readonly key?: Urn;                  // required when the Postgres plugin is enabled
  readonly fields: readonly IRFieldRef[]; // declaration order preserved
  readonly invariants: readonly Urn[];
  readonly lifecycle: Lifecycle;
}

export interface IRInvariant {
  readonly urn: Urn;
  readonly on: Urn;
  readonly rule: RuleExpr;             // parsed AST, not the source string
  readonly message: string;
  readonly lifecycle: Lifecycle;
}

export interface IROperation {
  readonly urn: Urn;
  readonly brandIdentifier: string;
  readonly description: string;
  readonly input: Urn;                 // entity or field
  readonly output: Urn;                // entity or field
  readonly errors: readonly Urn[];     // error kind
  readonly emits: readonly Urn[];      // event kind
  readonly lifecycle: Lifecycle;
}

export interface IRError {
  readonly urn: Urn;
  readonly brandIdentifier: string;
  readonly description: string;
  readonly category: 'validation' | 'conflict' | 'not_found' | 'forbidden' | 'precondition';
  readonly retryable: boolean;
  readonly message: MessageTemplate;   // parsed; placeholders resolved to field refs
  readonly fields: readonly IRFieldRef[];
  readonly recordAs?: Urn;             // event kind
  readonly lifecycle: Lifecycle;
}
```

### Compilation passes

Passes run in this order. Every diagnostic carries the URN, the manifest file, line and column.

1. **Meta-schema.** Valibot validates manifest structure, URN grammar and constraint types per primitive.
2. **Expansion.** Short keys become full URNs.
3. **Uniqueness.** No two atoms share a URN; no two share a `brandIdentifier`.
4. **Referential integrity.** Every `ref`, `of`, `to`, `key`, `input`, `output`, `errors`, `emits`, `recordAs`, `on` and `supersededBy` resolves to an atom of the right kind.
5. **Cycle check.** Entity containment through `list` and embedded entities must be acyclic. `ref` edges may form cycles, since they compile to foreign keys, not nesting.
6. **Rule and template typing.** Each invariant rule parses, names only fields of its `on` entity, and type-checks (no `timestamp + integer`). Each error `message` placeholder names a field of that error, and each `recordAs` event's fields are a superset of the error's.
7. **Constraint coherence.** `min <= max`, `minLength <= maxLength`, `oneOf` non-empty, `precision` scale <= precision.
8. **Lifecycle.** Warn on references to `deprecated` atoms; error on references to `sunset` atoms or atoms past `sunsetDate` per `referenceDate`.

## 6. Determinism contract

Given the same manifest, config and urn-forge version, `compile` emits byte-identical files and `verify` returns the same verdict, regardless of machine, locale, time zone or date.

**Rules for the compiler and every plugin**

- No wall-clock reads. `compiledAt` is removed from the IR and from file headers.
- No randomness, no environment-dependent paths, no `process.env` reads inside plugins.
- Output is sorted: object keys, URN lists and emitted declarations follow a defined order (manifest order for entity fields, URN order everywhere else).
- Line endings are `\n`; files end with one newline; encoding is UTF-8 without BOM.
- Plugins are pure functions of `(ir, pluginConfig)`. The engine, not the plugin, writes files.

**Reference date.** Sunset checks compare against `referenceDate`, resolved in this order:

1. `--reference-date YYYY-MM-DD` on the command line.
2. `referenceDate` in `urn-forge.config.ts`.
3. Neither set: sunset checks run as warnings only, and `verify` prints that strict sunset enforcement is off.

CI pins the date explicitly, for example to the commit date, so a build result can be reproduced later.

**Generated file header.** Every generated file starts with:

```ts
// @generated by urn-forge 1.1.0 — do not edit
// fingerprint: sha256:<hex>
```

The fingerprint is SHA-256 over the canonical IR JSON, the resolved config, the urn-forge version and the enabled plugin names and versions. A changed generator or config therefore changes the fingerprint, even when the manifest has not changed.

## 7. Codegen plugins

Four plugins ship in v1; each is a pure function from IR to files, and each must handle every IR construct or fail compilation naming the construct it cannot handle.

```ts
export interface GeneratedArtifact {
  readonly relativePath: string;       // POSIX, relative to --out
  readonly content: string;
}

export interface PluginDiagnostic {
  readonly severity: 'error' | 'warning';
  readonly urn?: Urn;
  readonly message: string;
}

export interface CodegenPlugin<C = unknown> {
  readonly name: string;
  readonly version: string;            // feeds the fingerprint
  readonly configSchema: v.GenericSchema<C>;
  emit(ir: UniversalIR, config: C): {
    readonly artifacts: readonly GeneratedArtifact[];
    readonly diagnostics: readonly PluginDiagnostic[];
  };
}
```

Plugins run in config order. They do not see each other's output; shared naming comes from the IR (`brandIdentifier`), so the Valibot and FCIS plugins agree on type names without coupling.

### 7.1 Valibot plugin → `domain.schemas.generated.ts`

- One `v.pipe()` schema per field, translating constraints (`v.minLength`, `v.maxValue`, `v.notValue`, `v.regex`, `v.uuid`, `v.email`, `v.isoDate`, `v.picklist` for `oneOf`) and ending in `v.brand('<full URN>')`.
- `decimal` is a string schema with a canonical-decimal regex plus `v.check` for range and precision. Values stay strings all the way into the core.
- One `v.object()` per entity, event and error. `required: false` wraps the field in `v.optional`; `nullable: true` in `v.nullable`. Error schemas add a literal `kind` discriminant set to the error URN.
- Invariants attach to the entity schema with `v.check` + `v.forward`, so an issue points at a field path and carries the invariant URN.
- Exports `v.InferInput` and `v.InferOutput` types under each `brandIdentifier`.

### 7.2 FCIS plugin → `domain.runtime.generated.ts`

**Result type.** Handlers return a discriminated union, never throw for declared errors:

```ts
export type Result<T, E> =
  | { readonly ok: true;  readonly value: T; readonly events: readonly EmittedEvent[] }
  | { readonly ok: false; readonly error: E };
```

**Handler contracts.** For each operation:

```ts
export type CancelPolicyHandler = (
  input: PolicyCancellationRequest,
) => Result<PolicyPolicy, PolicyAlreadyCancelled | PolicyCancellationAfterExpiry>;
```

Handlers are always synchronous. `EmittedEvent` is a union of the operation's `emits`. Each error type carries `kind: '<error URN>'`, so handlers and callers can switch on it exhaustively.

**Registry.** `DomainCoreImplementation` maps each operation URN to its handler type. Applications declare `export const core = { … } satisfies DomainCoreImplementation;` and `tsc` rejects missing or mistyped handlers.

**Shell gatekeeper.** `executeOperation(urn, rawPayload, core)`:

1. Looks up the URN in the generated `DispatchMap`; unknown URN → `UnknownOperation` issue.
2. Runs `v.safeParse` on the input schema; failure → `InputRejected` with Valibot issues tagged by field URN.
3. Calls the handler with the branded input.
4. On `ok: false`, parses the error against the operation's declared error schemas; an undeclared error → `ContractViolation`. A valid error is returned with its `category`, `retryable` flag and rendered `message`, plus its `recordAs` event when one is declared.
5. On `ok: true`, parses output and each emitted event; failure → `ContractViolation`.

A `ContractViolation` is a bug in the core, not a user error, and is reported separately so callers can map it to a 500-class failure.

### 7.3 Gherkin plugin → `domain.cucumber.generated.ts`, `urn-forge.lint.json`

- `defineParameterType` per field, named by `brandIdentifier`, parsing step arguments through the field's Valibot schema.
- `urn-forge.lint.json`: every live URN, entity field keys, and for each field the required boundary values (section 8, Gate 3). Consumed by `urn-forge verify`, and stable enough for third-party linters.

### 7.4 Postgres plugin → `schema.generated.sql` (optional)

- `CREATE TABLE` per entity with a `key`; entities without one are a compile error when this plugin is enabled.
- Column types per section 4.1; `required` + `nullable` map to `NOT NULL`; `ref` maps to a foreign key.
- Field constraints and translatable invariants become named `CHECK` constraints (`ck_<brandIdentifier>`).
- Emits create statements only. Migrations are out of scope; teams feed this file to their migration tool of choice.

### 7.5 Config

```ts
// urn-forge.config.ts
import { defineConfig } from 'urn-forge';
export default defineConfig({
  manifest: './domain.manifest.yaml',
  out: './src/generated',
  referenceDate: '2026-11-19',
  plugins: [
    ['valibot', {}],
    ['fcis', {}],
    ['gherkin', { boundaryCoverage: 'warn' }],   // 'warn' | 'error'
    ['postgres', { listStorage: 'jsonb' }],
  ],
});
```

The config is validated by a Valibot schema composed from each plugin's `configSchema`.

## 8. Verification gates (`urn-forge verify`)

`verify` runs five gates and exits non-zero if any fails; each gate reuses an existing tool where one does the job.

| Gate | Checks | Mechanism | Custom code? |
| --- | --- | --- | --- |
| 1. Implementation completeness | Every operation has a handler of the generated type | `tsc --noEmit` over the core entry, which must use `satisfies DomainCoreImplementation`; `verify` confirms the `satisfies` clause is present | Small: one AST lookup |
| 2. Boundary discipline | No branded value forged outside generated parsers | Shipped ESLint profile (below) over core and shell sources | Config only |
| 3. Gherkin traceability | Tags, tables and boundary coverage match the IR | `@cucumber/gherkin` AST + `urn-forge.lint.json`; coverage warns until ratcheted | Yes: the main custom gate |
| 4. Drift | Generated files equal a fresh compile | Compile to a temp dir, byte-compare against committed `*.generated.*`; also flag committed generated files with no source | Small |
| 5. Compatibility | No breaking change to a live URN | `urn-forge diff` against the merge-base manifest (section 3); warnings only while `stability: experimental` | Yes |

### Gate 2 lint profile

`urn-forge/eslint-config` enables, for files under the configured core and shell paths:

- `@typescript-eslint/no-explicit-any`, `no-unsafe-assignment`, `no-unsafe-return`, `no-unsafe-argument`.
- `@typescript-eslint/consistent-type-assertions` set to `assertionStyle: 'never'`.
- `@typescript-eslint/ban-ts-comment` for `ts-ignore`, `ts-nocheck` and `ts-expect-error`.
- A small custom rule, `urn-forge/no-brand-construction`, that flags any import of Valibot's `brand` or of generated schemas from inside the core directory, so the core cannot mint its own branded values.

This replaces v1.0's AST scan for `as unknown as`. It catches more patterns, and teams can see and audit the rules.

### Gate 3 Gherkin traceability

For every `.feature` file under `--features`:

1. **Tags.** Each `@urn:…` tag resolves to a live URN in the IR or its imports. Every operation URN has at least one feature tagged with it; an untagged operation is a failure.
2. **Headers.** Each DataTable and Scenario Outline `Examples` header in a scenario tagged with an entity or operation URN must be a field key of that entity (or of the operation's input entity). Unknown headers fail; missing required fields fail.
3. **Boundary coverage.** For each tagged operation, across all its scenarios' example values:
   - `min` / `max` fields: values at min−1, min, max and max+1 (integer); at min, max and one step outside each for `decimal` at the declared scale.
   - `minLength` / `maxLength`: lengths at each bound and one outside.
   - `oneOf`: every allowed value, plus one value outside the set.
   - `format` / `regex`: at least one valid and one invalid value.
   - Each declared `error` of the operation: at least one scenario that expects it, by URN.

Coverage is checked by reading example values, not by running the tests. Gate 3 shows that the boundary cases are present; the test run shows whether they pass.

**Adoption mode (warn, then ratchet).** Gate 3 checks 1 and 2 (tags and headers) always fail the build. Check 3 (boundary coverage) follows `boundaryCoverage` in config, `warn` by default. A feature can opt in early with the tag `@urn-forge:strict`, which makes its coverage gaps fail even in `warn` mode. Once every feature is strict, switch the config to `error`. `verify` prints the strict and non-strict feature counts so progress is visible.

**Ratchet trigger.** Switch `boundaryCoverage` to `error` as soon as every feature is strict, and no later than the M3 exit gate, whichever comes first.

**Escape hatch.** A boundary can be waived per field with `@urn-forge:waive(<field URN>, <reason>)` on the feature. Waivers are listed in `verify` output so they stay visible in review.

## 9. CLI and repository layout

Six commands read their defaults from `urn-forge.config.ts`; flags override config.

| Command | Does | Exit non-zero when |
| --- | --- | --- |
| `urn-forge init` | Scaffolds `domain.manifest.yaml`, `urn-forge.config.ts`, one sample feature, ESLint config | Target files exist (unless `--force`) |
| `urn-forge compile [--out <dir>] [--reference-date <d>]` | Validates manifest, builds IR, runs plugins, writes files | Any error diagnostic |
| `urn-forge verify [--src <dir>] [--features <dir>] [--base <git-ref>]` | Runs gates 1–5 | Any gate fails |
| `urn-forge diff <old-manifest> <new-manifest>` | Classifies every changed URN as compatible, breaking or lifecycle | Any breaking change to a live URN |
| `urn-forge inspect [--json]` | Prints the canonical IR | Manifest invalid |
| `urn-forge graph [--format mermaid\|dot]` | Prints the dependency graph of entities, fields, invariants, operations and events | Manifest invalid |

Diagnostics print as `file:line:col  severity  <URN>  message`; `--format json` emits the same as JSON lines for CI annotations.

```
urn-forge/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts                     # init, compile, verify, diff, inspect, graph
│   ├── config.ts                  # defineConfig + config schema
│   ├── meta-schema.ts             # Valibot schema for manifests
│   ├── rules/                     # invariant expression parser + type checker
│   ├── ir/
│   │   ├── types.ts               # UniversalIR
│   │   ├── build.ts               # passes 1–8
│   │   └── canonical.ts           # canonical JSON + fingerprint
│   ├── diff/                      # compatibility classifier
│   ├── plugins/
│   │   ├── plugin.interface.ts
│   │   ├── valibot.plugin.ts
│   │   ├── fcis.plugin.ts
│   │   ├── gherkin.plugin.ts
│   │   └── postgres.plugin.ts
│   └── verify/
│       ├── completeness.ts        # gate 1
│       ├── gherkin.ts             # gate 3
│       └── drift.ts               # gate 4
├── packages/
│   └── eslint-config/             # gate 2 profile + no-brand-construction rule
└── tests/
    ├── fixtures/
    │   ├── math.manifest.yaml
    │   └── insurance.manifest.yaml
    ├── golden/                    # expected generated output per fixture
    └── *.test.ts
```

Golden-file tests compile each fixture and compare against `tests/golden/`. A second run on a different time zone and locale in CI checks the determinism contract.

## 10. Roadmap

Milestone 2 now ships a thin end-to-end slice, from manifest to passing feature file, so the traceability idea is tested before the breadth work.

&#91;embedded content: roadmap · 4 milestones, each with an exit gate\]

The milestones are not to scale and have no dates yet. M2's exit includes an explicit go / no-go: if traceability does not pay off on the math fixture, M3 and M4 should be re-scoped before more is built.

## 11. Decisions and open questions

All eighteen questions were settled in the 19 Nov 2026 interview; none remain open.

| Question | Decision | Where it lands |
| --- | --- | --- |
| Who is v1 for? | The author's own projects | 1 |
| What counts as success? | All four: traceability, less boilerplate, safer evolution, pure-core discipline | 1 |
| First domain | Fixtures through M3; one real project of yours before M4 exits | 10 |
| Existing tests | Cucumber suites already exist | 8 |
| Manifest format | YAML only | 1, 3 |
| Manifest files | One file per domain | 3 |
| Declared errors | Separate `error` kind, with category, retryable, message, optional `recordAs` | 4.6, 5, 7.2 |
| Error categories | Keep all five; `validation` is for domain rules, malformed input stays `InputRejected` | 4.6 |
| Breaking changes | Strict, unless the manifest sets `stability: experimental` | 3, 8 |
| Gate 3 boundary coverage | Warn by default, opt in per feature with `@urn-forge:strict`, then flip to `error` | 8 |
| Ratchet trigger | Flip to `error` once every feature is strict, and no later than the M3 exit gate | 8, 10 |
| Postgres plugin | Keep, in M4 | 7.4, 10 |
| Decimal values | Strings into the core | 4.1, 7.1 |
| Cross-manifest imports | Cut from v1 | 1, 3 |
| Invariant scope | Single-entity only | 4.3 |
| Async handlers | Synchronous only | 4.4, 7.2 |
| Dogfooding | M4 exit requires using urn-forge on one real project | 10 |
| Name | Keep urn-forge | — |
