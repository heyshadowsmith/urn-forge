# Add an entity

An entity is a named group of fields. An operation uses one entity as its input and one as its output. This guide adds an entity to the manifest.

## Before you start

- Declare each field that the entity uses. Refer to [Add a field](add-a-field).
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
- `fields` must list at least one field.
- Each `ref` is the short key of a field. A field from a different context is permitted.

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

## 4. Make sure that the property names are different

Each field becomes a property of the entity. The property name is the identifier of the field, without the context. For example, `parcel.field.weight_grams` becomes the property `weight_grams`.

Thus, two fields with the same identifier cannot be in one entity, even if their contexts are different:

```yaml
order.entity.line:
  description: One line of an order
  fields:
    - ref: order.field.note
    - ref: customer.field.note
```

`compile` stops with this error:

```
bad-entity.yaml:15:12  error  duplicate-property  urn:demo:shop:order:entity:line: fields[1].ref urn:demo:shop:customer:field:note and urn:demo:shop:order:field:note both become property "note"
```

To correct it, give one of the fields a different identifier, for example `customer.field.customer_note`. A field that you list two times gives the error `duplicate-ref`.

## 5. Compile

Run this command:

```bash
npx urn-forge compile
```

`compile` writes a schema and two types for the entity. For their names, refer to [The generated schemas](../reference/generated-schemas).

## 6. Use the entity

An entity has no effect until an operation or an error uses it. Use it as the `input` or the `output` of an operation. Refer to [Add an operation](add-an-operation).

If you add a field to an entity that is already in use, update the scenarios. Refer to step 6 of [Add a field](add-a-field).

## Result

`npx urn-forge compile` writes the files with no error, and `npx urn-forge verify` passes.

## Related pages

- [The manifest](../reference/manifest)
- [URNs and names](../reference/naming)
- [Add a field](add-a-field)
- [Add an operation](add-an-operation)
- [Write scenarios](write-scenarios)
