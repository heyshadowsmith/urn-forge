@target
Feature: A weaker contract and its version

  Gate 5 allows a contract to lose a rule, an output or a scenario, or a rule to accept more, only
  when the version changes, and only to a version that would allow a breaking change: a new major
  version, a pre-release, or another 0.x version.

  Scenario Outline: A weaker contract is allowed with a new version
    When I run "judge_weaker_contract" with:
      | from_version   | to_version   |
      | <from_version> | <to_version> |
    Then the output is "breaking_allowed":
      | reason   |
      | <reason> |

    Examples:
      | from_version | to_version    | reason                                            |
      | 0.1.0        | 0.2.0         | 0.2.0 is a 0.x version, where anything may change |
      | 0.1.0        | 0.1.1         | 0.1.1 is a 0.x version, where anything may change |
      | 1.4.0        | 2.0.0-alpha.1 | 2.0.0-alpha.1 is a pre-release                    |
      | 1.4.0        | 2.0.0         | 2.0.0 is a new major version                      |

  Scenario Outline: A weaker contract is refused
    When I run "judge_weaker_contract" with:
      | from_version   | to_version   |
      | <from_version> | <to_version> |
    Then the output is "breaking_refused":
      | reason   |
      | <reason> |

    Examples:
      | from_version | to_version | reason                                                                               |
      | 0.1.0        | 0.1.0      | 0.1.0 → 0.1.0 keeps the version; a weaker contract needs a new version               |
      | 2.0.0        | 2.0.0      | 2.0.0 → 2.0.0 keeps the version; a weaker contract needs a new version               |
      | 1.4.0        | 1.5.0      | 1.4.0 → 1.5.0 keeps the major version 1; a breaking change needs a new major version |
