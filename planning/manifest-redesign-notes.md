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
| 5 | Choices | `type: string` with `enum: [...]` (JSON Schema), not `type: enum` |
| 6 | Limits | JSON Schema words: `pattern`, `minimum`, `maximum`, `minLength`, `maxLength` |
| 7 | Objects | `properties: [names of shared definitions]` and `required: [...]`. No renaming or narrowing in place |
| 8 | Lists | A definition with `type: array`, `items`, `minItems`, `maxItems`, `uniqueItems` |
| 9 | Embedding | The name of an object definition in `properties` (or in `items`) embeds it |
| 10 | Identity | `key` on an object (ours: JSON Schema has none). `link: <object>` on a definition holds that object's key |
| 11 | Errors | No `category`, no `retryable`. Errors and events are objects; the operation gives them their role |
| 12 | Keywords | Keywords are parameterised rules. The JSON Schema keywords are a standard set that urn-forge ships; users declare their own the same way. `diff` compares parameters, and the form of the rule gives the direction |
| 13 | Diffing rules | Every rule has a name. Added: accepts less. Removed: accepts more. Text edited: breaking both ways |
| 14 | Reusable rules | A top-level `rules:` section declares them, with a parameter (`at_least: { rule: value >= n }`). A definition of any type uses one as a keyword (`at_least: 1`) |
| 15 | One-off rules | `constraints:` on a definition of any type: named rules, each with `rule` and `message`. A rule on a simple value reads `value` |

## Open

- Operations: `input`, `output` (one of several objects), `rules`. Where today's `requires`, `ensures`, `callers`, `changes`, `moves` and `refuses` go.
- `message` on an object; `format` (`date`, `date-time`, `email`); decimals.
- Out of the manifest, maybe extras later: `idempotency`, `due`, `delivery`, the outbox, `recordAs`.
- Lifecycle, `compatibility`, `stability`.
- The rule language itself.
- The fate of PR #90 (the integrity plan), which assumes today's operations.
