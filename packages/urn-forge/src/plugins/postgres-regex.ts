/**
 * JavaScript regular expressions as Postgres regular expressions.
 *
 * The two dialects differ, so a pattern is copied only through a subset that this module can
 * rewrite to mean exactly the same: literals, `.`, bracket classes, quantifiers, anchors,
 * groups and `|`. Where Postgres differs, the output spells the JavaScript meaning out:
 *
 * - `\d`, `\w` and `\s` become ASCII classes: in Postgres they also match other scripts.
 * - `.` becomes "any character but a line terminator": in Postgres it also matches `\n`.
 * - The `i` flag becomes the operator `~*`.
 *
 * Anything else (lookaround, back references, `\b`, `\p{…}`, a negated class escape inside
 * a bracket, more than 255 repetitions) is refused, with the reason, and the plugin reports
 * it as `unenforced-in-sql`.
 */

/** The JavaScript `\s` set, as Postgres escapes. */
const SPACE = '\\t\\n\\u000b\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff';
const CLASS_ESCAPES: Readonly<Record<string, string>> = { d: '0-9', w: 'A-Za-z0-9_', s: SPACE };
/** The JavaScript `.` without the `s` flag: anything but a line terminator. */
const ANY = '[^\\n\\r\\u2028\\u2029]';
/** Postgres refuses a bound above this (RE_DUP_MAX). */
const MAX_REPEAT = 255;
const CONTROL_ESCAPES: Readonly<Record<string, string>> = { n: '\\n', r: '\\r', t: '\\t', f: '\\f', v: '\\u000b', '0': '' };

export type RegexTranslation =
  | { readonly ok: true; readonly pattern: string; readonly caseInsensitive: boolean }
  | { readonly ok: false; readonly reason: string };

class Refused extends Error {}

/** `\uXXXX` for one code point (a `\U` escape for one outside the Basic Multilingual Plane). */
function codePointEscape(codePoint: number): string {
  return codePoint > 0xffff ? `\\U${codePoint.toString(16).padStart(8, '0')}` : `\\u${codePoint.toString(16).padStart(4, '0')}`;
}

/** A literal character outside a bracket, escaped where it is special in Postgres. */
function literal(char: string): string {
  return /[\\^$.[\]()|*+?{}]/u.test(char) ? `\\${char}` : char;
}

/** A literal character inside a bracket. */
function bracketLiteral(char: string): string {
  return /[\\\]^[-]/u.test(char) ? `\\${char}` : char;
}

/**
 * Translates `source` (a JavaScript pattern in Unicode mode, with `flags`) into a Postgres
 * pattern with the same meaning, or says why it cannot.
 */
export function translateRegex(source: string, flags = 'u'): RegexTranslation {
  const other = flags.replace(/[ui]/gu, '');
  if (other !== '') return { ok: false, reason: `the flag "${other}" has no translation` };
  const chars = [...source];
  let i = 0;

  const escape = (inBracket: boolean): string => {
    const c = chars[i + 1];
    if (c === undefined) throw new Refused('a pattern cannot end with "\\"');
    i += 2;
    if (c in CLASS_ESCAPES) return inBracket ? CLASS_ESCAPES[c]! : `[${CLASS_ESCAPES[c]}]`;
    if (c === 'D' || c === 'W' || c === 'S') {
      if (inBracket) throw new Refused(`"\\${c}" inside a bracket has no translation`);
      return `[^${CLASS_ESCAPES[c.toLowerCase()]}]`;
    }
    if (c in CONTROL_ESCAPES) {
      if (c === '0') throw new Refused('"\\0" has no translation');
      return CONTROL_ESCAPES[c]!;
    }
    if (c === 'u') {
      const braced = /^\{([0-9a-fA-F]{1,6})\}/u.exec(chars.slice(i).join(''));
      const plain = /^[0-9a-fA-F]{4}/u.exec(chars.slice(i).join(''));
      const hex = braced ? braced[1]! : plain ? plain[0] : undefined;
      if (hex === undefined) throw new Refused('a "\\u" escape is not complete');
      i += (braced ? braced[0] : plain![0]).length;
      return codePointEscape(Number.parseInt(hex, 16));
    }
    if (c === 'x') {
      const hex = /^[0-9a-fA-F]{2}/u.exec(chars.slice(i).join(''));
      if (!hex) throw new Refused('a "\\x" escape is not complete');
      i += 2;
      return codePointEscape(Number.parseInt(hex[0], 16));
    }
    // In Unicode mode, an escape of anything but syntax is an error, so only syntax is left.
    if (/[\\^$.[\]()|*+?{}/-]/u.test(c)) return inBracket ? bracketLiteral(c) : literal(c);
    throw new Refused(`"\\${c}" has no translation`);
  };

  const bracket = (): string => {
    i += 1;
    let out = '[';
    if (chars[i] === '^') {
      out += '^';
      i += 1;
    }
    let first = true;
    for (;;) {
      const c = chars[i];
      if (c === undefined) throw new Refused('a bracket has no "]"');
      if (c === ']' && !first) {
        i += 1;
        // An empty negated class in JavaScript matches any character; Postgres has no such class.
        if (out === '[^') throw new Refused('"[^]" has no translation');
        return `${out}]`;
      }
      if (c === ']') throw new Refused('"[]" has no translation');
      if (c === '[') throw new Refused('"[" inside a bracket has no translation');
      out += c === '\\' ? escape(true) : (i++, c === '-' ? '-' : bracketLiteral(c));
      first = false;
    }
  };

  const quantifier = (): string => {
    const c = chars[i];
    let out = '';
    if (c === '*' || c === '+' || c === '?') {
      out = c;
      i += 1;
    } else if (c === '{') {
      const match = /^\{(\d+)(,(\d*))?\}/u.exec(chars.slice(i).join(''));
      if (!match) return '';
      const counts = [match[1], match[3]].filter((n) => n !== undefined && n !== '').map(Number);
      if (counts.some((n) => n > MAX_REPEAT)) throw new Refused(`a count above ${MAX_REPEAT} has no translation`);
      out = match[0];
      i += match[0].length;
    } else {
      return '';
    }
    // A lazy quantifier matches the same whole values as a greedy one.
    if (chars[i] === '?') i += 1;
    return out;
  };

  const sequence = (depth: number): string => {
    let out = '';
    for (;;) {
      const c = chars[i];
      if (c === undefined) {
        if (depth > 0) throw new Refused('a group has no ")"');
        return out;
      }
      if (c === ')') {
        if (depth === 0) throw new Refused('a ")" has no "("');
        return out;
      }
      let atom: string;
      if (c === '|') {
        i += 1;
        out += '|';
        continue;
      } else if (c === '(') {
        const rest = chars.slice(i, i + 3).join('');
        if (rest.startsWith('(?:')) i += 3;
        else if (rest.startsWith('(?')) throw new Refused('lookaround and named groups have no translation');
        else i += 1;
        const inner = sequence(depth + 1);
        i += 1;
        atom = `(?:${inner})`;
      } else if (c === '[') {
        atom = bracket();
      } else if (c === '\\') {
        const next = chars[i + 1];
        if (next !== undefined && /[bB1-9k]/u.test(next)) throw new Refused(`"\\${next}" has no translation`);
        atom = escape(false);
      } else if (c === '.') {
        i += 1;
        atom = ANY;
      } else if (c === '^' || c === '$') {
        i += 1;
        out += c;
        continue;
      } else if (c === '*' || c === '+' || c === '?' || c === '{') {
        throw new Refused(`"${c}" has nothing to repeat`);
      } else {
        i += 1;
        atom = literal(c);
      }
      out += atom + quantifier();
    }
  };

  try {
    const pattern = sequence(0);
    return { ok: true, pattern, caseInsensitive: flags.includes('i') };
  } catch (error) {
    if (error instanceof Refused) return { ok: false, reason: error.message };
    throw error;
  }
}
