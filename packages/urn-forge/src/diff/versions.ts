/**
 * The verdicts of two versions of a manifest: whether they allow a breaking change (diff) and a weaker
 * contract (gate 5). Pure, with no import, so that urn-forge's own harness (self/) reads them without
 * loading a command.
 */
interface Version {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: boolean;
}

function parseVersion(text: string): Version {
  const [core = '', pre] = text.split('+')[0]!.split(/-(.*)/s);
  const [major = 0, minor = 0, patch = 0] = core.split('.').map(Number);
  return { major, minor, patch, prerelease: pre !== undefined && pre !== '' };
}

/** Whether the versions allow a breaking change, and why. */
export function allowsBreaking(from: string, to: string): { readonly allowed: boolean; readonly why: string } {
  const a = parseVersion(from);
  const b = parseVersion(to);
  if (b.major === 0) return { allowed: true, why: `${to} is a 0.x version, where anything may change` };
  if (b.prerelease) return { allowed: true, why: `${to} is a pre-release` };
  if (b.major > a.major) return { allowed: true, why: `${to} is a new major version` };
  return { allowed: false, why: `${from} → ${to} keeps the major version ${b.major}; a breaking change needs a new major version` };
}

/**
 * Whether the versions allow a weaker contract: only with a new version, and only to one that would
 * allow a breaking change in diff (a new major version, a pre-release, or another 0.x version).
 */
export function allowsWeaker(from: string, to: string): { readonly allowed: boolean; readonly why: string } {
  if (from === to) return { allowed: false, why: `${from} → ${to} keeps the version; a weaker contract needs a new version` };
  return allowsBreaking(from, to); // self: the implementation of judge_weaker_contract
}
