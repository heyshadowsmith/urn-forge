// The parse_short_key handler, written before the compiler can check it (step 0 of
// docs/project/error-kind-plan.md). It moves into self/core.ts in step 3, when `ok` and
// `fail` exist in the generated runtime. Until then this directory is outside tsc.
import { parseShortKey } from '../../src/meta-schema.js';
import { fail, ok } from '../generated/domain.runtime.generated';

export const pending = {
  'urn:urn_forge:toolchain:naming:operation:parse_short_key': ({ short_key }) => {
    const parsed = parseShortKey(short_key);
    if (parsed.ok) return ok(parsed.value);
    // parseShortKey checked the grammar, so the second segment is the kind as written.
    const kind_segment = short_key.split('.')[1] ?? '';
    switch (parsed.code) {
      case 'unsupported-kind':
        return fail('urn:urn_forge:toolchain:naming:error:unsupported_kind', { short_key, kind_segment });
      case 'unknown-kind':
        return fail('urn:urn_forge:toolchain:naming:error:unknown_kind', { short_key, kind_segment });
      default:
        return fail('urn:urn_forge:toolchain:naming:error:invalid_short_key', { short_key });
    }
  },
};
