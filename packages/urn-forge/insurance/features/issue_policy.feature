Feature: Issue a policy

  Scenario Outline: A policy that obeys every rule is issued as requested
    When I run "issue_policy" with:
      | policy_id                            | holder                               | effective_at         | expires_at           | premium   | deductible   | coverages   |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01T00:00:00Z | 2027-01-01T00:00:00Z | <premium> | <deductible> | <coverages> |
    Then the output is "issued":
      | policy_issued.policy_id              | policy_issued.holder                 | policy_issued.premium |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | <premium>             |

    Examples:
      | premium | deductible | coverages                                                                                                               |
      | 12000   |            | [{"peril": "fire", "limit": 100000}]                                                                                    |
      | 1       | 0          | [{"peril": "flood", "limit": 50000}, {"peril": "theft", "limit": 25050, "remark": "Basement excluded, see {clause 4}"}] |
      | 12050   | 5025       | [{"peril": "fire", "limit": 1}, {"peril": "flood", "limit": 2}, {"peril": "theft", "limit": 3}]                         |
      | 9900    |            | [{"peril": "flood", "limit": 1000, "remark": "Flood cover excludes the basement area 4"}]                               |

  Scenario: A policy of 366 days, across 29 February, is issued
    When I run "issue_policy" with:
      | policy_id                            | holder                               | effective_at         | expires_at           | premium | deductible | coverages                            |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2027-03-01T00:00:00Z | 2028-03-01T00:00:00Z | 12000   |            | [{"peril": "fire", "limit": 100000}] |
    Then the output is "issued":
      | policy.policy_id                     | policy.holder                        | policy.effective_at  | policy.expires_at    | policy.premium | policy.coverages                     |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2027-03-01T00:00:00Z | 2028-03-01T00:00:00Z | 12000          | [{"peril": "fire", "limit": 100000}] |

  Scenario Outline: A policy that breaks a rule is rejected
    When I run "issue_policy" with:
      | policy_id   | holder   | effective_at   | expires_at   | premium   | deductible   | coverages   |
      | <policy_id> | <holder> | <effective_at> | <expires_at> | <premium> | <deductible> | <coverages> |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                     | definition   | policy_id                            | holder                               | effective_at         | expires_at           | premium | deductible | coverages                                                                                                                      |
      | pattern                  | policy_id    | policy-1                             | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01T00:00:00Z | 2027-01-01T00:00:00Z | 12000   |            | [{"peril": "fire", "limit": 100000}]                                                                                           |
      | pattern                  | customer_id  | 123e4567-e89b-12d3-a456-426614174000 | customer-1                           | 2026-01-01T00:00:00Z | 2027-01-01T00:00:00Z | 12000   |            | [{"peril": "fire", "limit": 100000}]                                                                                           |
      | format                   | effective_at | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01           | 2027-01-01T00:00:00Z | 12000   |            | [{"peril": "fire", "limit": 100000}]                                                                                           |
      | format                   | expires_at   | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01T00:00:00Z | 31/12/2026           | 12000   |            | [{"peril": "fire", "limit": 100000}]                                                                                           |
      | exclusiveMinimum         | premium      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01T00:00:00Z | 2027-01-01T00:00:00Z | 0       |            | [{"peril": "fire", "limit": 100000}]                                                                                           |
      | minimum                  | deductible   | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01T00:00:00Z | 2027-01-01T00:00:00Z | 12000   | -1         | [{"peril": "fire", "limit": 100000}]                                                                                           |
      | required                 | policy       | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01T00:00:00Z | 2027-01-01T00:00:00Z |         |            | [{"peril": "fire", "limit": 100000}]                                                                                           |
      | term_is_positive         | policy       | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01T00:00:00Z | 2026-01-01T00:00:00Z | 12000   |            | [{"peril": "fire", "limit": 100000}]                                                                                           |
      | term_is_positive         | policy       | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-06-01T00:00:00Z | 2026-05-31T00:00:00Z | 12000   |            | [{"peril": "fire", "limit": 100000}]                                                                                           |
      | term_at_most_a_year      | policy       | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2027-03-01T00:00:00Z | 2028-03-02T00:00:00Z | 12000   |            | [{"peril": "fire", "limit": 100000}]                                                                                           |
      | deductible_below_premium | policy       | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01T00:00:00Z | 2027-01-01T00:00:00Z | 12000   | 12000      | [{"peril": "fire", "limit": 100000}]                                                                                           |
      | minItems                 | coverages    | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01T00:00:00Z | 2027-01-01T00:00:00Z | 12000   |            | []                                                                                                                             |
      | maxItems                 | coverages    | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01T00:00:00Z | 2027-01-01T00:00:00Z | 12000   |            | [{"peril": "fire", "limit": 1}, {"peril": "flood", "limit": 2}, {"peril": "theft", "limit": 3}, {"peril": "fire", "limit": 4}] |
      | one_coverage_per_peril   | coverages    | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01T00:00:00Z | 2027-01-01T00:00:00Z | 12000   |            | [{"peril": "fire", "limit": 1}, {"peril": "fire", "limit": 2}]                                                                 |
      | enum                     | peril        | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01T00:00:00Z | 2027-01-01T00:00:00Z | 12000   |            | [{"peril": "hail", "limit": 1}]                                                                                                |
      | exclusiveMinimum         | limit        | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01T00:00:00Z | 2027-01-01T00:00:00Z | 12000   |            | [{"peril": "fire", "limit": 0}]                                                                                                |
      | maxLength                | remark       | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01T00:00:00Z | 2027-01-01T00:00:00Z | 12000   |            | [{"peril": "flood", "limit": 10, "remark": "Flood cover excludes the basement area 45"}]                                       |
      | required                 | coverage     | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01T00:00:00Z | 2027-01-01T00:00:00Z | 12000   |            | [{"peril": "fire"}]                                                                                                            |

  Scenario: A customer who obeys every rule is accepted
    When I check a "customer" with:
      | customer_id                          | name         |
      | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | Ada Lovelace |
    Then the value is accepted

  Scenario Outline: A customer that breaks a rule is rejected
    When I check a "customer" with:
      | customer_id   | name   |
      | <customer_id> | <name> |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule      | definition  | customer_id                          | name         |
      | pattern   | customer_id | customer-1                           | Ada Lovelace |
      | minLength | name        | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | ""           |
      | required  | customer    | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d |              |

  Scenario: An issued policy needs its event
    When I check an "issued" with:
      | policy.policy_id                     | policy.holder                        | policy.effective_at  | policy.expires_at    | policy.premium | policy.coverages                     |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01T00:00:00Z | 2027-01-01T00:00:00Z | 12000          | [{"peril": "fire", "limit": 100000}] |
    Then the value is rejected by "required" of "issued"

  Scenario: The event of an issued policy needs its premium
    When I check a "policy_issued" with:
      | policy_id                            | holder                               |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d |
    Then the value is rejected by "required" of "policy_issued"
