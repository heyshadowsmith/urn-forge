@urn-forge:strict
@urn:acme:insurance:policy:operation:cancel_policy
Feature: Cancel a policy

  Scenario Outline: The refund is the part of the premium for the days after the cancellation
    When I run the operation with:
      | effective_date | expiry_date | premium   | cancellation_date   |
      | 2026-01-01     | 2026-12-31  | <premium> | <cancellation_date> |
    Then the output is:
      | refund   |
      | <refund> |

    Examples:
      | premium | cancellation_date | refund |
      | 365.00  | 2026-07-02        | 182.00 |
      | 365.00  | 2026-01-01        | 364.00 |
      | 730.5   | 2026-12-30        | 2.00   |

  Scenario Outline: A premium that is not more than 0, or has more than 2 decimals, is rejected
    When I run the operation with:
      | effective_date | expiry_date | premium   | cancellation_date |
      | 2026-01-01     | 2026-12-31  | <premium> | 2026-07-02        |
    Then the input is rejected on "premium"

    Examples:
      | premium |
      | 0       |
      | 1.005   |

  Scenario Outline: A cancellation outside the term is rejected
    When I run the operation with:
      | effective_date | expiry_date | premium | cancellation_date   |
      | 2026-01-01     | 2026-12-31  | 365.00  | <cancellation_date> |
    Then the input is rejected by "urn:acme:insurance:policy:invariant:cancellation_within_term"

    Examples:
      | cancellation_date |
      | 2025-12-31        |
      | 2027-01-01        |

  Scenario: A cancellation on the last day leaves no refund to pay
    When I run the operation with:
      | effective_date | expiry_date | premium | cancellation_date |
      | 2026-01-01     | 2026-12-31  | 365.00  | 2026-12-31        |
    Then the operation fails with "urn:acme:insurance:policy:error:refund_below_minimum":
      | refund |
      | 0.00   |
