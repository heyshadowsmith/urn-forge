/**
 * What gate 3 needs about properties at any depth (structure plan): the shape a cell reader
 * uses, and the invariants that hold inside an entity, its embedded entities included.
 */
import type { PropertyShape } from '../gherkin/cells.js';
import { invariantsOf, valueField, type IREntity, type IRInvariant, type IRPropertyRef, type UniversalIR, type Urn } from '../ir/types.js';

/** The shape of a property: its value field's primitive, or its embedded entity's properties. */
export function propertyShape(ir: UniversalIR, ref: IRPropertyRef): PropertyShape | undefined {
  const many = ref.many !== undefined;
  if ('entity' in ref) {
    const entity = ir.entities[ref.entity];
    return entity && { entity: entity.urn, many, fields: entityShape(ir, entity) };
  }
  const fieldUrn = valueField(ir, ref);
  const field = fieldUrn && ir.fields[fieldUrn];
  return field ? { primitive: field.primitive, many } : undefined;
}

export function entityShape(ir: UniversalIR, entity: IREntity): Record<string, PropertyShape> {
  const shapes: Record<string, PropertyShape> = {};
  for (const ref of entity.fields) {
    const shape = propertyShape(ir, ref);
    if (shape) shapes[ref.name] = shape;
  }
  return shapes;
}

/** The invariants of an entity and of each entity it embeds, at any depth, each once. */
export function invariantsWithin(ir: UniversalIR, entityUrn: Urn, seen = new Set<Urn>()): IRInvariant[] {
  const entity = ir.entities[entityUrn];
  if (!entity || seen.has(entityUrn)) return [];
  seen.add(entityUrn);
  return [...invariantsOf(ir, entityUrn), ...entity.fields.flatMap((ref) => ('entity' in ref ? invariantsWithin(ir, ref.entity, seen) : []))];
}

/** The property name of an entity's key, if it has one. */
export function keyName(entity: IREntity | undefined): string | undefined {
  return entity?.fields.find((f) => 'field' in f && f.field === entity.key)?.name;
}
