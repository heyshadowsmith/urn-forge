/**
 * Pass 8: lifecycle (spec §6; lifecycle plan, decisions 4 and 5).
 *
 * - A reference from an active atom to a deprecated atom is `deprecated-ref`, a warning.
 *   A deprecated atom that uses another deprecated atom gets none: both are retiring.
 * - A reference from an active or deprecated atom to a sunset atom, or to an atom whose
 *   `sunsetDate` is on or before the reference date, is `sunset-ref`, an error.
 * - A sunset atom may refer to anything: it generates nothing.
 *
 * The reference date comes from the CLI or the config, never from the clock, so one commit
 * always gives one verdict. Without it, sunset dates are not checked.
 */
import type { ManifestPath } from '../diagnostics.js';
import type { IRIssue, Lifecycle, UniversalIR, Urn } from './types.js';

/** One reference that pass 4 resolved. */
export interface Reference {
  readonly from: Urn;
  readonly to: Urn;
  readonly path: ManifestPath;
  /** `fields[0].ref`, `input`. */
  readonly label: string;
}

/** "superseded by <urn>; sunset on <date>", or nothing. */
function plans(target: Lifecycle): string {
  const parts = [target.supersededBy ? `superseded by ${target.supersededBy}` : undefined, target.sunsetDate ? `sunset on ${target.sunsetDate}` : undefined].filter(Boolean);
  return parts.length > 0 ? ` (${parts.join('; ')})` : '';
}

export function checkLifecycle(
  references: readonly Reference[],
  lifecycles: ReadonlyMap<Urn, Lifecycle | undefined>,
  referenceDate: string | undefined,
): IRIssue[] {
  const issues: IRIssue[] = [];
  for (const { from, to, path, label } of references) {
    const source = lifecycles.get(from)?.status ?? 'active';
    const target = lifecycles.get(to);
    if (source === 'sunset' || target === undefined) continue;
    const where = `${from}: ${label} refers to ${to}`;
    if (target.status === 'sunset') {
      issues.push({ code: 'sunset-ref', urn: from, path, message: `${where}, which is sunset${plans(target)}; refer to its replacement` });
    } else if (target.sunsetDate !== undefined && referenceDate !== undefined && target.sunsetDate <= referenceDate) {
      issues.push({
        code: 'sunset-ref',
        urn: from,
        path,
        message: `${where}, whose sunset date ${target.sunsetDate} is on or before the reference date ${referenceDate}${plans({ status: target.status, ...(target.supersededBy ? { supersededBy: target.supersededBy } : {}) })}; refer to its replacement`,
      });
    } else if (target.status === 'deprecated' && source === 'active') {
      issues.push({ code: 'deprecated-ref', urn: from, path, severity: 'warning', message: `${where}, which is deprecated${plans(target)}` });
    }
  }
  return issues;
}

/**
 * The IR without its sunset atoms: what the plugins generate from and the gates check
 * (lifecycle plan, decision 6). Pass 8 refuses every live reference to a sunset atom, so the
 * live IR has no reference that dangles. It depends on `status` only, never on a date.
 */
export function liveIr(ir: UniversalIR): UniversalIR {
  const live = <T extends { readonly lifecycle?: Lifecycle }>(nodes: Readonly<Record<Urn, T>>): Readonly<Record<Urn, T>> =>
    Object.fromEntries(Object.entries(nodes).filter(([, node]) => node.lifecycle?.status !== 'sunset')) as Readonly<Record<Urn, T>>;
  return { ...ir, fields: live(ir.fields), entities: live(ir.entities), invariants: live(ir.invariants), operations: live(ir.operations), events: live(ir.events), errors: live(ir.errors) };
}

/** Whether any atom has a sunset date: then a missing reference date means a check that does not run. */
export function hasSunsetDates(ir: UniversalIR): boolean {
  return [ir.fields, ir.entities, ir.invariants, ir.operations, ir.events, ir.errors].some((group) => Object.values(group).some((node) => node.lifecycle?.sunsetDate !== undefined));
}
