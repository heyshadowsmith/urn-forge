# Add an entity

Add an entity: a named group of properties that an operation uses as its input or its output.

## Before you start

- Declare each field that the entity uses. Refer to [Add a field](add-a-field).
- Declare each entity that the entity embeds or links to.
- Choose the short key: `<context>.entity.<identifier>`, for example `policy.entity.policy`.

## Steps

1. Add the entry to `domain.manifest.yaml`. Give a `description` and a `fields` list. Each item has either `ref` or `link`.
2. For a field, write `ref` with the short key of the field. Add `required: false` to make it optional.
3. For a list, add `many` to the reference: `many: true`, or `many: { minItems: 1, maxItems: 10, unique: true }`.
4. To embed an object of a different entity, write `ref` with the short key of that entity. Use `as` to give the property name.
5. To point at an object of a different entity, write `link` with its short key. The target needs a `key`: a required, single-valued field of its own. The property then holds the value of that key.
6. If a `unique` list embeds an entity, give the embedded entity a `key` too. `unique` compares the keys.
7. Run `npx urn-forge compile`.

## Example

The insurance policy links to its customer and embeds a list of coverages. Each peril occurs one time at most:

```yaml
customer.entity.customer:
  description: A person who holds policies
  key: customer.field.customer_id
  fields:
    - ref: customer.field.customer_id
    - ref: customer.field.name
```

```yaml
policy.entity.coverage:
  description: One peril that a policy covers, up to a limit
  key: policy.field.peril
  fields:
    - ref: policy.field.peril
    - ref: policy.field.limit
    - ref: policy.field.note
      required: false
    - ref: policy.field.remark
      required: false
```

```yaml
    # The customer who holds the policy: the policy holds the customer's key.
    - link: customer.entity.customer
      as: holder
    # Each peril at most once: a list of coverage objects, unique by their key.
    - ref: policy.entity.coverage
      as: coverages
      many: { minItems: 1, maxItems: 3, unique: true }
```

`compile` uses the schema of the embedded entity, so each object gets its own checks:

```ts
  coverages: v.pipe(v.array(PolicyCoverageSchema), v.minLength(1), v.maxLength(3), v.check((list) => new Set(list.map((item) => item.peril)).size === list.length, 'Invalid items: Expected no peril more than once')),
```

If the target of a link has no `key`, `compile` stops:

```
insurance/domain.manifest.yaml:90:13  error  missing-key  urn:acme:insurance:policy:entity:policy: fields[1].link urn:acme:insurance:customer:entity:customer has no key, so a link to it holds nothing; set key on it
```

Two references that become one property name give `duplicate-property` or `duplicate-ref`. Give one of them a different name with `as`. Entities that embed each other give `embedding-cycle`. Change one `ref` in the cycle to `link`. For each code, refer to [Diagnostics](../reference/diagnostics).

urn-forge does not make sure that the target of a link exists. The shell must do that with its store.

## Result

`npx urn-forge compile` writes the files with no error. The entity has no effect until an operation, an error or a different entity uses it. Refer to [Add an operation](add-an-operation).

## Related pages

- [The manifest](../reference/manifest)
- [Write scenarios](write-scenarios)
- [Use branded values in the core](use-branded-values)
