/**
 * TypeScript, loaded on first use through require. TypeScript is one large CommonJS file: Node loads it
 * through require in about a third of the time of an ESM import, which parses it again to find its
 * exports (planning/startup-plan.md). A command that never reads it does not load it at all.
 */
import { createRequire } from 'node:module';
import type * as TS from 'typescript';

let loaded: typeof TS | undefined;

/** The TypeScript module; the first property read loads it. */
export const ts: typeof TS = new Proxy({} as typeof TS, {
  get: (_target, key) => Reflect.get((loaded ??= createRequire(import.meta.url)('typescript') as typeof TS), key),
});
