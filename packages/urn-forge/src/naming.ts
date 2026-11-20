/**
 * Names derived from an atom (spec §3, §7): its brand identifier and the exports generated
 * from it. Plugins read names from here, never from each other, so the Valibot and FCIS
 * output agree on type names without one plugin importing the other's internals.
 */

/** PascalCase of `context` + `identifier`: (`policy`, `deductible_amount`) → `PolicyDeductibleAmount`. */
export function toBrandIdentifier(context: string, identifier: string): string {
  return `${context}_${identifier}`
    .split('_')
    .filter((part) => part.length > 0)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
}

/** The schema module's exports for one field or entity: `<Brand>Schema`, `<Brand>` (parsed, branded) and `<Brand>Input`. */
export function schemaNames(brandIdentifier: string) {
  return {
    schema: `${brandIdentifier}Schema`,
    output: brandIdentifier,
    input: `${brandIdentifier}Input`,
  } as const;
}

/** The handler type of an operation: `<Brand>Handler`. */
export function handlerName(brandIdentifier: string): string {
  return `${brandIdentifier}Handler`;
}
