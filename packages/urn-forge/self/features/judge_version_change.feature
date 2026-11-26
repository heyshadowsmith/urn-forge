Feature: Breaking changes and versions

  diff judges a breaking change by semver: it is allowed in 0.x, in a pre-release and across a new
  major version, and refused within one major version.

  Scenario Outline: A breaking change is allowed
    When I run "judge_version_change" with:
      | from_version   | to_version   |
      | <from_version> | <to_version> |
    Then the output is "breaking_allowed":
      | reason   |
      | <reason> |

    Examples:
      | from_version | to_version    | reason                                            |
      | 0.1.0        | 0.2.0         | 0.2.0 is a 0.x version, where anything may change |
      | 1.4.0        | 2.0.0-alpha.1 | 2.0.0-alpha.1 is a pre-release                    |
      | 1.4.0        | 2.0.0         | 2.0.0 is a new major version                      |

  Scenario Outline: A breaking change within one major version is refused
    When I run "judge_version_change" with:
      | from_version   | to_version   |
      | <from_version> | <to_version> |
    Then the output is "breaking_refused":
      | reason   |
      | <reason> |

    Examples:
      | from_version | to_version | reason                                                                               |
      | 1.4.0        | 1.5.0      | 1.4.0 → 1.5.0 keeps the major version 1; a breaking change needs a new major version |
      | 2.0.0        | 2.0.1      | 2.0.0 → 2.0.1 keeps the major version 2; a breaking change needs a new major version |

  Scenario Outline: A request that breaks a rule is rejected at the boundary
    When I run "judge_version_change" with:
      | from_version   | to_version   |
      | <from_version> | <to_version> |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition     | from_version | to_version |
      | pattern  | version        | 1.4          | 2.0.0      |
      | pattern  | version        | 1.4.0        | v2.0.0     |
      | pattern  | version        | 01.4.0       | 2.0.0      |
      | pattern  | version        | 1.4.0        | 2.0.0-01   |
      | required | version_change | 1.4.0        |            |

  Scenario Outline: An answer that breaks a rule is not an answer
    When I check a "<definition>" with:
      | reason   |
      | <reason> |
    Then the value is rejected by "<rule>" of "<failing>"

    Examples:
      | definition       | rule      | failing          | reason |
      | breaking_allowed | minLength | reason           | ""     |
      | breaking_allowed | required  | breaking_allowed |        |
      | breaking_refused | required  | breaking_refused |        |
