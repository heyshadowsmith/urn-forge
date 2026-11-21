@urn-forge:strict
@urn:acme:insurance:policy:operation:issue_policy
Feature: Issue a policy

  Scenario Outline: A policy that obeys every rule is issued as requested
    When I run the operation with:
      | policy_id                            | effective_date | expiry_date | premium   | deductible   |
      | 123e4567-e89b-12d3-a456-426614174000 | 2026-01-01     | 2026-12-31  | <premium> | <deductible> |
    Then the output is:
      | premium   | deductible   |
      | <premium> | <deductible> |

    Examples:
      | premium | deductible |
      | 120.00  |            |
      | 0.01    | 0          |
      | 120.50  | 50.25      |

  Scenario Outline: A premium that is not more than 0, or has more than 2 decimals, is rejected
    When I run the operation with:
      | policy_id                            | effective_date | expiry_date | premium   |
      | 123e4567-e89b-12d3-a456-426614174000 | 2026-01-01     | 2026-12-31  | <premium> |
    Then the input is rejected on "premium"

    Examples:
      | premium |
      | 0       |
      | 1.005   |

  Scenario Outline: A deductible below 0, or with more than 2 decimals, is rejected
    When I run the operation with:
      | policy_id                            | effective_date | expiry_date | premium | deductible   |
      | 123e4567-e89b-12d3-a456-426614174000 | 2026-01-01     | 2026-12-31  | 120.00  | <deductible> |
    Then the input is rejected on "deductible"

    Examples:
      | deductible |
      | -0.01      |
      | 1.005      |

  Scenario: A policy identifier that is not a UUID is rejected
    When I run the operation with:
      | policy_id | effective_date | expiry_date | premium |
      | policy-1  | 2026-01-01     | 2026-12-31  | 120.00  |
    Then the input is rejected on "policy_id"

  Scenario Outline: A policy that does not end after it starts is rejected
    When I run the operation with:
      | policy_id                            | effective_date | expiry_date   | premium |
      | 123e4567-e89b-12d3-a456-426614174000 | 2026-06-01     | <expiry_date> | 120.00  |
    Then the input is rejected by "urn:acme:insurance:policy:invariant:term_is_positive"

    Examples:
      | expiry_date |
      | 2026-06-01  |
      | 2026-05-31  |

  Scenario Outline: A deductible that is not less than the premium is rejected
    When I run the operation with:
      | policy_id                            | effective_date | expiry_date | premium | deductible   |
      | 123e4567-e89b-12d3-a456-426614174000 | 2026-01-01     | 2026-12-31  | 120.00  | <deductible> |
    Then the input is rejected by "urn:acme:insurance:policy:invariant:deductible_below_premium"

    Examples:
      | deductible |
      | 120.00     |
      | 120.01     |
