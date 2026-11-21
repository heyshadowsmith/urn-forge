# Add an entity

An entity is a named group of properties. A property holds the values of a field, an embedded entity, or a link to an entity. An operation uses one entity as its input and one as its output. This guide adds an entity to the manifest.

The examples in steps 4 to 6 come from `packages/urn-forge/insurance/`, which CI tests. A policy links to its customer and embeds a list of coverages.

## Before you start

- Declare each field that the entity uses. Refer to [Add a field](add-a-field).
- Declare each entity that the entity embeds or links to.
- Choose the short key of the entity: `<context>.entity.<identifier>`, for example `parcel.entity.parcel`.

## 1. Write the entity entry

Add the entry to `domain.manifest.yaml`. Give a `description` and a `fields` list:

```yaml
parcel.entity.parcel:
  description: A parcel to send
  fields:
    - ref: parcel.field.weight_grams
    - ref: parcel.field.zone
    - ref: parcel.field.express
      required: false
```

- `description` is necessary.
- `fields` must list at least one reference.
- Each `ref` is the short key of a field. A field from a different context is permitted.
- A reference has either `ref` or `link`, not the two. Steps 4 and 5 show `ref` to an entity and `link`.

If a reference has both `ref` and `link`, or neither, `compile` stops at pass 1:

```
insurance/domain.manifest.yaml:79:7  error  invalid-value  policy.entity.policy.fields.1: must have either ref or link
```

For the full rules, refer to [The manifest](../reference/manifest).

## 2. Make a field optional

A field reference is required by default. To make it optional, add `required: false` to the reference.

The `required` key belongs to the reference, not to the field. Thus, one field can be required in one entity and optional in a different entity.

In the generated types, an optional field is an optional property. In the core, read it as a value that can be `undefined`:

<<< @/../packages/urn-forge/tutorial/1-first-domain/core.ts{7,12}

## 3. Make a field a list

A field holds one value. To make a property hold a list of values of the field, add `many` to the field reference. Like `required`, `many` belongs to the reference, not to the field.

The starter project of `urn-forge init` has a list of names:

```yaml
bill.field.people:
  primitive: string
  minLength: 1
  description: The name of a person who shares the bill
```

```yaml
bill.entity.split_request:
  description: A bill to split between people
  fields:
    - ref: bill.field.total_cents
    # A list of names: 1 to 10 people, each one once.
    - ref: bill.field.people
      many: { minItems: 1, maxItems: 10, unique: true }
```

- `many: true` makes a list with no limits.
- `minItems` and `maxItems` limit the number of items. They are inclusive.
- `unique: true` refuses a list that has one value two times.
- Each item must also be a valid value of the field. Here, each name must have at least one character.

`required: false` says that the list can be absent. `minItems: 0`, or no `minItems`, says that the list can be empty.

`compile` writes the list as `v.array` of the field schema, with the item count and the check of `unique`:

```ts
export const BillSplitRequestSchema = v.object({
  total_cents: BillTotalCentsSchema,
  people: v.pipe(v.array(BillPeopleSchema), v.minLength(1), v.maxLength(10), v.check((list) => new Set(list).size === list.length, 'Invalid items: Expected no value more than once')),
});
```

In the core, the property is an array of branded values, for example `people.length`.

If `minItems` is greater than `maxItems`, `compile` stops:

```
domain.manifest.yaml:27:13  error  incoherent-constraints  urn:app:starter:bill:entity:split_request: fields[1] minItems (10) is greater than maxItems (1), so no list is valid
```

An error can also have a list field. But the `message` of an error cannot name it in a placeholder:

```
domain.manifest.yaml:37:12  error  unknown-placeholder  urn:app:starter:bill:error:uneven_split: message placeholder {people} names a list; placeholders must name single values (required fields: total_cents, people)
```

If the list is in an input, gate 3 asks for scenarios that send each limit. The items count as values of the field, so the field constraints also need their boundary values. If no scenario sends a list that breaks a rule, `verify` shows the gaps:

```
features  error  uncovered-boundary  urn:app:starter:bill:field:people in the input of urn:app:starter:bill:operation:split has no value of length 0 (below minLength), no list of 0 item(s) (below minItems), no list of 11 item(s) (above maxItems), no list with a repeated value (unique)
```

To write a list in a table cell, refer to [Write scenarios](write-scenarios).

## 4. Embed an entity

To make a property hold an object of a different entity, write `ref` with the short key of that entity. The object is embedded: the property holds all its fields.

The insurance policy holds a list of coverages:

```yaml
policy.entity.coverage:
  description: One peril that a policy covers, up to a limit
  key: policy.field.peril
  fields:
    - ref: policy.field.peril
    - ref: policy.field.limit
    - ref: policy.field.note
      required: false
```

```yaml
    # Each peril at most once: a list of coverage objects, unique by their key.
    - ref: policy.entity.coverage
      as: coverages
      many: { minItems: 1, maxItems: 3, unique: true }
```

- `as` gives the property name. Without `as`, the name is the identifier of the target, here `coverage`.
- `required` and `many` apply as they do to a field.
- The embedded entity keeps its invariants. They run inside each object. Refer to [Add an invariant](add-an-invariant).
- To write an object in a table cell, refer to [Write scenarios](write-scenarios).

`compile` uses the schema of the embedded entity, so each object gets its own checks:

```ts
  coverages: v.pipe(v.array(PolicyCoverageSchema), v.minLength(1), v.maxLength(3), v.check((list) => new Set(list.map((item) => item.peril)).size === list.length, 'Invalid items: Expected no peril more than once')),
```

### Give the entity a key for a `unique` list

Objects have no equality of their own. Thus, `unique` on a list of entities compares the keys of the objects. The embedded entity must have a `key`. Here, `key: policy.field.peril` makes each peril occur one time at most.

If the entity has no `key`, `compile` stops:

```
insurance/domain.manifest.yaml:83:13  error  missing-key  urn:acme:insurance:policy:entity:policy: fields[2] is a unique list of urn:acme:insurance:policy:entity:coverage, which has no key to compare; set key on it
```

To fix it, add `key` to the embedded entity. Step 5 gives the rules of a key.

If the list is in an input, gate 3 asks for the item counts and for a list with a repeated key. The fields of the embedded entity also need their boundary values, at any depth. Refer to [Adopt strict coverage](adopt-strict-coverage).

### Do not embed in a cycle

An entity cannot embed itself, directly or through other entities. The type of the object would never end. Here, the coverage embeds the policy, and the policy embeds the coverage:

```
insurance/domain.manifest.yaml:69:5  error  embedding-cycle  urn:acme:insurance:policy:entity:coverage: urn:acme:insurance:policy:entity:coverage embeds urn:acme:insurance:policy:entity:policy embeds urn:acme:insurance:policy:entity:coverage, so its type would never end; use a link for one of them
```

To fix it, change one of the references in the cycle to `link`. Links can form a cycle, because a link holds only a value.

## 5. Link to an entity

To make a property point at an object of a different entity, write `link` with the short key of that entity. The property holds the value of the `key` of the target, not the object.

1. Give the target entity a `key`:

   ```yaml
   customer.entity.customer:
     description: A person who holds policies
     key: customer.field.customer_id
     fields:
       - ref: customer.field.customer_id
       - ref: customer.field.name
   ```

2. Add the `link` to the entity that points at the target:

   ```yaml
       # The customer who holds the policy: the policy holds the customer's key.
       - link: customer.entity.customer
         as: holder
   ```

The `holder` property uses the schema and the brand of `customer.field.customer_id`. Thus, the core can give a customer identifier to it, and `tsc` refuses the identifier of a different entity. Refer to [Use branded values in the core](use-branded-values).

urn-forge does not make sure that the target object exists. The shell must do that with its store.

### Make the key correct

The `key` must name one of the fields of the entity itself. The field reference must be required and single-valued.

If the target of a link has no `key`, `compile` stops:

```
insurance/domain.manifest.yaml:78:13  error  missing-key  urn:acme:insurance:policy:entity:policy: fields[1].link urn:acme:insurance:customer:entity:customer has no key, so a link to it holds nothing; set key on it
```

If the `key` names an optional field, `compile` stops with `invalid-entity-key`. Here the key of the coverage is `policy.field.note`:

```
insurance/domain.manifest.yaml:67:8  error  invalid-entity-key  urn:acme:insurance:policy:entity:coverage: key urn:acme:insurance:policy:field:note is optional; a key must be required
```

A key that is not a field of the entity gives the same code. Here the key is `policy.field.premium`:

```
insurance/domain.manifest.yaml:67:8  error  invalid-entity-key  urn:acme:insurance:policy:entity:coverage: key urn:acme:insurance:policy:field:premium is not a field of the entity
```

To fix it, set `key` to a field that the `fields` list has, without `required: false` and without `many`.

An entity needs a `key` only if an entity links to it, or if a `unique` list embeds it.

## 6. Make sure that the property names are different

Each reference becomes a property of the entity. The property name is the value of `as`. Without `as`, it is the identifier of the target, without the context. For example, `parcel.field.weight_grams` becomes the property `weight_grams`.

Thus, two references with the same identifier cannot be in one entity, even if their contexts are different. Here the coverage lists `policy.field.note` and `customer.field.note`:

```yaml
    - ref: policy.field.note
      required: false
    - ref: customer.field.note
      required: false
```

`compile` stops with this error:

```
insurance/domain.manifest.yaml:76:12  error  duplicate-property  urn:acme:insurance:policy:entity:coverage: fields[3].ref urn:acme:insurance:customer:field:note and urn:acme:insurance:policy:field:note both become property "note"; rename one with as
```

To correct it, give one of the references a different name with `as`, for example `as: customer_note`.

If you list one target two times, the error is `duplicate-ref`. For example, a policy with two links to a customer, a holder and a payer, needs `as` on each link. Without it, both links become the property `customer`:

```
insurance/domain.manifest.yaml:80:13  error  duplicate-ref  urn:acme:insurance:policy:entity:policy: fields[2].link lists urn:acme:insurance:customer:entity:customer more than once; give one of them another name with as
```

To correct it, add `as: holder` to one link and `as: payer` to the other.

## 7. Compile

Run this command:

```bash
npx urn-forge compile
```

`compile` writes a schema and two types for the entity. The schema of an entity comes after the schemas of the entities that it embeds. For their names, refer to [The generated schemas](../reference/generated-schemas).

## 8. Use the entity

An entity has no effect until an operation, an error or a different entity uses it. Use it as the `input` or the `output` of an operation. Refer to [Add an operation](add-an-operation).

If you add a field to an entity that is already in use, update the scenarios. Refer to step 6 of [Add a field](add-a-field).

## Result

`npx urn-forge compile` writes the files with no error, and `npx urn-forge verify` passes.

## Related pages

- [The manifest](../reference/manifest)
- [URNs and names](../reference/naming)
- [Add a field](add-a-field)
- [Write scenarios](write-scenarios)
