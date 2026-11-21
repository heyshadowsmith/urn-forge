@urn-forge:strict
@urn:acme:insurance:policy:operation:issue_policy
Feature: Issue a policy

  Scenario Outline: A policy that obeys every rule is issued as requested
    When I run the operation with:
      | policy_id                            | holder                               | effective_date | expiry_date | premium   | deductible   | coverages   |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01     | 2026-12-31  | <premium> | <deductible> | <coverages> |
    Then the output is:
      | holder                               | premium   | deductible   | coverages   |
      | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | <premium> | <deductible> | <coverages> |
    And the operation emits "urn:acme:insurance:policy:event:policy_issued":
      | policy_id                            | holder                               | premium   |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | <premium> |

    Examples:
      | premium | deductible | coverages                                                                                                    |
      | 120.00  |            | [{ peril: fire, limit: 1000.00 }]                                                                            |
      | 0.01    | 0          | [{ peril: flood, limit: 500 }, { peril: theft, limit: 250.5, note: "Basement excluded, see {clause 4}" }]    |
      | 120.50  | 50.25      | [{ peril: fire, limit: 1 }, { peril: flood, limit: 2 }, { peril: theft, limit: 3 }]                          |
      | 99.00   |            | [{ peril: flood, limit: 10, remark: "Flood cover excludes the basement area 4" }]                                          |

  Scenario Outline: A premium that is not more than 0, or has more than 2 decimals, is rejected
    When I run the operation with:
      | policy_id                            | holder                               | effective_date | expiry_date | premium   | coverages                         |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01     | 2026-12-31  | <premium> | [{ peril: fire, limit: 1000.00 }] |
    Then the input is rejected on "premium"

    Examples:
      | premium |
      | 0       |
      | 1.005   |

  Scenario Outline: A deductible below 0, or with more than 2 decimals, is rejected
    When I run the operation with:
      | policy_id                            | holder                               | effective_date | expiry_date | premium | deductible   | coverages                         |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01     | 2026-12-31  | 120.00  | <deductible> | [{ peril: fire, limit: 1000.00 }] |
    Then the input is rejected on "deductible"

    Examples:
      | deductible |
      | -0.01      |
      | 1.005      |

  Scenario: A policy identifier that is not a UUID is rejected
    When I run the operation with:
      | policy_id | holder                               | effective_date | expiry_date | premium | coverages                         |
      | policy-1  | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01     | 2026-12-31  | 120.00  | [{ peril: fire, limit: 1000.00 }] |
    Then the input is rejected on "policy_id"

  Scenario: A holder that is not a customer identifier is rejected
    When I run the operation with:
      | policy_id                            | holder     | effective_date | expiry_date | premium | coverages                         |
      | 123e4567-e89b-12d3-a456-426614174000 | customer-1 | 2026-01-01     | 2026-12-31  | 120.00  | [{ peril: fire, limit: 1000.00 }] |
    Then the input is rejected on "holder"

  Scenario Outline: A list of coverages that breaks its rules is rejected
    When I run the operation with:
      | policy_id                            | holder                               | effective_date | expiry_date | premium | coverages   |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01     | 2026-12-31  | 120.00  | <coverages> |
    Then the input is rejected on "coverages"

    Examples:
      | coverages                                                                                                    |
      | []                                                                                                           |
      | [{ peril: fire, limit: 1 }, { peril: flood, limit: 2 }, { peril: theft, limit: 3 }, { peril: fire, limit: 4 }] |
      | [{ peril: fire, limit: 1 }, { peril: fire, limit: 2 }]                                                       |
      | [{ peril: hail, limit: 1 }]                                                                                  |
      | [{ peril: fire, limit: 1.005 }]                                                                              |
      | [{ peril: flood, limit: 10, remark: "Flood cover excludes the basement area 45" }]                                       |

  Scenario: A coverage that pays nothing is rejected
    When I run the operation with:
      | policy_id                            | holder                               | effective_date | expiry_date | premium | coverages                   |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01     | 2026-12-31  | 120.00  | [{ peril: fire, limit: 0 }] |
    Then the input is rejected by "urn:acme:insurance:policy:invariant:limit_is_positive"

  Scenario Outline: A policy that does not end after it starts is rejected
    When I run the operation with:
      | policy_id                            | holder                               | effective_date | expiry_date   | premium | coverages                         |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-06-01     | <expiry_date> | 120.00  | [{ peril: fire, limit: 1000.00 }] |
    Then the input is rejected by "urn:acme:insurance:policy:invariant:term_is_positive"

    Examples:
      | expiry_date |
      | 2026-06-01  |
      | 2026-05-31  |

  Scenario Outline: A deductible that is not less than the premium is rejected
    When I run the operation with:
      | policy_id                            | holder                               | effective_date | expiry_date | premium | deductible   | coverages                         |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2026-01-01     | 2026-12-31  | 120.00  | <deductible> | [{ peril: fire, limit: 1000.00 }] |
    Then the input is rejected by "urn:acme:insurance:policy:invariant:deductible_below_premium"

    Examples:
      | deductible |
      | 120.00     |
      | 120.01     |

  Scenario: A policy of 366 days, across 29 February, is issued
    When I run the operation with:
      | policy_id                            | holder                               | effective_date | expiry_date | premium | coverages                         |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2027-03-01     | 2028-03-01  | 120.00  | [{ peril: fire, limit: 1000.00 }] |
    Then the output is:
      | effective_date | expiry_date |
      | 2027-03-01     | 2028-03-01  |

  Scenario: A policy of more than 366 days is rejected
    When I run the operation with:
      | policy_id                            | holder                               | effective_date | expiry_date | premium | coverages                         |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | 2027-03-01     | 2028-03-02  | 120.00  | [{ peril: fire, limit: 1000.00 }] |
    Then the input is rejected by "urn:acme:insurance:policy:invariant:term_at_most_a_year"
