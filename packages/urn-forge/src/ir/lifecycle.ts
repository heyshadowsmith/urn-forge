/**
 * Pass 8: lifecycle.
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
 *. Pass 8 refuses every live reference to a sunset atom, so the
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

/** A notice: a number of days or months. */
export interface Notice {
  readonly count: number;
  readonly unit: 'days' | 'months';
}

/** The notice of `6 months` or `180 days`, or undefined for any other text. */
export function parseNotice(text: string): Notice | undefined {
  const match = /^([1-9]\d*) (days?|months?)$/.exec(text);
  if (!match) return undefined;
  return { count: Number(match[1]), unit: match[2]!.startsWith('day') ? 'days' : 'months' };
}

/** The date `notice` after `date`, on the calendar: a month from a day that the next month lacks is that month's last day. */
export function addNotice(date: string, notice: Notice): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  if (notice.unit === 'days') return new Date(Date.UTC(year, month - 1, day + notice.count)).toISOString().slice(0, 10);
  const target = month - 1 + notice.count;
  const last = new Date(Date.UTC(year, target + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, target, Math.min(day, last))).toISOString().slice(0, 10);
}

/**
 * The notice before a removal, for each atom with a lifecycle.
 *
 * - With a notice: a sunset date is at least the notice after `deprecatedOn`, which it needs,
 *   and a sunset atom has a sunset date (`short-notice`).
 * - With a reference date: a sunset atom is not sunset before its sunset date (`early-sunset`).
 */
export function checkNotice(
  atoms: ReadonlyMap<Urn, { readonly lifecycle: Lifecycle; readonly path: ManifestPath }>,
  notice: { readonly text: string; readonly value: Notice } | undefined,
  referenceDate: string | undefined,
): IRIssue[] {
  const issues: IRIssue[] = [];
  for (const [urn, { lifecycle, path }] of atoms) {
    const { status, deprecatedOn, sunsetDate } = lifecycle;
    if (notice !== undefined) {
      const fail = (message: string) => issues.push({ code: 'short-notice', urn, path, message: `${urn}: ${message}` });
      if (sunsetDate === undefined) {
        if (status === 'sunset') fail(`a sunset atom has no sunsetDate; the notice of ${notice.text} ends on it`);
      } else if (deprecatedOn === undefined) {
        fail(`sunsetDate ${sunsetDate} has no deprecatedOn; the notice of ${notice.text} counts from the day the deprecation is announced`);
      } else {
        const earliest = addNotice(deprecatedOn, notice.value);
        if (sunsetDate < earliest) fail(`sunsetDate ${sunsetDate} is less than ${notice.text} after deprecatedOn ${deprecatedOn}; set it on or after ${earliest}`);
      }
    }
    if (status === 'sunset' && sunsetDate !== undefined && referenceDate !== undefined && sunsetDate > referenceDate) {
      issues.push({
        code: 'early-sunset',
        urn,
        path,
        message: `${urn}: status sunset before its sunset date ${sunsetDate} (the reference date is ${referenceDate}); keep it deprecated until then`,
      });
    }
  }
  return issues;
}
