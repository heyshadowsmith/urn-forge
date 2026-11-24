# Manifest redesign: decisions so far

Nov 24, 2026. Working notes from a walk-through in chat. Nothing is built yet.

## Direction

- urn-forge is an enabler: general constructs only, never an idea of one domain.
- urn-forge is a harness (a framework): it checks what goes into the user's code and what comes out. Business logic stays in the user's code.
- Our own YAML manifest. Where JSON Schema has a word, we use its word and its meaning. Operations take the shape of TypeSpec's: a signature and its rules.

## Decided

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Header | `manifest: { namespace, domain, version }` |
| 2 | Layout | Pieces are grouped by kind, not named by kind |
| 3 | One concept | Fields and entities are one concept, in one section, `definitions:`. An object is a definition with `type: object` |
| 4 | Type | `type`, not `primitive` |
| 5 | Choices | `type: string` with the rule `enum: [...]` (JSON Schema), not `type: enum` |
| 6 | Limits | JSON Schema words: `pattern`, `minimum`, `maximum`, `minLength`, `maxLength`. They are rules (decision 16) |
| 7 | Objects | `properties: [names of shared definitions]`, and the rule `required: [...]`. No renaming or narrowing in place |
| 8 | Lists | A definition with `type: array` and `items` (one shared definition); `minItems`, `maxItems`, `uniqueItems` are rules |
| 9 | Embedding | The name of an object definition in `properties` (or in `items`) embeds it |
| 10 | Identity | `identifier: <property>` on an object (renamed from `key`; ours, as JSON Schema has none): the property that tells two objects of that kind apart. It must be required and one value. Its uses in storage and operations are revisited with operations |
| 11 | Errors | No `category`, no `retryable`. Errors and events are objects; the operation gives them their role |
| 12 | Keywords | Keywords are parameterised rules. The JSON Schema keywords are a standard set that urn-forge ships; users declare their own the same way. `diff` compares parameters, and the form of the rule gives the direction |
| 13 | Diffing rules | Every rule has a name. Added: accepts less. Removed: accepts more. Text edited: breaking both ways |
| 14 | Where rules live | All rule text is in the top-level `rules:` section, each with a name, `rule`, `message`, and optional parameters. No rule text anywhere else |
| 15 | Applying rules | A definition or an operation has a `rules:` array, like `properties`: rule names, with a parameter where the rule has one (`- minimum: 1`, `- even`, `- required: [reference]`) |
| 16 | Structure and rules | Structure is what a value is: `description`, `type`, `properties`, `items`, `identifier`. Everything that must be true of it is a rule in `rules:`, including `required` and `enum`. The JSON Schema keywords are a standard set of rules that urn-forge ships |
| 17 | Types | JSON Schema's six: `string`, `number`, `integer`, `boolean`, `object`, `array`. A date is a `string` with the rule `format: date`, a timestamp a `string` with `format: date-time` |
| 18 | Exact amounts | No decimal type. An exact amount, such as money, is an `integer` of its smallest unit (cents) |
| 19 | Standard set | Any value: `enum`, `const`. Numbers: `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`. Strings: `minLength`, `maxLength`, `pattern`, `format` (only `date` and `date-time`). Arrays: `minItems`, `maxItems`, `uniqueItems`. Objects: `required`. Anything else a user declares |
| 20 | Parameters | A rule lists its parameters by name, `parameters: [count]`, as shared definitions in `definitions:`, the same way `properties` lists values. The rule's text and message use those names (`value >= count`, `{count}`). The standard set's own definitions live in urn-forge's namespace, so they never clash with a user's names |
| 21 | Parameter types | No "same type as the value". As in JSON Schema, `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum` and `multipleOf` take a `number` (an integer is a number). `enum` and `const` are for strings: their parameter is a `string`, or an `array` of strings. A choice of numbers is a user's own rule, or `minimum` and `maximum`. CEL has `%` only for integers, so `multipleOf` applies to integers, with an integer factor of 1 or more |
| 22 | Rule language | A subset of CEL (Common Expression Language), as Kubernetes and Buf's protovalidate use it with schemas. Every urn-forge rule is valid CEL. `self` is the value the rule applies to. urn-forge parses the subset itself, to translate rules to SQL, compare them in `diff` and check them in tests. Before/after (CEL's `oldSelf` in Kubernetes transition rules) is a reference for operations |
| 23 | CEL core | `self`; properties and paths (`self.contact.email`); parameters by their definition's name; `==`, `!=`, `<`, `<=`, `>`, `>=`; `&&`, `\|\|`, `!`, parentheses; `+`, `-`, `*`, `/`, `%`; `in`; `has()`; literals. An optional property is used only after `has()` (a stricter check than CEL, still valid CEL). Anything else in CEL is added only for a real need |
| 24 | CEL lists | `all`, `exists`, `size`, and `map` with `sum()` (from the Kubernetes CEL list extension) for totals. Not yet: `filter`, `min()`, `max()`. The standard set needs three more, which are in the subset: `exists_one` (for `uniqueItems`), `matches()` (for `pattern` and `format`) and `size()` on a string (for `minLength` and `maxLength`) |
| 25 | CEL times | A rule turns a time string into a timestamp with `timestamp(...)`, written in each rule: no type implied by `format`. `duration(...)`, comparisons, a timestamp plus or minus a duration, and the difference of two timestamps. No calendar months and no date arithmetic: a `format: date` string compares as text |
| 26 | Description and message | Every definition and every rule has a `description`: what it is, for a reader of the contract (docs, generated comments, database comments). A rule also has a `message`: the text of a failure, with its parameters filled (`Must be at least {bound}`). A failure also carries the rule's name, so an app can show its own wording |
| 27 | Deprecation | JSON Schema's `deprecated: true` on any piece: the generated code is marked `@deprecated`, and a live piece that uses it gets a warning. No `sunset` (remove the piece; `diff` reports it), no `supersededBy` (the `description` says what to use), no dates and no notice policy (they belong to the running service) |
| 28 | Versions | No `stability`. `diff` judges a breaking change by semver: allowed (and listed) in `0.x`, in a pre-release (`2.0.0-alpha.1`) and across a major bump; an error within one major version (`1.4.0` → `1.5.0`) |
| 29 | Operations | An operation is a TypeSpec-style signature: `input` (one object), `output` (a list: one of these objects), and a `rules:` array. Nothing else. No `changes`, `from`, `to`, `moves`, `requires`, `ensures` or `errors`: a refusal is one of the outputs, an ordinary object; a stored record the code loaded is a property of the input; before and after are the input's record and the output. Richer patterns (before/after, deciders) are things users build from signatures and rules |
| 30 | Names in an operation's rule | `input` and `output`, declared CEL variables. No `self` in an operation's rule, and no `input`/`output` in a value's rule: a rule applied where its names do not exist stops `compile` |
| 31 | Rules for each output | `output` is a list of entries `- <object>: [rule names]`: the rules that hold when that object comes back. Inside them, `output` is that object, so no rule needs a type test. The operation's own `rules:` hold whichever output came back |
| 32 | A definition as a type | `type` can name another definition: `from_account: { type: account }` is an account, with all its rules, and can add its own. So an object holds two values of one kind under two definitions (`from_account`, `to_account`) |
| 33 | No `link` | A reference to another object is a value whose `type` is that object's identifier definition (`restaurant_ref: { type: restaurant_number }`). The harness sees only input and output, so "it exists" is the user's code's job (it loads the object into the input). Foreign keys are settled with storage |
| 34 | Compatibility | Stays in the manifest's header, `compatibility: { callers: ignore-unknown }`: a promise that callers tolerate what they do not recognise in outputs, so a new output or a new choice in an output is compatible for `diff`. Without it, both are breaking |
| 35 | Out of the manifest | `idempotency`, `due`, `delivery` (and the outbox), `recordAs` and `callers` leave the manifest. `due`, `recordAs` and `callers` are objects and rules that users write (the caller is a property of the input). `idempotency` and `delivery` may come back as optional extras outside the manifest: libraries built on the generated code, not keywords |
| 36 | Storage | A schema-only Postgres extra: it reads the manifest and writes tables, columns, `CHECK` constraints and child tables. No runtime code (no `commit`, `commitOnce`, `runOnce`, `load` or outbox). Its own config chooses the objects that become tables, foreign keys, and uniqueness across stored records: database facts stay out of the manifest |

## Open

- The plan for the change: [manifest-redesign-plan.md](./manifest-redesign-plan.md). urn-forge is at `0.1.0` and not published, so the only manifests to move are ours. The new compiler is built next to the old one, then replaces it.
