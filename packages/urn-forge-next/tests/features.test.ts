/**
 * The steps of urn-forge on the booking fixture: Cucumber runs its features with the generated file
 * and the core.
 */
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { loadConfiguration, runCucumber } from '@cucumber/cucumber/api';
import { expect, it } from 'vitest';

it('the features of the booking fixture pass', async () => {
  const cwd = fileURLToPath(new URL('./fixtures/booking', import.meta.url));
  const { runConfiguration } = await loadConfiguration(
    {
      provided: {
        paths: ['features/**/*.feature'],
        import: [fileURLToPath(new URL('../src/gherkin/register-tsx.mjs', import.meta.url)), 'features/support/**/*.ts'],
        format: ['summary'],
        strict: true,
      },
    },
    { cwd },
  );
  const output: string[] = [];
  const stream = new PassThrough();
  stream.on('data', (chunk: Buffer) => output.push(chunk.toString()));
  const { success } = await runCucumber(runConfiguration, { cwd, stdout: stream, stderr: stream });
  expect(success, output.join('')).toBe(true);
  expect(output.join('')).toMatch(/^29 scenarios \(29 passed\)$/m);
}, 30_000);
