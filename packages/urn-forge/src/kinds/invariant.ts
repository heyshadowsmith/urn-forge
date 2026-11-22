import * as v from 'valibot';
import { Description, ShortKeyRef } from '../grammar.js';
import type { IREntity, IRField, IRInvariant, Urn } from '../ir/types.js';
import { checkRule, namesIn, parseRule, printRule, stripColumns, type RuleField } from '../rules/index.js';
import { defineKind } from './types.js';

const InvariantSchema = v.strictObject({
  description: Description,
  /** The one entity whose fields the rule names. */
  on: ShortKeyRef,
  rule: v.pipe(v.string(), v.minLength(1, 'must not be empty')),
  /** The issue message when the rule does not hold. */
  message: Description,
  /** The property that the issue goes on; by default, the first one that the rule names. */
  reportOn: v.optional(v.pipe(v.string(), v.minLength(1, 'must not be empty'))),
});
export type InvariantDecl = v.InferOutput<typeof InvariantSchema>;

/**
 * A named rule over the fields of one entity. The link to the entity is
 * `on` only: an entity does not list its invariants, so the two cannot disagree. The IR keeps
 * the parsed rule and its canonical text.
 */
export const invariant = defineKind<InvariantDecl, IRInvariant>()({
  name: 'invariant',
  group: 'invariants',
  article: 'an',
  schema: InvariantSchema,
  references: [{ path: ['on'], targets: ['entity'] }],
  // Pass 6 types the rule against the fields of its entity, so those nodes must exist first.
  after: ['field', 'entity'],
  build({ atom, shortKey, decl, ref, node, report }) {
    const on = ref(['on']);
    const parsed = parseRule(decl.rule);
    const at = (column: number) => `at column ${column} of the rule`;
    if (!parsed.ok) {
      report({ code: 'rule-syntax', urn: atom.urn, message: `${atom.urn}: rule: ${parsed.problem.message} (${at(parsed.problem.column)})`, path: [shortKey, 'rule'] });
      return undefined;
    }
    const entity = on && (node('entity', on.urn) as IREntity | undefined);
    if (!entity) return undefined; // pass 4 reported the reference
    const fields: Record<string, RuleField> = {};
    for (const ref of entity.fields) {
      if ('entity' in ref) {
        // An embedded object has no value to compare; a rule can only ask whether it is there.
        fields[ref.name] = { primitive: 'string', required: ref.required, many: ref.many !== undefined, embedded: true };
        continue;
      }
      // A link compares as its target's key.
      const fieldUrn = 'field' in ref ? ref.field : (node('entity', ref.link) as IREntity | undefined)?.key;
      const field = fieldUrn && (node('field', fieldUrn) as IRField | undefined);
      if (!field) continue;
      const values = field.primitive === 'enum' ? (field.constraints['values'] as readonly string[] | undefined) : undefined;
      fields[ref.name] = { primitive: field.primitive, required: ref.required, many: ref.many !== undefined, ...(values ? { values } : {}) };
    }
    // Pass 6: rule typing.
    const problems = checkRule(parsed.expr, fields);
    for (const problem of problems) {
      report({ code: problem.code, urn: atom.urn, message: `${atom.urn}: rule: ${problem.message} (${at(problem.column)})`, path: [shortKey, 'rule'] });
    }
    if (problems.length > 0) return undefined;
    const rule = stripColumns(parsed.expr);
    // reportOn: a property that the rule names, so the issue sends the caller to a field that can fix it.
    if (decl.reportOn !== undefined) {
      const named = namesIn(rule);
      if (!named.includes(decl.reportOn)) {
        const what = Object.hasOwn(fields, decl.reportOn) || entity.fields.some((f) => f.name === decl.reportOn) ? 'is a property that the rule does not name' : 'is not a property of the entity';
        report({
          code: 'invalid-report-on',
          urn: atom.urn,
          message: `${atom.urn}: reportOn "${decl.reportOn}" ${what}; name one of the properties in the rule (${named.join(', ')})`,
          path: [shortKey, 'reportOn'],
        });
        return undefined;
      }
    }
    return {
      urn: atom.urn,
      brandIdentifier: atom.brandIdentifier,
      description: decl.description,
      on: on!.urn as Urn,
      rule,
      ruleText: printRule(rule),
      message: decl.message,
      ...(decl.reportOn === undefined ? {} : { reportOn: decl.reportOn }),
    };
  },
});
