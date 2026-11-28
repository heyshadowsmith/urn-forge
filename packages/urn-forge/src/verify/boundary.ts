/**
 * Gate 2: the boundary. The shell runs the core only through the harness, which checks each input
 * and each answer. Two rules, over the core files (the core and the files it imports from its own
 * directory) and the shell files (config `shell`):
 *
 * - `direct-call`: a shell file reads a function of the core (`core.seat_booking`), which skips the
 *   harness. Passing `core` to runOperation is the boundary.
 * - `suppressed-check`: `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck`, which can hide a broken contract.
 */
import { existsSync, realpathSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import type * as TS from 'typescript';
import { ts } from '../ts.js';
import { filesUnder } from '../files.js';
import { gateOutcome, type GateOutcome, type GateProblem } from './types.js';

const SOURCE = /\.(?:ts|tsx|mts|cts)$/u;

/** The source files under a path, by their real paths, as TypeScript gives the files of a program. */
function sourcesUnder(path: string): string[] {
  return filesUnder(path, (name) => SOURCE.test(name) && !name.endsWith('.d.ts')).map((file) => realpathSync(file));
}

export interface BoundaryOptions {
  readonly corePath: string;
  readonly generatedPath: string;
  readonly shell: readonly string[];
  readonly tsconfigPath: string;
  readonly show: (path: string) => string;
}

export function boundaryGate(options: BoundaryOptions, coreProgram: TS.Program | string): GateOutcome {
  const result = (_pass: boolean, summary: string, problems: GateProblem[]): GateOutcome => gateOutcome(2, summary, problems);
  if (typeof coreProgram === 'string') {
    return result(false, 'the tsconfig cannot be read', [{ code: 'tsconfig-unreadable', severity: 'error', file: options.show(options.tsconfigPath), message: coreProgram }]);
  }
  const coreDir = dirname(resolve(options.corePath)) + sep;
  const generated = resolve(options.generatedPath);
  const coreFiles = coreProgram
    .getSourceFiles()
    .map((s) => resolve(s.fileName))
    .filter((f) => f.startsWith(coreDir) && f !== generated && !f.includes(`${sep}node_modules${sep}`));
  const shellFiles = options.shell.flatMap(sourcesUnder).filter((f) => f !== generated && !coreFiles.includes(f));
  const program = shellFiles.length === 0 ? coreProgram : ts.createProgram({ rootNames: [...coreFiles, ...shellFiles], options: coreProgram.getCompilerOptions() });
  const checker = program.getTypeChecker();
  // A shell path that does not exist would check no file and pass: it is a problem of the gate.
  const problems: GateProblem[] = options.shell
    .filter((path) => !existsSync(path))
    .map((path) => ({ code: 'missing-input', severity: 'error', file: options.show(path), message: 'the shell path does not exist, so gate 2 would check no file of it' }));
  const at = (source: TS.SourceFile, position: number) => ({ file: options.show(source.fileName), line: source.getLineAndCharacterOfPosition(position).line + 1 });

  // The exports of the core: a shell that reads a property of one calls the core directly.
  const coreSource = program.getSourceFile(resolve(options.corePath));
  const coreExports = new Set<TS.Symbol>();
  if (coreSource) {
    const moduleSymbol = checker.getSymbolAtLocation(coreSource);
    for (const symbol of moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : []) coreExports.add(symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol);
  }

  for (const file of [...coreFiles, ...shellFiles]) {
    const source = program.getSourceFile(file);
    if (!source) continue;
    for (const match of source.text.matchAll(/@ts-(ignore|expect-error|nocheck)\b/g)) {
      problems.push({ code: 'suppressed-check', severity: 'error', ...at(source, match.index), message: `@ts-${match[1]} can hide a broken contract; fix the type error` });
    }
    if (!shellFiles.includes(file)) continue;
    const isCore = (expression: TS.Expression): boolean => {
      if (!ts.isIdentifier(expression)) return false;
      let symbol = checker.getSymbolAtLocation(expression);
      if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      return symbol !== undefined && coreExports.has(symbol);
    };
    const visit = (node: TS.Node): void => {
      // const { quote_shipping } = core takes a function of the core out of it, as core.quote_shipping does.
      if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer && isCore(node.initializer)) {
        problems.push({
          code: 'direct-call',
          severity: 'error',
          ...at(source, node.getStart()),
          message: `${node.getText()} takes a function of the core without the harness; call runOperation(${node.initializer.getText()}, …), which checks the input and the answer`,
        });
      }
      if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && ts.isIdentifier(node.expression)) {
        let symbol = checker.getSymbolAtLocation(node.expression);
        if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
        if (symbol && coreExports.has(symbol)) {
          problems.push({
            code: 'direct-call',
            severity: 'error',
            ...at(source, node.getStart()),
            message: `${node.getText()} runs the core without the harness; call runOperation(${node.expression.text}, …), which checks the input and the answer`,
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return result(problems.length === 0, `${coreFiles.length} core file(s), ${shellFiles.length} shell file(s): ${problems.length} problem(s)`, problems);
}
