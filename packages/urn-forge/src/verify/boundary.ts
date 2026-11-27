/**
 * Gate 2: the boundary. The shell runs the core only through the harness, which checks each input
 * and each answer. Two rules, over the core files (the core and the files it imports from its own
 * directory) and the shell files (config `shell`):
 *
 * - `direct-call`: a shell file reads a function of the core (`core.seat_booking`), which skips the
 *   harness. Passing `core` to runOperation is the boundary.
 * - `suppressed-check`: `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck`, which can hide a broken contract.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import ts from 'typescript';
import { gateOutcome, type GateOutcome, type GateProblem } from './types.js';

const SOURCE = /\.(?:ts|tsx|mts|cts)$/u;

function sourcesUnder(path: string): string[] {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [resolve(path)];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.name === 'node_modules' || entry.name.startsWith('.')
      ? []
      : entry.isDirectory()
        ? sourcesUnder(join(path, entry.name))
        : SOURCE.test(entry.name) && !entry.name.endsWith('.d.ts')
          ? [resolve(path, entry.name)]
          : [],
  );
}

export interface BoundaryOptions {
  readonly corePath: string;
  readonly generatedPath: string;
  readonly shell: readonly string[];
  readonly tsconfigPath: string;
  readonly show: (path: string) => string;
}

export function boundaryGate(options: BoundaryOptions, coreProgram: ts.Program | string): GateOutcome {
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
  const problems: GateProblem[] = [];
  const at = (source: ts.SourceFile, position: number) => ({ file: options.show(source.fileName), line: source.getLineAndCharacterOfPosition(position).line + 1 });

  // The exports of the core: a shell that reads a property of one calls the core directly.
  const coreSource = program.getSourceFile(resolve(options.corePath));
  const coreExports = new Set<ts.Symbol>();
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
    const isCore = (expression: ts.Expression): boolean => {
      if (!ts.isIdentifier(expression)) return false;
      let symbol = checker.getSymbolAtLocation(expression);
      if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      return symbol !== undefined && coreExports.has(symbol);
    };
    const visit = (node: ts.Node): void => {
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
