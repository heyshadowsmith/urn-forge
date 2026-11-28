/**
 * An error that urn-forge does not expect: the code internal-error, exit 3, one JSON object with
 * --format json, and no stack unless URN_FORGE_DEBUG asks for it.
 */
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../src/write.js', () => ({
  writeGenerated: () => {
    throw new TypeError('a value that urn-forge does not expect');
  },
}));

const { main } = await import('../src/cli.js');
const BOOKING = new URL('./fixtures/booking/', import.meta.url).pathname;

afterEach(() => {
  delete process.env['URN_FORGE_DEBUG'];
});

async function run(argv: string[]): Promise<{ code: number; out: string[]; err: string[] }> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: BOOKING, stdout: (t) => out.push(t), stderr: (t) => err.push(t) });
  return { code, out, err };
}

it('reports an unexpected error as internal-error, with exit 3 and one JSON object', async () => {
  const { code, out, err } = await run(['compile', '--format', 'json']);
  expect([code, err]).toEqual([3, []]);
  expect(out).toHaveLength(1);
  const report = JSON.parse(out[0]!) as { ok: boolean; problems: { code: string; message: string; fix: string }[] };
  expect(report.ok).toBe(false);
  expect(report.problems).toContainEqual(expect.objectContaining({ code: 'internal-error', message: 'a value that urn-forge does not expect', fix: expect.stringMatching(/^Report it in an issue/) }));
});

it('gives the stack on stderr only with URN_FORGE_DEBUG', async () => {
  const quiet = await run(['compile']);
  expect(quiet.code).toBe(3);
  expect(quiet.err.join('\n')).toMatch(/error  internal-error  a value that urn-forge does not expect/);
  expect(quiet.err.join('\n')).not.toMatch(/\n\s+at /);
  process.env['URN_FORGE_DEBUG'] = '1';
  const debug = await run(['compile']);
  expect(debug.err.join('\n')).toMatch(/TypeError: a value that urn-forge does not expect\n\s+at /);
});
