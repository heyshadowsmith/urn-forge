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
| 21 | Parameter types | No "same type as the value". As in JSON Schema, `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum` and `multipleOf` take a `number` (an integer is a number). `enum` and `const` are for strings: their parameter is a `string`, or an `array` of strings. A choice of numbers is a user's own rule, or `minimum` and `maximum` |

## Open

- Parked until operations: `link`; two values of one definition in one object (`before`/`after`, `from`/`to`); `type` naming another definition.

- Operations: `input`, `output` (one of several objects), `rules`. Where today's `requires`, `ensures`, `callers`, `changes`, `moves` and `refuses` go.
- `message` on an error object.
- Out of the manifest, maybe extras later: `idempotency`, `due`, `delivery`, the outbox, `recordAs`.
- Lifecycle, `compatibility`, `stability`.
- The rule language itself.
- The fate of PR #90 (the integrity plan), which assumes today's operations.
