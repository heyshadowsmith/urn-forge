/**
 * Gate 2: boundary discipline (spec §8; gate 2 plan). No branded value is forged outside the
 * generated parsers. Four rules run on the type checker, over the core files (the core entry
 * and the files that it imports in its own directory) and the shell files (config `shell`):
 *
 * - `brand-assertion`: a type assertion whose target type carries a brand.
 * - `brand-from-any`: an expression of type `any` where the type carries a brand.
 * - `suppressed-check`: `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck`.
 * - `core-parser-import`: a value import of the generated schemas or of `valibot` in a core file.
 *
 * `as const`, an assertion to a type with no brand, and a type import are not forging.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import type { Diagnostic, DiagnosticCode } from '../diagnostics.js';
import { VALIBOT_SCHEMAS_FILE } from '../plugins/valibot.plugin.js';
import { generatedPath } from '../write.js';
import { programFor } from './completeness.js';
import { displayPath, type Gate, type GateContext, type GateOutcome } from './types.js';

/** How deep the brand test looks into objects, arrays and unions; recursive types stop here. */
const BRAND_DEPTH = 4;

const SOURCE = /\.(?:ts|tsx|mts|cts)$/u;

/** Every source file under a path: the file itself, or each one in the directory, at any depth. */
function sourcesUnder(path: string): string[] {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [resolve(path)];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.name === 'node_modules' || entry.name.startsWith('.') ? [] : entry.isDirectory() ? sourcesUnder(join(path, entry.name)) : SOURCE.test(entry.name) && !entry.name.endsWith('.d.ts') ? [resolve(path, entry.name)] : [],
  );
}

/** Whether a type carries Valibot's brand, through unions, intersections, arrays, tuples and properties. */
function carriesBrand(checker: ts.TypeChecker, type: ts.Type, depth = 0, seen = new Set<ts.Type>()): boolean {
  if (depth > BRAND_DEPTH || seen.has(type)) return false;
  seen.add(type);
  if (type.isUnionOrIntersection()) return type.types.some((t) => carriesBrand(checker, t, depth + 1, seen));
  if (!(type.flags & ts.TypeFlags.Object)) return false;
  for (const property of type.getProperties()) {
    // Valibot's Brand<Name> has one property, keyed by its unique symbol BrandSymbol.
    if (String(property.escapedName).startsWith('__@BrandSymbol')) return true;
  }
  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    return checker.getTypeArguments(type as ts.TypeReference).some((t) => carriesBrand(checker, t, depth + 1, seen));
  }
  // An object with branded properties: a function or a class is not a value to forge.
  if (type.getCallSignatures().length > 0 || type.getConstructSignatures().length > 0) return false;
  return type.getProperties().some((property) => {
    const declaration = property.valueDeclaration ?? property.declarations?.[0];
    if (!declaration) return false;
    return carriesBrand(checker, checker.getTypeOfSymbolAtLocation(property, declaration), depth + 1, seen);
  });
}

const SUPPRESSION = /(?:\/\/|\/\*)\s*@ts-(ignore|expect-error|nocheck)\b/gu;

export function checkBoundary(context: GateContext): GateOutcome {
  const show = (path: string) => displayPath(context.cwd, path, relative);
  const generatedDir = resolve(context.outDir) + sep;
  const schemasFile = resolve(generatedPath(context.outDir, VALIBOT_SCHEMAS_FILE));
  const coreDir = resolve(dirname(context.corePath)) + sep;

  // The core files: the core entry and what it imports in its own directory (gate 1's program).
  const coreProgram = programFor(context);
  if (!coreProgram) return { summary: 'not run: gate 1 could not build the program', problems: [] };
  const ours = (file: ts.SourceFile) => !file.isDeclarationFile && !file.fileName.includes(`${sep}node_modules${sep}`) && !resolve(file.fileName).startsWith(generatedDir);
  const coreFiles = new Set(coreProgram.getSourceFiles().filter((f) => ours(f) && resolve(f.fileName).startsWith(coreDir)).map((f) => resolve(f.fileName)));
  const shellFiles = new Set((context.shellPaths ?? []).flatMap(sourcesUnder).filter((f) => !coreFiles.has(f) && !f.startsWith(generatedDir)));

  // One program for both sets, built on gate 1's, so the core files are not checked twice.
  const program = shellFiles.size === 0 ? coreProgram : ts.createProgram([...coreProgram.getRootFileNames(), ...shellFiles], coreProgram.getCompilerOptions(), undefined, coreProgram);
  const checker = program.getTypeChecker();
  const problems: Diagnostic[] = [];

  for (const fileName of [...coreFiles, ...shellFiles]) {
    const source = program.getSourceFile(fileName);
    if (!source) continue;
    const inCore = coreFiles.has(fileName);
    const report = (code: DiagnosticCode, node: ts.Node | number, message: string) => {
      const position = typeof node === 'number' ? node : node.getStart(source);
      const { line, character } = source.getLineAndCharacterOfPosition(position);
      problems.push({ code, severity: 'error', file: show(fileName), location: { line: line + 1, column: character + 1 }, message });
    };
    const text = (node: ts.Node) => {
      const raw = node.getText(source).replace(/\s+/gu, ' ');
      return raw.length > 60 ? `${raw.slice(0, 57)}…` : raw;
    };

    /** The branded type an any meets, as the code writes it when it does: an annotation or a return type. */
    const expectedText = (node: ts.Node, expected: ts.Type): string => {
      const parent = node.parent;
      if (ts.isVariableDeclaration(parent) && parent.type) return text(parent.type);
      if (ts.isReturnStatement(parent) || ts.isArrowFunction(parent)) {
        const fn = ts.findAncestor(parent, ts.isFunctionLike);
        if (fn?.type) return text(fn.type);
      }
      const written = checker.typeToString(expected);
      return written.length > 60 ? `${written.slice(0, 57)}…` : written;
    };

    for (const match of source.text.matchAll(SUPPRESSION)) {
      report('suppressed-check', match.index, `@ts-${match[1]} turns off a type check, which could hide a forged brand; correct the type instead`);
    }

    const visit = (node: ts.Node): void => {
      // A type assertion to a branded type: `x as T`, `<T>x`. `as const` is not one.
      if ((ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) && !(ts.isTypeReferenceNode(node.type) && node.type.getText(source) === 'const')) {
        const target = checker.getTypeFromTypeNode(node.type);
        if (carriesBrand(checker, target)) {
          report('brand-assertion', node, `${text(node)} asserts the branded type ${text(node.type)}; only a generated parser makes a branded value`);
        }
      }
      // An any where a branded type belongs: an assignment, a return, an argument, a property.
      if (ts.isExpression(node) && !ts.isParenthesizedExpression(node.parent) && checker.getTypeAtLocation(node).flags & ts.TypeFlags.Any) {
        const expected = checker.getContextualType(node);
        if (expected && carriesBrand(checker, expected)) {
          report('brand-from-any', node, `${text(node)} is any where the branded type ${expectedText(node, expected)} belongs; parse the value with a generated schema in the shell`);
        }
      }
      // The core receives branded values and returns plain ones: it never parses.
      if (inCore && ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const clause = node.importClause;
        const typeOnly = !clause || clause.isTypeOnly || (!clause.name && clause.namedBindings !== undefined && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.every((e) => e.isTypeOnly));
        const specifier = node.moduleSpecifier.text;
        const resolved = ts.resolveModuleName(specifier, fileName, program.getCompilerOptions(), ts.sys).resolvedModule?.resolvedFileName;
        const parser = specifier === 'valibot' || (resolved !== undefined && resolve(resolved) === schemasFile);
        if (parser && !typeOnly) {
          report('core-parser-import', node, `the core imports ${specifier} as a value, which can make branded values; the core receives branded input and returns plain output, so import types only (import type)`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return {
    summary: `${coreFiles.size} core file(s), ${shellFiles.size} shell file(s): ${problems.length} problem(s)`,
    problems,
  };
}

export const boundaryGate: Gate = { number: 2, name: 'boundary', run: checkBoundary };
