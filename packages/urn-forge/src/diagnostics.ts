/** The place of a value in a manifest, as a path of keys and list indexes. */
export type Path = readonly (string | number)[];

/** A problem in a manifest: a code, its place as a path of keys, and a message. */
export interface Diagnostic {
  readonly code: string;
  readonly severity: 'error' | 'warning';
  readonly path: Path;
  readonly message: string;
  /** The line, when the path cannot give it: a YAML error. */
  readonly line?: number;
}

/** Collects the diagnostics of one load. */
export class Diagnostics {
  readonly list: Diagnostic[] = [];

  error(code: string, path: Path, message: string, line?: number): void {
    this.list.push({ code, severity: 'error', path, message, ...(line ? { line } : {}) });
  }

  warning(code: string, path: Path, message: string): void {
    this.list.push({ code, severity: 'warning', path, message });
  }

  get hasErrors(): boolean {
    return this.list.some((d) => d.severity === 'error');
  }
}

/** A path as text, for a message: `definitions.booking.rules.1`. */
export function showPath(path: Path): string {
  return path.join('.');
}
