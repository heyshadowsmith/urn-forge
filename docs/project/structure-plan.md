# urn-forge structure plan

Nov 21, 2026 · @Shadow Smith

Today a property of an entity holds one value of a field, or a list of them. A real domain also needs a property that holds another entity (an order holds its lines) and a property that points at another entity (an order names its customer). This plan adds both, on the axis that the [primitives plan](./primitives-plan) set for structure: the field reference. A primitive still says what one value is; a reference says what a property holds and how many.

## What changes for a user

```yaml
customer.entity.customer:
  description: A person who holds policies
  key: customer.field.customer_id          # what a link to a customer holds
  fields:
    - ref: customer.field.customer_id
    - ref: customer.field.name

policy.entity.coverage:
  description: One peril that a policy covers, up to a limit
  key: policy.field.peril
  fields:
    - ref: policy.field.peril
    - ref: policy.field.limit

policy.entity.policy:
  description: An issued insurance policy
  fields:
    - ref: policy.field.policy_id
    - link: customer.entity.customer       # holds a customer_id
      as: holder
    - ref: policy.entity.coverage          # holds coverage objects
      as: coverages
      many: { minItems: 1, unique: true }  # unique by the key, peril
```

```ts
// The core receives the nested values, typed and branded.
({ holder, coverages }) => {
  const id: CustomerCustomerId = holder;         // the key field's brand
  const limits = coverages.map((c) => c.limit);  // each one a parsed coverage
  …
}
```

```gherkin
When I run the operation with:
  | policy_id | holder | coverages                                             |
  | …         | c-17   | [{ peril: fire, limit: 1000 }, { peril: flood, limit: 500 }] |
```

## The model

| A reference … | The property holds | The type in the core |
| --- | --- | --- |
| `ref: <field>` (today) | One value of the field | The field's branded type |
| `ref: <entity>` (new) | An object of that entity, embedded | The entity's parsed type |
| `link: <entity>` (new) | The value of that entity's `key` | The key field's branded type |

`required`, `many` and the new `as` apply to each form. An embedded entity keeps its own invariants: they run inside it. A link is a value, so a rule can compare it, and it may form cycles (a customer can link to a policy that links to the customer). An embedding cannot form a cycle, because the type would never end.

## Decisions to confirm

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | Where does structure live? | **On the field reference**, next to `many`: `ref` to an entity embeds it, `link` to an entity points at it. No `list`, `record` or `ref` primitive | The primitives plan put structure on the reference; one axis for what a property holds keeps the model MECE |
| 2 | How does an entity say what a link holds? | **`key: <field>` on the entity.** The key is one of its own fields, required and single-valued. An entity needs a `key` only if something links to it or a `unique` list holds it | Spec §4.2 has `key` for SQL. Here it also gives a link its value and a list of entities its uniqueness |
| 3 | What type does a link have? | **The key field's branded type** | The core can pass a customer's `customer_id` straight into a link to a customer, and `tsc` refuses an id of another entity |
| 4 | How is a property named? | **The identifier of what it references, or `as: <name>`** | Two links to one entity (a payer and a holder) need two names, and a list of `coverage` reads better as `coverages`. The name rules stay: snake_case, unique in the entity (`duplicate-property`) |
| 5 | `unique` on a list of entities | **Compares the keys**; the entity must have a `key` | Objects have no equality of their own. The key is the entity's identity |
| 6 | Cycles | **Pass 5: an embedding cycle is an error (`embedding-cycle`)**; links may cycle | Spec pass 5. A link is a value, so a cycle of links is data, not a type |
| 7 | How does a table cell hold an embedded entity? | **`{ name: value, … }`**, each value read by its field's primitive, nested as deep as the entity; a list of them is `[{ … }, { … }]`. A link is the key's value, as a plain cell | The list syntax (`[a, b]`) already reads like YAML flow style; objects follow it. Dotted headers cannot hold a list of objects |
| 7a | How does a value inside `[ … ]` or `{ … }` hold a comma, a brace, a bracket or a quote? | **Quote it as a JSON string literal**, with JSON's escapes: `["Smith, Ada", "a \"quoted\" word"]`, `{ note: "x{y}" }`. A bare value is still read as today. The same rule applies to list cells, which removes today's limit that a list item cannot hold a comma. A plain cell outside brackets does not change | Real values hold commas and braces: names, addresses, notes, codes. JSON's string rules are known and exact, and a bare value stays short where it is safe. Decided in review of this plan |
| 8 | Boundary coverage of nested values | **The nested values count for their fields**, per operation, at any depth; a list of entities adds its count cases, and a repeated key for `unique` | The field's rules apply wherever the field is. Coverage is per operation, as today |
| 9 | Invariants and structure | **A rule names only its entity's own properties.** A link compares as the key's primitive. An embedded entity's invariants run inside it, and an issue points at the nested path (`coverages.1.limit`) | Spec §4.3: single-entity rules. Invariants on the embedded entity already say what it allows |
| 10 | Errors | **An error's fields can link and embed too**; a message placeholder names a single value or a link, not an embedded entity | Errors share the reference code; a placeholder needs text |
| 11 | `record` (a map) | **Not in this plan** | No domain here needs one. A list of entities with a `key` covers the cases we have |
| 12 | Target | **Extend `insurance/`** with a customer, a link from the policy, and a list of coverages with a key and an invariant | It is already in CI and strict, so every new part runs in a real domain from the start |
| 13 | One PR? | **Yes**, one commit per step, as before | |

## Scope

**In:** `ref` to an entity, `link`, `key`, `as`; passes 3 to 5 for them; the IR; Valibot (nested schemas, link types); the runtime (nested paths, `FieldInfo` for nested values); the steps (object cells, and quoted values in list and object cells); gate 3 (headers, nested values, coverage); `insurance/` and the docs.

**Out:** `record`; links across manifests; SQL foreign keys (no Postgres plugin yet); a link that the runtime resolves to its target (the shell does that).

## The target, written first

Step 0 extends `insurance/`: a `customer` entity with `key: customer.field.customer_id`; `issue_policy`'s policy gains `holder` (a link to a customer) and `coverages` (a list of 1 to 5 `coverage` entities, unique by `peril`); `coverage` has the invariant `limit_is_positive`. The features add scenarios for each new rule. Until the steps exist, `compile` refuses the manifest at pass 1 for `link`, `as` and `key`, and for `ref` to an entity at pass 4 (`wrong-ref-kind`); that is the check of step 0.

## Build order

One PR (decision 13), one commit per step. Each step leaves the repository green and ends with a check.

- [ ] **0. The target.** As above. *Check:* `compile` refuses exactly the new keys and references.
- [ ] **1. The manifest and the IR.** `key` on entities; `ref` to a field or an entity; `link`; `as`. The IR's field reference becomes one of three forms. Pass 3 checks names and keys; pass 4 resolves the targets; pass 5 finds embedding cycles. *Check:* insurance builds an IR; a fixture for each new diagnostic.
- [ ] **2. Valibot.** An embedded entity uses its schema (with its invariants); a link uses the key field's schema; a list of entities with `unique` compares keys. Schemas emit in dependency order. *Check:* the fixture's schemas parse nested values and refuse each broken rule at its nested path.
- [ ] **3. The runtime and the steps.** `FieldInfo` describes nested entities, so the steps read `{ … }` cells and compare nested output; issues keep nested paths and their field URNs. One cell reader for lists and objects reads bare and quoted values (decision 7a); a malformed cell (an open quote, a missing brace) is a step error with the column. *Check:* the insurance scenarios with nested values pass, one of them with a value that holds a comma and a brace.
- [ ] **4. Gate 3.** Headers of a nested entity's cells are checked; nested values count for coverage; list-of-entity cases. *Check:* a scenario removed gives the expected `uncovered-boundary` at a nested field.
- [ ] **5. Ship.** Insurance strict in CI with the new parts; the docs gain the reference forms, `key`, `as`, the cell syntax and the cycle rule; an explanation of structure in the MECE model. *Check:* CI green; every sabotage below fails.

## Done

| Sabotage | What catches it |
| --- | --- |
| A embeds B and B embeds A | Pass 5, `embedding-cycle` |
| `link` to an entity with no `key` | Pass 3 |
| `key` that names a field the entity does not have, or an optional one | Pass 3 |
| Two links to one entity without `as` | Pass 3, `duplicate-property` |
| `unique` on a list of an entity without a key | Pass 3 |
| A coverage with a limit of 0 in a scenario that expects success | Cucumber: `InputRejected` at `coverages.0.limit` |
| A list cell `["Smith, Ada"]` read as two items | The cell reader's tests: one item, `Smith, Ada` |
| The scenario for the repeated peril removed | Gate 3, `uncovered-boundary` |

## Risks

- **Cell syntax.** `{ … }` inside a table cell is dense. A value that holds a comma, a brace, a bracket or a quote must be quoted (decision 7a), and a `|` must be escaped as Gherkin requires (`\|`). A long nested value may need a scenario of its own. If cells get too dense in real use, a payload step with a DocString can come later as an addition.
- **Generated order.** An entity's schema must come after the schemas it embeds; today schemas emit in URN order. Emitting in dependency order changes the order of existing files only where an entity embeds another.
- **Link semantics.** A link holds the key's value; urn-forge does not make sure that the target exists. That is the shell's job, with its store; the docs must say so.
- **Size.** This plan touches every layer. Each step stays small by keeping the three reference forms in one place in the IR.
