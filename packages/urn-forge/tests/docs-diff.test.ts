/**
 * The `urn-forge diff` examples of the docs (check-compatibility, retire-a-urn, emit-an-event).
 * Each example is one change to the current insurance manifest. This test makes the old and the
 * new manifest from that change, runs `diff` as a person does, and requires the page to quote
 * the output exactly. A change to insurance or to `diff` that changes an example fails here.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { main } from '../src/cli.js';

const repo = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const page = (name: string) => readFile(repo(`../../docs/${name.includes('/') ? name : `how-to/${name}`}.md`), 'utf8');

/** `text` with each `[from, to]` replaced once; a `from` that is not there fails the test. */
function edit(text: string, ...pairs: (readonly [string, string])[]): string {
  return pairs.reduce((s, [from, to]) => {
    if (!s.includes(from)) throw new Error(`the insurance manifest changed: "${from.slice(0, 60)}" is not in it`);
    return s.replace(from, to);
  }, text);
}

const NOTE_DEPRECATED = '  status: deprecated\n  supersededBy: policy.field.remark\n';
const REMARK = 'policy.field.remark:\n  primitive: string\n  maxLength: 40\n  description: Free text about a coverage, at most 40 characters\n';
const REMARK_REF = '    - ref: policy.field.remark\n      required: false\n';
const NOTE_REF = '    - ref: policy.field.note\n      required: false\n';
const CANCEL_ERRORS = '    - policy.error.refund_below_minimum\n  emits: [policy.event.policy_cancelled]\n';

/** Each example: the old manifest, the new manifest, with or without the config, and the pages that quote it. */
const EXAMPLES: Record<string, { old: (m: string) => string; now: (m: string) => string; config?: false; pages: readonly string[] }> = {
  // Insurance before remark: note active, no remark. The change that check-compatibility step 1 and retire-a-urn step 3 show.
  'deprecate note for remark': {
    old: (m) => edit(m, ['  # Retired for remark, which is limited in length (lifecycle plan). Callers receive both until the sunset.\n' + NOTE_DEPRECATED + '  sunsetDate: 2027-06-30\n', ''], [REMARK, ''], [REMARK_REF, '']),
    now: (m) => m,
    pages: ['check-compatibility', 'retire-a-urn', 'reference/cli'],
  },
  'a tighter maxLength': { old: (m) => m, now: (m) => edit(m, ['  maxLength: 40\n', '  maxLength: 30\n']), pages: ['check-compatibility'] },
  'a looser maxLength': { old: (m) => m, now: (m) => edit(m, ['  maxLength: 40\n', '  maxLength: 50\n']), pages: ['check-compatibility'] },
  'a new declared error': {
    old: (m) => m,
    now: (m) =>
      edit(m, [CANCEL_ERRORS, '    - policy.error.refund_below_minimum\n    - policy.error.policy_already_cancelled\n  emits: [policy.event.policy_cancelled]\n']) +
      '\npolicy.error.policy_already_cancelled:\n  description: The policy was cancelled before\n  category: conflict\n  retryable: false\n  message: The policy is already cancelled\n',
    pages: ['check-compatibility'],
  },
  'a stored field, with the config': { old: (m) => m, now: (m) => edit(m, ['  minLength: 1\n  description: The full name', '  minLength: 2\n  description: The full name']), pages: ['check-compatibility'] },
  'a stored field, without the config': {
    old: (m) => m,
    now: (m) => edit(m, ['  minLength: 1\n  description: The full name', '  minLength: 2\n  description: The full name']),
    config: false,
    pages: ['check-compatibility'],
  },
  'deprecate remark for short_remark': {
    old: (m) => m,
    now: (m) =>
      edit(
        m,
        [REMARK, `${REMARK}  status: deprecated\n  supersededBy: policy.field.short_remark\n  sunsetDate: 2027-12-31\npolicy.field.short_remark:\n  primitive: string\n  maxLength: 30\n  description: Free text about a coverage, at most 30 characters\n`],
        [REMARK_REF, `${REMARK_REF}    - ref: policy.field.short_remark\n      required: false\n`],
      ),
    pages: ['check-compatibility'],
  },
  'sunset note': { old: (m) => m, now: (m) => edit(m, [NOTE_DEPRECATED, '  status: sunset\n  supersededBy: policy.field.remark\n'], [NOTE_REF, '']), pages: ['retire-a-urn'] },
  'delete the sunset note': {
    old: (m) => edit(m, [NOTE_DEPRECATED, '  status: sunset\n  supersededBy: policy.field.remark\n'], [NOTE_REF, '']),
    now: (m) =>
      edit(
        m,
        [NOTE_REF, ''],
        ['policy.field.note:\n  primitive: string\n  description: Free text about a coverage\n  # Retired for remark, which is limited in length (lifecycle plan). Callers receive both until the sunset.\n' + NOTE_DEPRECATED + '  sunsetDate: 2027-06-30\n', ''],
      ),
    pages: ['retire-a-urn'],
  },
  'a new enum value': { old: (m) => m, now: (m) => edit(m, ['  values: [fire, flood, theft]\n', '  values: [fire, flood, theft, hail]\n']), pages: ['check-compatibility'] },
  'rename a required input field in place': {
    old: (m) => m,
    now: (m) =>
      edit(
        m,
        ['    - ref: policy.field.cancellation_date\npolicy.entity.refund_quote:', '    - ref: policy.field.stop_date\npolicy.entity.refund_quote:'],
        ['  rule: cancellation_date >= effective_date and cancellation_date <= expiry_date', '  rule: stop_date >= effective_date and stop_date <= expiry_date'],
      ) + '\npolicy.field.stop_date:\n  primitive: date\n  description: The first day that the policy does not cover\n',
    pages: ['retire-a-urn'],
  },
  'rename a required input field with a new operation': {
    old: (m) => m,
    now: (m) =>
      edit(m, [
        'policy.operation.cancel_policy:\n  description: Stop a policy and calculate the refund for the days it does not cover\n',
        'policy.operation.cancel_policy:\n  description: Stop a policy and calculate the refund for the days it does not cover\n  status: deprecated\n  supersededBy: policy.operation.stop_policy\n  sunsetDate: 2027-12-31\n',
      ]) +
      '\npolicy.field.stop_date:\n  primitive: date\n  description: The first day that the policy does not cover\n' +
      'policy.entity.stop_request:\n  description: A request to stop a policy, with the terms it needs\n  fields:\n    - ref: policy.field.effective_date\n    - ref: policy.field.expiry_date\n    - ref: policy.field.premium\n    - ref: policy.field.stop_date\n' +
      'policy.invariant.stop_within_term:\n  description: A policy can stop only on a day that it covers\n  on: policy.entity.stop_request\n  rule: stop_date >= effective_date and stop_date <= expiry_date\n  reportOn: stop_date\n  message: The stop date must be inside the term of the policy\n' +
      'policy.operation.stop_policy:\n  description: Stop a policy and calculate the refund for the days it does not cover\n  input: policy.entity.stop_request\n  output: policy.entity.refund_quote\n  errors:\n    - policy.error.refund_below_minimum\n  emits: [policy.event.policy_cancelled]\n',
    pages: ['retire-a-urn'],
  },
  'a new event in emits': { old: (m) => edit(m, [CANCEL_ERRORS, '    - policy.error.refund_below_minimum\n']), now: (m) => m, pages: ['emit-an-event'] },
  'an event removed from emits': { old: (m) => m, now: (m) => edit(m, [CANCEL_ERRORS, '    - policy.error.refund_below_minimum\n']), pages: ['emit-an-event'] },
};

describe('the diff examples of the docs', () => {
  let dir: string;
  let manifest: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'urn-forge-docs-diff-'));
    manifest = await readFile(repo('insurance/domain.manifest.yaml'), 'utf8');
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it.each(Object.entries(EXAMPLES))('%s', async (name, example) => {
    const [oldPath, newPath] = [join(dir, `${name}.old.yaml`), join(dir, `${name}.new.yaml`)];
    await writeFile(oldPath, example.old(manifest));
    await writeFile(newPath, example.now(manifest));
    const lines: string[] = [];
    const config = example.config === false ? repo('tests/diff/no-config.ts') : repo('insurance/urn-forge.config.ts');
    await main(['diff', oldPath, newPath, '--config', config], { cwd: dir, stdout: (l) => lines.push(l), stderr: (l) => lines.push(l) });
    const output = lines.join('\n');
    expect(output).toMatch(/^diff (passed|failed): /m);
    for (const name of example.pages) expect(await page(name), `docs/how-to/${name}.md quotes this output`).toContain(`\`\`\`\n${output}\n\`\`\``);
  });
});
