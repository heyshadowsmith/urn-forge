/**
 * Gate 1: implementation completeness (spec §8).
 *
 * 1. `tsc --noEmit` over the core entry, using the project's tsconfig options. Because the
 *    core uses `satisfies DomainCoreImplementation`, a missing or mistyped handler is a
 *    type error.
 * 2. The core file must export a value whose initializer is `… satisfies DomainCoreImplementation`
 *    (`export const`, a `const` exported later with `export { … }`, or `export default`),
 *    and that name must resolve to the interface in the generated runtime file, not a
 *    look-alike declared elsewhere. Without this check, deleting the `satisfies` clause
 *    would silently switch the gate off.
 */
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';
import { FCIS_RUNTIME_FILE } from '../plugins/fcis.plugin.js';
import { generatedPath } from '../write.js';
import type { Diagnostic } from '../diagnostics.js';
import { displayPath, type Gate, type GateOutcome } from './types.js';

export interface CompletenessOptions {
  readonly cwd: string;
  readonly corePath: string;
  readonly outDir: string;
  readonly tsconfigPath: string;
}

const REGISTRY = 'DomainCoreImplementation';

function sameFile(a: string, b: string): boolean {
  const normalize = (p: string) => (ts.sys.useCaseSensitiveFileNames ? resolve(p) : resolve(p).toLowerCase());
  return normalize(a) === normalize(b);
}

function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

/** Names of the core file's exports that `satisfies` the generated registry. */
function satisfyingExports(source: ts.SourceFile, checker: ts.TypeChecker, runtimeFile: string): string[] {
  const isGeneratedRegistry = (node: ts.TypeNode): boolean => {
    if (!ts.isTypeReferenceNode(node)) return false;
    const name = ts.isQualifiedName(node.typeName) ? node.typeName.right : node.typeName;
    if (name.text !== REGISTRY) return false;
    let symbol = checker.getSymbolAtLocation(name);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return (symbol?.declarations ?? []).some((d) => sameFile(d.getSourceFile().fileName, runtimeFile));
  };
  const satisfies = (initializer: ts.Expression | undefined): boolean => {
    if (!initializer) return false;
    const expression = unwrap(initializer);
    return ts.isSatisfiesExpression(expression) && isGeneratedRegistry(expression.type);
  };

  // Top-level `const` declarations that satisfy the registry, exported or not, so that
  // `const core = … satisfies …; export { core };` counts. A `let` can be reassigned, so it does not.
  const satisfyingConsts = new Set<string>();
  const found: string[] = [];
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Const)) continue;
    const exported = ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !satisfies(declaration.initializer)) continue;
      satisfyingConsts.add(declaration.name.text);
      if (exported) found.push(declaration.name.text);
    }
  }
  const namesSatisfyingConst = (expression: ts.Expression): boolean => {
    const inner = unwrap(expression);
    return ts.isIdentifier(inner) && satisfyingConsts.has(inner.text);
  };
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement) && !statement.moduleSpecifier && !statement.isTypeOnly && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) {
        if (element.isTypeOnly) continue;
        if (satisfyingConsts.has((element.propertyName ?? element.name).text)) found.push(element.name.text);
      }
    } else if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      if (satisfies(statement.expression) || namesSatisfyingConst(statement.expression)) found.push('default');
    }
  }
  return found;
}

export function checkCompleteness(options: CompletenessOptions): GateOutcome {
  const show = (path: string) => displayPath(options.cwd, path, relative);
  const fail = (problem: Diagnostic, summary: string): GateOutcome => ({ summary, problems: [problem] });

  const config = ts.readConfigFile(options.tsconfigPath, ts.sys.readFile);
  if (config.error) {
    return fail(
      {
        code: 'tsconfig-unreadable',
        severity: 'error',
        file: show(options.tsconfigPath),
        message: ts.flattenDiagnosticMessageText(config.error.messageText, '\n'),
      },
      'tsconfig unreadable',
    );
  }
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(options.tsconfigPath));
  const program = ts.createProgram({ rootNames: [options.corePath], options: { ...parsed.options, noEmit: true } });

  const source = program.getSourceFile(options.corePath);
  if (!source) {
    return fail(
      { code: 'core-not-found', severity: 'error', file: show(options.corePath), message: 'core entry not found' },
      'core entry missing',
    );
  }

  const problems: Diagnostic[] = ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.category === ts.DiagnosticCategory.Error)
    .map((d) => {
      const message = `TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`;
      if (!d.file) return { code: 'type-error', severity: 'error', file: show(options.tsconfigPath), message };
      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
      return {
        code: 'type-error',
        severity: 'error',
        file: show(d.file.fileName),
        location: { line: line + 1, column: character + 1 },
        message,
      };
    });
  const typeErrors = problems.length;

  const runtimeFile = generatedPath(options.outDir, FCIS_RUNTIME_FILE);
  const exportsFound = satisfyingExports(source, program.getTypeChecker(), runtimeFile);
  if (exportsFound.length === 0) {
    problems.push({
      code: 'missing-satisfies',
      severity: 'error',
      file: show(options.corePath),
      message:
        `no export uses \`satisfies ${REGISTRY}\` from ${show(runtimeFile)}; ` +
        `declare the core as \`export const core = { … } satisfies ${REGISTRY};\``,
    });
  }

  const summary =
    `tsc: ${typeErrors} error(s) over ${show(options.corePath)}; ` +
    (exportsFound.length > 0 ? `\`${exportsFound.join(', ')}\` satisfies ${REGISTRY}` : `no \`satisfies ${REGISTRY}\``);
  return { summary, problems };
}

export const completenessGate: Gate = { number: 1, name: 'completeness', run: checkCompleteness };
