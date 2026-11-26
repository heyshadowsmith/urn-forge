/**
 * A reader of the protocol buffer text format, as far as the conformance files of cel-spec use it:
 * messages, repeated fields, lists in [ ], extension names in [ ], strings with escapes, and words.
 */

/** A scalar keeps its text, so that a 64-bit integer keeps each digit. */
export type Scalar = { readonly kind: 'string'; readonly value: string } | { readonly kind: 'word'; readonly text: string };
export type Field = Scalar | Message;
export type Message = Map<string, Field[]>;

export const isMessage = (field: Field | undefined): field is Message => field instanceof Map;

type Token = { readonly kind: 'string'; readonly value: string } | { readonly kind: 'word'; readonly text: string } | { readonly kind: 'symbol'; readonly text: string };

const SIMPLE: Readonly<Record<string, number>> = { n: 10, t: 9, r: 13, '\\': 92, "'": 39, '"': 34, a: 7, b: 8, f: 12, v: 11, '?': 63 };

/** The bytes of a string literal, decoded as UTF-8: an octal or \x escape is one byte, as in protobuf. */
function readString(text: string, start: number): [string, number] {
  const quote = text[start]!;
  const bytes: number[] = [];
  const encoder = new TextEncoder();
  let i = start + 1;
  while (text[i] !== quote) {
    if (i >= text.length) throw new Error('a string has no closing quote');
    const c = text[i]!;
    if (c !== '\\') {
      const point = text.codePointAt(i)!;
      const char = String.fromCodePoint(point);
      bytes.push(...encoder.encode(char));
      i += char.length;
      continue;
    }
    const e = text[i + 1]!;
    if (Object.hasOwn(SIMPLE, e)) {
      bytes.push(SIMPLE[e]!);
      i += 2;
    } else if (e === 'x' || e === 'X') {
      const hex = /^[0-9a-fA-F]{1,2}/.exec(text.slice(i + 2))![0];
      bytes.push(parseInt(hex, 16));
      i += 2 + hex.length;
    } else if (/[0-7]/.test(e)) {
      const octal = /^[0-7]{1,3}/.exec(text.slice(i + 1))![0];
      bytes.push(parseInt(octal, 8));
      i += 1 + octal.length;
    } else if (e === 'u' || e === 'U') {
      const length = e === 'u' ? 4 : 8;
      bytes.push(...encoder.encode(String.fromCodePoint(parseInt(text.slice(i + 2, i + 2 + length), 16))));
      i += 2 + length;
    } else {
      throw new Error(`the escape \\${e} is not known`);
    }
  }
  return [new TextDecoder().decode(new Uint8Array(bytes)), i + 1];
}

function lex(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (/\s/.test(c)) {
      i++;
    } else if (c === '#') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '"' || c === "'") {
      const [value, end] = readString(text, i);
      // Adjacent strings join, as in protobuf.
      const last = tokens.at(-1);
      if (last?.kind === 'string') tokens[tokens.length - 1] = { kind: 'string', value: last.value + value };
      else tokens.push({ kind: 'string', value });
      i = end;
    } else if ('{}[]:,;<>'.includes(c)) {
      tokens.push({ kind: 'symbol', text: c });
      i++;
    } else {
      const word = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?(?![A-Za-z0-9_.])/.exec(text.slice(i)) ?? /^[-+]?[A-Za-z0-9_.\/]+/.exec(text.slice(i));
      if (!word) throw new Error(`the character ${c} is not known`);
      tokens.push({ kind: 'word', text: word[0] });
      i += word[0].length;
    }
  }
  return tokens;
}

/** Reads a file of the text format as its top message. */
export function parseTextproto(text: string): Message {
  const tokens = lex(text);
  let i = 0;
  const peek = (): Token | undefined => tokens[i];
  const isSymbol = (s: string): boolean => {
    const t = peek();
    return t?.kind === 'symbol' && t.text === s;
  };
  const take = (s: string): void => {
    if (!isSymbol(s)) throw new Error(`expected ${s} at token ${i}`);
    i++;
  };

  const message = (close: string | undefined): Message => {
    const fields: Message = new Map();
    while (close === undefined ? i < tokens.length : !isSymbol(close)) {
      let name: string;
      if (isSymbol('[')) {
        // An extension or an Any: [type.googleapis.com/google.protobuf.Duration]
        i++;
        name = `[${(tokens[i++] as { text: string }).text}]`;
        take(']');
      } else {
        const t = tokens[i++]!;
        if (t.kind !== 'word') throw new Error(`expected a field name at token ${i - 1}`);
        name = t.text;
      }
      const colon = isSymbol(':');
      if (colon) i++;
      const values: Field[] = [];
      if (isSymbol('[')) {
        i++;
        while (!isSymbol(']')) {
          values.push(value());
          if (isSymbol(',')) i++;
        }
        i++;
      } else {
        values.push(value());
      }
      fields.set(name, [...(fields.get(name) ?? []), ...values]);
      if (isSymbol(',') || isSymbol(';')) i++;
    }
    if (close !== undefined) i++;
    return fields;
  };

  const value = (): Field => {
    if (isSymbol('{')) {
      i++;
      return message('}');
    }
    if (isSymbol('<')) {
      i++;
      return message('>');
    }
    const t = tokens[i++]!;
    if (t.kind === 'string') return { kind: 'string', value: t.value };
    if (t.kind === 'word') return { kind: 'word', text: t.text };
    throw new Error(`expected a value at token ${i - 1}`);
  };

  return message(undefined);
}

/** The first value of a field. */
export function first(message: Message, name: string): Field | undefined {
  return message.get(name)?.[0];
}

/** The text of a scalar field: a string, or a word. */
export function text(message: Message, name: string): string | undefined {
  const field = first(message, name);
  if (field === undefined || isMessage(field)) return undefined;
  return field.kind === 'string' ? field.value : field.text;
}

/** Each message of a repeated field. */
export function messages(message: Message, name: string): Message[] {
  return (message.get(name) ?? []).filter(isMessage);
}
