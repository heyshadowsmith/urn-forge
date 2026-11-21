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

## 3. Make sure that the property names are different

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

## 4. Compile

Run this command:

```bash
npx urn-forge compile
```

`compile` writes a schema and two types for the entity. For their names, refer to [The generated schemas](../reference/generated-schemas).

## 5. Use the entity

An entity has no effect until an operation or an error uses it. Use it as the `input` or the `output` of an operation. Refer to [Add an operation](add-an-operation).

If you add a field to an entity that is already in use, update the scenarios. Refer to step 6 of [Add a field](add-a-field).

## Result

`npx urn-forge compile` writes the files with no error, and `npx urn-forge verify` passes.

## Related pages

- [The manifest](../reference/manifest)
- [URNs and names](../reference/naming)
- [Add a field](add-a-field)
- [Add an operation](add-an-operation)
- [Diagnostics](../reference/diagnostics)
