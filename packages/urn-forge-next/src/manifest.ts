/**
 * Reads the YAML of a manifest into its parts, and checks the shape of each part: the keys, and the
 * type of each value. Names between the parts are checked later, in the model.
 */
import { isMap, parseDocument } from 'yaml';
import type { Diagnostics, Path } from './diagnostics.js';

/** The types of JSON Schema. A definition can also name another definition as its type. */
export const BASE_TYPES = ['string', 'number', 'integer', 'boolean', 'object', 'array'] as const;
export type BaseType = (typeof BASE_TYPES)[number];

/** A rule applied by name (a rule of the manifest, or a standard rule such as `minLength`), with its argument when the rule has parameters: `- even` or `- minimum: 1`. */
export interface RuleUse {
  readonly rule: string;
  /** Present when the use gives an argument: `- minimum: 1`. */
  readonly argument?: { readonly value: unknown };
  readonly path: Path;
}

export interface ManifestHeader {
  readonly namespace: string;
  readonly domain: string;
  readonly version: string;
  readonly compatibility?: { readonly callers: 'ignore-unknown' };
}

export interface DefinitionDecl {
  readonly name: string;
  readonly description: string;
  readonly type: string;
  readonly properties?: readonly string[];
  readonly items?: string;
  readonly identifier?: string;
  readonly rules: readonly RuleUse[];
  readonly deprecated: boolean;
  readonly path: Path;
}

export interface RuleDecl {
  readonly name: string;
  readonly description: string;
  readonly parameters: readonly string[];
  readonly text: string;
  readonly message: string;
  readonly deprecated: boolean;
  readonly path: Path;
}

export interface OutputDecl {
  readonly object: string;
  readonly rules: readonly RuleUse[];
  readonly path: Path;
}

export interface OperationDecl {
  readonly name: string;
  readonly description: string;
  readonly input: string;
  readonly outputs: readonly OutputDecl[];
  readonly rules: readonly RuleUse[];
  readonly deprecated: boolean;
  readonly path: Path;
}

export interface ManifestDecl {
  readonly header: ManifestHeader;
  readonly definitions: readonly DefinitionDecl[];
  readonly rules: readonly RuleDecl[];
  readonly operations: readonly OperationDecl[];
}

/** The name of a part, and of a namespace and a domain. */
export const NAME = /^[a-z][a-z0-9_]{0,62}$/;
/** The name of a rule: also the camelCase names of JSON Schema, such as `minLength`. */
export const RULE_NAME = /^[a-z][A-Za-z0-9_]{0,62}$/;
/** A semver version, with an optional pre-release and build. */
export const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The checks of the shape of one manifest, which report to `diagnostics`. */
class Reader {
  constructor(private readonly diagnostics: Diagnostics) {}

  /** A value of the wrong shape: `manifest-shape`. */
  shape(path: Path, message: string): void {
    this.diagnostics.error('manifest-shape', path, message);
  }

  /** A map with only the keys of `allowed`, and each key of `required`. */
  map(value: unknown, path: Path, allowed: readonly string[], required: readonly string[]): Record<string, unknown> | undefined {
    if (!isRecord(value)) {
      this.shape(path, `${show(path)} must be a map`);
      return undefined;
    }
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) this.shape([...path, key], `${show([...path, key])} is not a key here; the keys are ${allowed.join(', ')}`);
    }
    for (const key of required) {
      if (!Object.hasOwn(value, key)) this.shape([...path, key], `${show(path)} needs ${key}`);
    }
    return value;
  }

  text(value: unknown, path: Path): string | undefined {
    if (typeof value === 'string' && value.trim() !== '') return value;
    this.shape(path, `${show(path)} must be text that is not empty`);
    return undefined;
  }

  name(value: unknown, path: Path, pattern: RegExp = NAME): string | undefined {
    if (typeof value === 'string' && pattern.test(value)) return value;
    this.shape(path, `${show(path)} must be a name that matches ${pattern.source}`);
    return undefined;
  }

  names(value: unknown, path: Path, pattern: RegExp = NAME): string[] | undefined {
    if (!Array.isArray(value)) {
      this.shape(path, `${show(path)} must be a list of names`);
      return undefined;
    }
    const names: string[] = [];
    value.forEach((item, index) => {
      const name = this.name(item, [...path, index], pattern);
      if (name !== undefined) names.push(name);
    });
    return names;
  }

  flag(value: unknown, path: Path): boolean {
    if (value === undefined) return false;
    if (typeof value === 'boolean') return value;
    this.shape(path, `${show(path)} must be true or false`);
    return false;
  }

  /** `- even` or `- minimum: 1`: a name, or a map of one name to its argument. */
  ruleUses(value: unknown, path: Path): RuleUse[] {
    if (value === undefined) return [];
    if (!Array.isArray(value)) {
      this.shape(path, `${show(path)} must be a list of rule names, each with its argument where the rule has parameters`);
      return [];
    }
    const uses: RuleUse[] = [];
    value.forEach((item, index) => {
      const at = [...path, index];
      if (typeof item === 'string') {
        const rule = this.name(item, at, RULE_NAME);
        if (rule !== undefined) uses.push({ rule, path: at });
      } else if (isRecord(item) && Object.keys(item).length === 1) {
        const [key, argument] = Object.entries(item)[0]!;
        const rule = this.name(key, at, RULE_NAME);
        if (rule !== undefined) uses.push({ rule, argument: { value: argument }, path: at });
      } else {
        this.shape(at, `${show(at)} must be a rule name, or a map of one rule name to its argument`);
      }
    });
    return uses;
  }
}

function show(path: Path): string {
  return path.length === 0 ? 'the manifest' : path.join('.');
}

/** Reads the parts of a manifest. Undefined when the YAML does not parse or the header is wrong. */
export function readManifest(text: string, diagnostics: Diagnostics, options: { readonly ruleName?: RegExp } = {}): ManifestDecl | undefined {
  const document = parseDocument(text, { uniqueKeys: true });
  if (document.errors.length > 0) {
    for (const error of document.errors) diagnostics.error('yaml-syntax', [], error.message);
    return undefined;
  }
  if (!isMap(document.contents)) {
    diagnostics.error('manifest-shape', [], 'the manifest must be a map');
    return undefined;
  }
  const root: Json = document.toJS() as Json;
  const read = new Reader(diagnostics);
  const top = read.map(root, [], ['manifest', 'definitions', 'rules', 'operations'], ['manifest']);
  if (!top) return undefined;

  const header = readHeader(read, top['manifest']);
  if (!header) return undefined;

  const sections = { definitions: [] as DefinitionDecl[], rules: [] as RuleDecl[], operations: [] as OperationDecl[] };
  for (const section of ['definitions', 'rules', 'operations'] as const) {
    const value = top[section];
    if (value === undefined) continue;
    if (!isRecord(value)) {
      diagnostics.error('manifest-shape', [section], `${section} must be a map of names to their parts`);
      continue;
    }
    for (const [name, decl] of Object.entries(value)) {
      const path: Path = [section, name];
      if (read.name(name, path, section === 'rules' ? options.ruleName ?? NAME : NAME) === undefined) continue;
      if (section === 'definitions') {
        const definition = readDefinition(read, name, decl, path);
        if (definition) sections.definitions.push(definition);
      } else if (section === 'rules') {
        const rule = readRule(read, name, decl, path);
        if (rule) sections.rules.push(rule);
      } else {
        const operation = readOperation(read, name, decl, path);
        if (operation) sections.operations.push(operation);
      }
    }
  }
  return { header, ...sections };
}

function readHeader(read: Reader, value: unknown): ManifestHeader | undefined {
  const path = ['manifest'];
  const header = read.map(value, path, ['namespace', 'domain', 'version', 'compatibility'], ['namespace', 'domain', 'version']);
  if (!header) return undefined;
  const namespace = read.name(header['namespace'], [...path, 'namespace']);
  const domain = read.name(header['domain'], [...path, 'domain']);
  const version = typeof header['version'] === 'string' && SEMVER.test(header['version']) ? header['version'] : undefined;
  if (version === undefined) read.shape([...path, 'version'], `${show([...path, 'version'])} must be a semver version, such as 0.1.0`);
  let compatibility: ManifestHeader['compatibility'];
  if (header['compatibility'] !== undefined) {
    const at = [...path, 'compatibility'];
    const map = read.map(header['compatibility'], at, ['callers'], ['callers']);
    if (map && map['callers'] === 'ignore-unknown') compatibility = { callers: 'ignore-unknown' };
    else if (map) read.shape([...at, 'callers'], `${show([...at, 'callers'])} must be ignore-unknown`);
  }
  if (namespace === undefined || domain === undefined || version === undefined) return undefined;
  return { namespace, domain, version, ...(compatibility ? { compatibility } : {}) };
}

function readDefinition(read: Reader, name: string, value: unknown, path: Path): DefinitionDecl | undefined {
  const decl = read.map(value, path, ['description', 'type', 'properties', 'items', 'identifier', 'rules', 'deprecated'], ['description', 'type']);
  if (!decl) return undefined;
  const description = read.text(decl['description'], [...path, 'description']);
  const type = read.name(decl['type'], [...path, 'type']);
  const rules = read.ruleUses(decl['rules'], [...path, 'rules']);
  const deprecated = read.flag(decl['deprecated'], [...path, 'deprecated']);
  if (description === undefined || type === undefined) return undefined;

  // properties and identifier belong to type: object; items to type: array.
  const only = (key: string, base: BaseType): boolean => {
    if (decl[key] === undefined) return true;
    if (type === base) return true;
    read.shape([...path, key], `${show([...path, key])} is only for a definition of type: ${base}`);
    return false;
  };
  const properties = decl['properties'] !== undefined && only('properties', 'object') ? read.names(decl['properties'], [...path, 'properties']) : undefined;
  const items = decl['items'] !== undefined && only('items', 'array') ? read.name(decl['items'], [...path, 'items']) : undefined;
  const identifier = decl['identifier'] !== undefined && only('identifier', 'object') ? read.name(decl['identifier'], [...path, 'identifier']) : undefined;
  if (type === 'object' && decl['properties'] === undefined) read.shape([...path, 'properties'], `${show(path)} is of type: object, so it needs properties`);
  if (type === 'array' && decl['items'] === undefined) read.shape([...path, 'items'], `${show(path)} is of type: array, so it needs items`);

  return {
    name,
    description,
    type,
    ...(properties ? { properties } : {}),
    ...(items ? { items } : {}),
    ...(identifier ? { identifier } : {}),
    rules,
    deprecated,
    path,
  };
}

function readRule(read: Reader, name: string, value: unknown, path: Path): RuleDecl | undefined {
  const decl = read.map(value, path, ['description', 'parameters', 'rule', 'message', 'deprecated'], ['description', 'rule', 'message']);
  if (!decl) return undefined;
  const description = read.text(decl['description'], [...path, 'description']);
  const parameters = decl['parameters'] === undefined ? [] : read.names(decl['parameters'], [...path, 'parameters']);
  const text = read.text(decl['rule'], [...path, 'rule']);
  const message = read.text(decl['message'], [...path, 'message']);
  const deprecated = read.flag(decl['deprecated'], [...path, 'deprecated']);
  if (description === undefined || parameters === undefined || text === undefined || message === undefined) return undefined;
  return { name, description, parameters, text, message, deprecated, path };
}

function readOperation(read: Reader, name: string, value: unknown, path: Path): OperationDecl | undefined {
  const decl = read.map(value, path, ['description', 'input', 'output', 'rules', 'deprecated'], ['description', 'input', 'output']);
  if (!decl) return undefined;
  const description = read.text(decl['description'], [...path, 'description']);
  const input = read.name(decl['input'], [...path, 'input']);
  const rules = read.ruleUses(decl['rules'], [...path, 'rules']);
  const deprecated = read.flag(decl['deprecated'], [...path, 'deprecated']);
  const outputs: OutputDecl[] = [];
  const outputPath = [...path, 'output'];
  if (!Array.isArray(decl['output']) || decl['output'].length === 0) {
    read.shape(outputPath, `${show(outputPath)} must be a list of one or more objects, each with its rules`);
  } else {
    decl['output'].forEach((entry, index) => {
      const at = [...outputPath, index];
      // `- booking: [rules]`, or `- booking` with no rules of its own.
      if (typeof entry === 'string') {
        const object = read.name(entry, at);
        if (object !== undefined) outputs.push({ object, rules: [], path: at });
      } else if (isRecord(entry) && Object.keys(entry).length === 1) {
        const [key, uses] = Object.entries(entry)[0]!;
        const object = read.name(key, at);
        const rules = read.ruleUses(uses ?? [], [...at, key]);
        if (object !== undefined) outputs.push({ object, rules, path: at });
      } else {
        read.shape(at, `${show(at)} must be the name of an object, or a map of one object name to its rules`);
      }
    });
  }
  if (description === undefined || input === undefined) return undefined;
  return { name, description, input, outputs, rules, deprecated, path };
}
