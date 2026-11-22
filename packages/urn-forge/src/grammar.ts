/** The URN and short-key grammar, shared by the meta-schema and the kind descriptors. */
import * as v from 'valibot';

/** Every non-kind URN segment: lowercase snake_case, starts with a letter, at most 63 chars. */
export const SEGMENT_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

/** `<context>.<kind>.<identifier>`, capturing the three segments. */
export const SHORT_KEY_PATTERN = /^([a-z][a-z0-9_]{0,62})\.([a-z]+)\.([a-z][a-z0-9_]{0,62})$/;

export const Segment = v.pipe(
  v.string(),
  v.regex(SEGMENT_PATTERN, 'must be lowercase snake_case, start with a letter and be at most 63 characters'),
);

/** A short key naming an atom, as written in a reference (`ref`, `input`, `output`). */
export const ShortKeyRef = v.pipe(
  v.string(),
  v.regex(SHORT_KEY_PATTERN, 'must be a short key of the form <context>.<kind>.<identifier> in snake_case'),
);

export const Description = v.pipe(v.string(), v.minLength(1, 'must not be empty'));
