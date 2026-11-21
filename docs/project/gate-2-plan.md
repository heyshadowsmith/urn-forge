# urn-forge gate 2 plan

Nov 21, 2026 · @Shadow Smith

A branded type says that a value passed its field's schema: a `PolicyPremium` is a decimal with at most two digits after the point and more than 0. The generated parsers are the only place that should make such a value. Today nothing makes sure of that. A core can write `'0' as PolicyPremium`, or pass an `any` where a brand belongs, and `tsc` accepts both. Gate 1 then proves that the handlers have the right types, but the types can lie.

Gate 2 of the spec (§8, "Boundary discipline") closes this: no branded value is forged outside the generated parsers. It is the last gate of the spec that urn-forge does not have.

## What changes for a user

```ts
// insurance/core.ts
const limit = '0' as PolicyLimit;              // gate 2: a type assertion to a branded type
const id: CustomerCustomerId = JSON.parse(raw); // gate 2: an any where a branded type belongs
// @ts-expect-error                             // gate 2: a comment that turns off a type check
import { PolicyLimitSchema } from './generated/domain.schemas.generated'; // gate 2: the core parses
```

```text
$ urn-forge verify
gate 1  completeness  PASS  …
gate 2  boundary      FAIL  2 file(s), 1 core file(s): 4 problem(s)
    insurance/core.ts:12:15  error  brand-assertion  '0' as PolicyLimit asserts the branded type PolicyLimit; only a generated parser makes a branded value
    …
```

## The model

| Who | May make a branded value? | How |
| --- | --- | --- |
| The generated parsers (`domain.schemas.generated.ts`), called by `executeOperation` | Yes | `v.parse` with a schema: the value passed the rules |
| The shell | Yes, through a parser | `executeOperation`, or a generated schema for a value it reads, such as an id from a URL |
| The core | No | It receives branded input, and returns plain output that the shell parses (spec §7.2) |
| Anyone, by a type assertion, an `any`, or a turned-off check | No | That is forging: the type says "valid" and nothing checked it |

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | What runs the gate? | **The TypeScript type checker, on the program that gate 1 already builds.** No ESLint, and no new dependency | The spec ships an ESLint profile with typescript-eslint. That adds two large runtime dependencies, a second configuration surface and a second type check of the same files. The checker that gate 1 uses can answer each question of this gate exactly, and it is already there. This is a departure from §8, in the spirit of §1, principle 5 (use the tools that already do the job) |
| 2 | What is forging? | Four things, each with its own code: **`brand-assertion`**: a type assertion (`as T`, `<T>x`) whose target type carries a brand; **`brand-from-any`**: an expression of type `any` in a place whose type carries a brand (an assignment, a return, an argument, a property); **`suppressed-check`**: `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck`; **`core-parser-import`**: a value import of the generated schemas module or of `valibot` in a core file | Each is a way to make the type say "valid" without a parse. `as const` and an assertion to a type with no brand (`as HTMLInputElement`) are not forging, so they stay allowed. A type import stays allowed: the core needs the branded types to name its values |
| 3 | What carries a brand? | **A type with Valibot's brand property** (`[BrandSymbol]`), found through unions, intersections, arrays, tuples and object properties, to a fixed depth | `'0' as PolicyPolicy` forges every branded field inside the object. The fixed depth keeps the check finite on recursive types |
| 4 | Which files? | **Core files**: the core entry and every file that it imports, transitively, in the core entry's directory. **Shell files**: a new config setting, `shell` (a list of files or directories), default none. Generated files, `node_modules` and declaration files are never checked; tests are not checked | The core entry is already in the config. A shell has no fixed shape, so the project names it. Tests forge values on purpose, to test the boundary |
| 5 | Core and shell rules | **The same three rules for both** (`brand-assertion`, `brand-from-any`, `suppressed-check`); **`core-parser-import` for core files only** | The shell may parse, because that is where values come in. The core never needs to |
| 6 | A way to allow one case? | **No waiver in this plan** | The core and the shell never need to forge a brand: the parsers make every branded value. A waiver can come later, as an addition, if a real case needs one |
| 7 | Severity | **Errors.** The gate fails on any problem | A forged brand is a broken contract, as a missing handler is |
| 8 | `verify` | Gate 2 runs after gate 1, in the same program. The summary becomes `gates 1, 2, 3, 4; gate 5 is urn-forge diff` | Every gate of the spec is then built |
| 9 | The ESLint profile of §8 | **Not in this plan** | Decision 1. A team that uses ESLint keeps its own setup, and gate 2 does not depend on it |
| 10 | Target | **A set of small cases, `tests/gate-2/`, one forgery each, and every core in this repository clean** (insurance, self, example, the three tutorials, and the starter of `urn-forge init`) | A case per rule keeps each rule tested alone. The cores of the repository show that a real core needs no forgery |
| 11 | One PR? | **Yes**, one commit per step, as before | |

## Scope

**In:** gate 2 with its four codes, on the checker of gate 1; the `shell` config setting; the verify summary; `tests/gate-2/`; the docs (the gate, the codes, a how-to to fix each problem, and the model in the explanation of the functional core).

**Out:** an ESLint profile; a waiver; checks on tests; rules about anything but brands (such as `any` in general, or non-null assertions).

## The target, written first

Step 0 writes `tests/gate-2/`: one small project per rule (a manifest, a generated runtime, and a core or a shell with one forgery), each with the code it expects, and one clean project. Until step 1, `verify` runs no gate 2, so each forgery passes; that is the check of step 0.

## Build order

One PR (decision 11), one commit per step. Each step leaves the repository green and ends with a check.

- [x] **0. The target.** As above. *Check:* `verify` passes on every case, because no gate 2 exists yet.
  - *Done.* Each case is a fragment that the test adds to a copy of insurance's core, or a shell file, so a case is a few lines. The check was met: with gate 1 only, all ten cases passed, so each forgery was unseen. The fragments are excluded from the package's own tsconfig, because they type-check only inside the copy.
- [x] **1. The gate.** The file sets, the brand test, the four rules, the codes, the summary, `shell` in the config. *Check:* each case of `tests/gate-2/` gives exactly its code; the clean case passes; every core of the repository passes.
  - *Done.* The check was met: each case gives exactly its code, at the line of the forgery, and the clean case none. The cores of insurance, self, the example and the three tutorials pass, and so does the starter of `urn-forge init` in the tarball test. Gate 1 keeps its program for the run (`programFor`), and gate 2 builds on it, so the core files are parsed once. The first messages printed the expanded type (`string & Brand<"urn:…">`, or a whole object); they now name the type as the code writes it (`PolicyLimit`). A test runs `verify` through the CLI with `shell` in a config.
- [x] **2. Ship.** The docs; the starter's config names its shell, if it has one. *Check:* CI green; every sabotage below fails.
  - *Done.* Every quoted `verify` output in the docs now has the gate 2 line and the summary `gates 1, 2, 3, 4; gate 5 is urn-forge diff`. The docs writers found two faults, each fixed with a test: an `any` in an object property was reported twice (also at the property name), and a `@ts-ignore` inside a string counted as a suppression; the gate now reads comments only. They also noted that gate 2 shows PASS when gate 1 cannot build the program; gate 1 fails the run then, so this stays.

## Done

| Sabotage | What catches it | Result |
| --- | --- | --- |
| `'0' as PolicyLimit` in a core | `brand-assertion` | Caught (case `assertion`) |
| `x as unknown as CustomerCustomerId` | `brand-assertion` | Caught (case `double-assertion`) |
| `{ … } as PolicyPolicy`, an object with branded fields | `brand-assertion` | Caught (case `object-assertion`) |
| `const id: CustomerCustomerId = JSON.parse(raw)` | `brand-from-any` | Caught (case `from-any`) |
| A handler that returns an `any` as its branded input type | `brand-from-any` | Caught as a function typed `PolicyPremium` that returns `JSON.parse(raw)` (case `return-any`) |
| `// @ts-expect-error` above a mistyped handler | `suppressed-check` | Caught, above a mistyped constant (case `suppressed`) |
| `import { PolicyLimitSchema } from './generated/…'` in a core | `core-parser-import` | Caught (case `core-imports-parser`; also `valibot`, case `core-imports-valibot`) |
| The same import in a shell file | Nothing: the shell may parse | Met (case `clean`) |
| `as const`, and `as HTMLInputElement` in a shell | Nothing: no brand | Met with `as const` and `as Record<string, unknown>` (case `clean`): the package's tsconfig has no DOM types |

**Met.**

## Risks

- **A checker rule is code to maintain.** ESLint rules come with a community; these four rules are urn-forge's own. They are small, and each has a test case. If a fifth rule is needed, adopting typescript-eslint can be a later plan.
- **The `any` rule sees only `any`.** A value of type `unknown` cannot reach a branded type without an assertion, which the first rule catches, so the two rules together close the gap. A generic function that returns `T` from an `any` inside a library is outside the files that gate 2 checks.
- **Files outside the core's directory.** A core that imports helpers from a sibling directory does not get them checked as core files. The project can list that directory under `shell`, where the three common rules apply.
