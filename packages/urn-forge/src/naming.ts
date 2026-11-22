/**
 * Names derived from an atom: its brand identifier and the exports generated
 * from it. Plugins read names from here, never from each other, so the Valibot and FCIS
 * output agree on type names without one plugin importing the other's internals.
 */

/** The six segments of a URN. */
export interface UrnParts {
  readonly namespace: string;
  readonly domain: string;
  readonly context: string;
  readonly kind: string;
  readonly identifier: string;
}

/** `urn:<namespace>:<domain>:<context>:<kind>:<identifier>`. */
export function toUrn({ namespace, domain, context, kind, identifier }: UrnParts): string {
  return `urn:${namespace}:${domain}:${context}:${kind}:${identifier}`;
}

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

/** The exported function of an invariant's rule: `<Brand>Rule`. */
export function ruleName(brandIdentifier: string): string {
  return `${brandIdentifier}Rule`;
}

/** The exported function of a condition of an operation: `<Brand>Requires<n>` or `<Brand>Ensures<n>`, from 1. */
export function conditionName(brandIdentifier: string, kind: 'requires' | 'ensures', index: number): string {
  return `${brandIdentifier}${kind === 'requires' ? 'Requires' : 'Ensures'}${index + 1}`;
}

/** The handler type of an operation: `<Brand>Handler`. */
export function handlerName(brandIdentifier: string): string {
  return `${brandIdentifier}Handler`;
}
