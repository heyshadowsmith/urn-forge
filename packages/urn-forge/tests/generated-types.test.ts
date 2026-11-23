/**
 * The generated files type-check as a user's own tsc checks them: strict, with each fixture's
 * expected files and each corpus contract's generated files. Gate 1 checks only the core, so a type
 * error in a generated file that the core does not import would pass every gate.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const here = fileURLToPath(new URL('.', import.meta.url));
const fixtures = join(here, 'fixtures');
const contracts = join(here, '../../../contracts');
const generated = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.generated.ts')).map((f) => join(dir, f)) : []);
const dirs = [
  ...readdirSync(fixtures).map((name) => join(fixtures, name, 'expected')),
  ...(existsSync(contracts) ? readdirSync(contracts).map((name) => join(contracts, name, 'src', 'generated')) : []),
].filter((dir) => generated(dir).length > 0);

describe('the generated files type-check', () => {
  it.each(dirs.map((dir) => [dir.slice(join(here, '../../..').length + 1), dir]))('%s', (_name, dir) => {
    const program = ts.createProgram(generated(dir), {
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      skipLibCheck: true,
      types: ['node'],
    });
    const problems = ts.getPreEmitDiagnostics(program).map((d) => `${d.file ? `${d.file.fileName.slice(dir.length + 1)}: ` : ''}${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
    expect(problems).toEqual([]);
  }, 60_000);
});
