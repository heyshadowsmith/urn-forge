# Rules and the standard rules

A rule states something that must be true. Every rule has a name, and its text is in one place: the top-level `rules` section of the manifest, or the standard set that urn-forge ships. A definition, an output or an operation applies a rule by its name.

## Keys of a rule

```yaml
rules:
  at_least:
    description: The value is the bound or more
    parameters: [limit]
    rule: self >= limit
    message: Must be at least {limit}
```

| Key | Required | Value |
| --- | --- | --- |
| `description` | Yes | What the rule states, for a reader |
| `rule` | Yes | An expression in the rule language that gives `true` or `false`. Refer to [The rule language](./rule-language) |
| `message` | Yes | The text of a failure. `{name}` puts the argument of the parameter `name` in the text |
| `parameters` | No | A list of the names of definitions. Each is a parameter of the rule, with the type of its definition |
| `deprecated` | No | `true` or `false` |

- The rule reads each parameter by its name, for example `limit`.
- A message can name only the parameters of its rule. Otherwise, `compile` stops with `invalid-message`.
- In a message, a list argument is its items joined with `, `. For example, `Must be one of {choices}` becomes `Must be one of domestic, international`.
- A failure also carries the name of the rule, so that an application can show its own text for it.

## Where a rule applies

| Where | Names the rule can read | Example |
| --- | --- | --- |
| The `rules` of a definition | `self`: the value | `self >= limit` |
| An entry of `output`: `- quote: [fits_express]` | `input`, and `output`: that object | `output.weight_grams == input.weight_grams` |
| The `rules` of an operation | `input`, and `output` if the operation has one output | `input.total_cents > 0` |

A rule that reads a name that does not exist where it is applied stops `compile` with `rule-scope`. Thus a rule with `self` cannot apply to an output, and a rule with `input` cannot apply to a definition.

## Arguments

| The rule has | Apply it as | Example |
| --- | --- | --- |
| No parameter | The name | `- uniqueItems` |
| One parameter | A map of the name to the argument | `- minimum: 1` |
| Two or more parameters | A map of the name to a map of each parameter to its argument | `- between: { low: 1, high: 9 }` |

The argument must be a value of the definition of its parameter, with its rules. For example, the parameter of `minLength` is `count`, an integer of 0 or more. `- minLength: -1` stops `compile` with `rule-argument`:

```
domain.manifest.yaml:11  error  rule-argument  minLength: -1 breaks minimum of count: Must be at least 0
```

## The standard rules

The standard rules are the keywords of JSON Schema, declared as any rule is. urn-forge loads them before your manifest. Their parameter definitions are in urn-forge's own namespace, so they do not clash with the names of your manifest.

| Rule | For | Parameter | Rule text | Message |
| --- | --- | --- | --- | --- |
| `enum` | `string` | `choices`: a list of strings | `self in choices` | `Must be one of {choices}` |
| `const` | `string` | `choice`: a string | `self == choice` | `Must be {choice}` |
| `minimum` | `integer`, `number` | `bound`: a number | `self >= bound` | `Must be at least {bound}` |
| `maximum` | `integer`, `number` | `bound`: a number | `self <= bound` | `Must be at most {bound}` |
| `exclusiveMinimum` | `integer`, `number` | `bound`: a number | `self > bound` | `Must be more than {bound}` |
| `exclusiveMaximum` | `integer`, `number` | `bound`: a number | `self < bound` | `Must be less than {bound}` |
| `multipleOf` | `integer` | `factor`: an integer of 1 or more | `self % factor == 0` | `Must be a multiple of {factor}` |
| `minLength` | `string` | `count`: an integer of 0 or more | `size(self) >= count` | `Must have at least {count} characters` |
| `maxLength` | `string` | `count`: an integer of 0 or more | `size(self) <= count` | `Must have at most {count} characters` |
| `pattern` | `string` | `regular_expression`: a string | `self.matches(regular_expression)` | `Must match {regular_expression}` |
| `format` | `string` | `date_format`: `date` or `date-time` | A pattern for each format | `Must be a {date_format}` |
| `minItems` | `array` | `count`: an integer of 0 or more | `size(self) >= count` | `Must have at least {count} items` |
| `maxItems` | `array` | `count`: an integer of 0 or more | `size(self) <= count` | `Must have at most {count} items` |
| `uniqueItems` | `array` | none | `self.all(x, self.exists_one(y, y == x))` | `Must not have an item two times` |
| `required` | `object` | `property_names`: a list of names | `property_names.all(p, p in self)` | `Must have {property_names}` |

Notes:

- A rule for another type stops `compile` with `rule-type`. For example, `minLength` on an integer.
- `enum` and `const` are for strings. For a choice of numbers, use `minimum` and `maximum`, or a rule of your own.
- `pattern` matches a part of the text. To match the whole text, start the expression with `^` and end it with `$`.
- `format: date` matches `2026-11-24`. `format: date-time` matches `2026-11-24T19:00:00Z`, with optional fractions of a second and an offset such as `+02:00` in place of `Z`.
- `required` names properties of the object. A name that is not a property stops `compile` with `unknown-property`. The check of an object runs `required` before the other rules of the object.
- The TypeScript type of a `string` with `enum` is the union of its choices.

The standard set is the file `src/standard.manifest.yaml` of the package:

<<< @/../packages/urn-forge/src/standard.manifest.yaml

## Related pages

- [The rule language](./rule-language)
- [Add a rule](../how-to/add-a-rule)
- [Diff and versions](./diff)
