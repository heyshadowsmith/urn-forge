/**
 * Gate 1: the core is complete. tsc type-checks the core with the project's tsconfig, and the core
 * exports a value that `satisfies DomainCore` of the generated file. A missing or wrongly typed
 * function of an operation is then a type error. Without the second check, deleting `satisfies`
 * would switch the gate off.
 */
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { gateOutcome, type GateOutcome, type GateProblem } from './types.js';

export interface CoreOptions {
  readonly corePath: string;
  readonly generatedPath: string;
  readonly tsconfigPath: string;
  /** A path as the output shows it. */
  readonly show: (path: string) => string;
}

/** The program of the core, with the project's tsconfig, or the error of the tsconfig. */
export function coreProgram(options: CoreOptions): ts.Program | string {
  const config = ts.readConfigFile(options.tsconfigPath, ts.sys.readFile);
  if (config.error) return ts.flattenDiagnosticMessageText(config.error.messageText, '\n');
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(options.tsconfigPath));
  return ts.createProgram({ rootNames: [options.corePath], options: { ...parsed.options, noEmit: true } });
}

function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current)) current = current.expression;
  return current;
}

/** The exported names of the core whose value `satisfies DomainCore` of the generated file. */
function satisfyingExports(source: ts.SourceFile, checker: ts.TypeChecker, generatedPath: string): string[] {
  const satisfies = (expression: ts.Expression | undefined): boolean => {
    if (!expression) return false;
    const inner = unwrap(expression);
    if (!ts.isSatisfiesExpression(inner) || !ts.isTypeReferenceNode(inner.type)) return false;
    let symbol = checker.getSymbolAtLocation(inner.type.typeName);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return symbol?.name === 'DomainCore' && (symbol.declarations ?? []).some((d) => resolve(d.getSourceFile().fileName) === resolve(generatedPath));
  };
  const found: string[] = [];
  const satisfying = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const exported = ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !satisfies(declaration.initializer)) continue;
      satisfying.add(declaration.name.text);
      if (exported) found.push(declaration.name.text);
    }
  }
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement) && !statement.moduleSpecifier && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) if (satisfying.has((element.propertyName ?? element.name).text)) found.push(element.name.text);
    } else if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      const inner = unwrap(statement.expression);
      if (satisfies(statement.expression) || (ts.isIdentifier(inner) && satisfying.has(inner.text))) found.push('default');
    }
  }
  return found;
}

export function completenessGate(options: CoreOptions, program: ts.Program | string): GateOutcome {
  const result = (_pass: boolean, summary: string, problems: GateProblem[]): GateOutcome => gateOutcome(1, summary, problems);
  if (typeof program === 'string') {
    return result(false, 'the tsconfig cannot be read', [{ code: 'tsconfig-unreadable', severity: 'error', file: options.show(options.tsconfigPath), message: program }]);
  }
  const source = program.getSourceFile(options.corePath);
  if (!source) return result(false, 'no core', [{ code: 'core-not-found', severity: 'error', file: options.show(options.corePath), message: 'the core file does not exist' }]);
  const problems: GateProblem[] = ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.category === ts.DiagnosticCategory.Error)
    .map((d) => {
      const message = `TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`;
      if (!d.file) return { code: 'type-error', severity: 'error' as const, file: options.show(options.tsconfigPath), message };
      return { code: 'type-error', severity: 'error' as const, file: options.show(d.file.fileName), line: d.file.getLineAndCharacterOfPosition(d.start ?? 0).line + 1, message };
    });
  const exported = satisfyingExports(source, program.getTypeChecker(), options.generatedPath);
  if (exported.length === 0) {
    problems.push({
      code: 'core-not-satisfying',
      severity: 'error',
      file: options.show(options.corePath),
      message: 'the core exports no value that satisfies DomainCore of the generated file: export const core = { … } satisfies DomainCore',
    });
  }
  const errors = problems.length;
  return result(errors === 0, `tsc: ${errors} error(s) over ${options.show(options.corePath)}${exported.length > 0 ? `; ${exported.join(', ')} satisfies DomainCore` : ''}`, problems);
}
