# JSON Schema's words and CEL

The manifest is urn-forge's own YAML. Where JSON Schema has a word, the manifest uses that word with its meaning. The rules are expressions in a subset of CEL, the Common Expression Language. Operations take the shape of TypeSpec's: a signature and its rules. This page tells why.

## Why not a format of our own

A new format is a new language to learn. Each word that is different from a known word costs the reader time, and each word that is the same but means something else costs more.

JSON Schema is the language that most developers already read for the shape of a value. Its words have a known meaning: `type`, `properties`, `items`, `required`, `enum`, `minimum`, `maxLength`, `pattern`, `format`, `deprecated`. A reader who knows JSON Schema can read most of a manifest on the first day.

Where JSON Schema has no word, urn-forge adds the smallest word that it needs. `identifier` is one: JSON Schema has no way to say which property tells two objects apart.

## Why not JSON Schema itself

JSON Schema describes values. A contract also needs:

- **Operations.** An input, a list of outputs, and the rules that relate them.
- **Names for rules.** A failure must say which promise broke, and `diff` must compare a promise by its name. In JSON Schema, a keyword has no name of its own.
- **Rules across values.** "A booking ends after it starts" relates two properties. JSON Schema has no clean way to say it.
- **One place for each piece.** JSON Schema lets a schema be written inline, renamed and narrowed in place. A manifest names each definition one time, and an object lists its properties by those names. Thus a value has one meaning wherever it occurs.

So the manifest keeps the words of JSON Schema, and changes their place: structure is what a value is, and everything that must be true of it is a rule.

## Keywords are rules

In JSON Schema, `minimum` is a keyword with a fixed meaning. In the manifest, `minimum` is a rule like any other, with a name, a parameter, a text and a message:

```yaml
  minimum:
    description: The value is the bound or more
    parameters: [bound]
    rule: self >= bound
    message: Must be at least {bound}
```

urn-forge ships these rules as a standard set, in a manifest of its own. Your rules use the same form. Thus:

- one checker types the standard rules and yours;
- one code generator makes the checks of both;
- `diff` compares both the same way, and the form of a rule, such as `self >= bound`, tells it whether a larger bound accepts more or less;
- the message of each failure has the same form.

## Why CEL

A rule needs a language. The language must be:

- **small**, so that urn-forge can type it, translate it to TypeScript and SQL, and compare two rules in `diff`;
- **without side effects and loops**, so that each rule ends, and gives the same result for the same value;
- **known**, so that a reader does not learn a new language.

CEL is all three. Kubernetes uses it for the validation rules of its resources, and Buf's protovalidate uses it for the rules of Protocol Buffers messages. Both use it as urn-forge does: a rule on a value that a schema describes, with `self` as the value.

urn-forge uses a subset of CEL, and parses it itself. A CEL library evaluates an expression. urn-forge must do more: it must find the type of each part, find each `has()` guard, write the rule as TypeScript and as SQL, and print it for `diff`. The generated code is plain TypeScript, so your application has no CEL library at run time.

Each rule that urn-forge accepts is valid CEL. urn-forge is stricter in one point: an optional property is read only after `has()`. In CEL, the same read gives an error at run time. In urn-forge, it stops `compile`.

The subset grows only for a real need. A form of CEL outside the subset is a diagnostic that names it, not a quiet addition. Refer to [The rule language](../reference/rule-language).

## Why TypeSpec's shape for operations

TypeSpec describes an operation as a signature: parameters and a return type, which can be a union of results. urn-forge uses the same shape: one input object, and a list of output objects. A refusal is one of the outputs, an ordinary object. There is no separate list of errors, because an error is only an answer that the caller did not want.

## Related pages

- [General constructs only](./general-constructs)
- [Rules and the standard rules](../reference/rules)
- [The rule language](../reference/rule-language)
