Feature: Cancel a policy

  Scenario Outline: The refund is the part of the premium for the time after the cancellation
    When I run "cancel_policy" with:
      | stored_policy.policy_id              | stored_policy.holder                 | stored_policy.coverages              | stored_policy.effective_at | stored_policy.expires_at | stored_policy.premium | cancelled_at   |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | [{"peril": "fire", "limit": 100000}] | 2026-01-01T00:00:00Z       | 2027-01-01T00:00:00Z     | <premium>             | <cancelled_at> |
    Then the output is "refund_quote":
      | refund   | policy_cancelled.policy_id           | policy_cancelled.cancelled_at | policy_cancelled.refund |
      | <refund> | 123e4567-e89b-12d3-a456-426614174000 | <cancelled_at>                | <refund>                |

    Examples:
      | premium | cancelled_at         | refund |
      | 36500   | 2026-07-02T00:00:00Z | 18300  |
      | 36500   | 2026-01-01T00:00:00Z | 36500  |
      | 73050   | 2026-12-31T00:00:00Z | 200    |

  Scenario Outline: A refund below 100 cents is refused, and the refusal is recorded
    When I run "cancel_policy" with:
      | stored_policy.policy_id              | stored_policy.holder                 | stored_policy.coverages              | stored_policy.effective_at | stored_policy.expires_at | stored_policy.premium | cancelled_at   |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | [{"peril": "fire", "limit": 100000}] | 2026-01-01T00:00:00Z       | 2027-01-01T00:00:00Z     | 36500                 | <cancelled_at> |
    Then the output is "refund_below_minimum":
      | refund   | refund_refused.policy_id             | refund_refused.cancelled_at | refund_refused.refund |
      | <refund> | 123e4567-e89b-12d3-a456-426614174000 | <cancelled_at>              | <refund>              |

    Examples:
      | cancelled_at         | refund |
      | 2027-01-01T00:00:00Z | 0      |
      | 2026-12-31T12:00:00Z | 50     |

  Scenario Outline: A cancellation that breaks a rule is rejected
    When I run "cancel_policy" with:
      | stored_policy.policy_id              | stored_policy.holder                 | stored_policy.coverages              | stored_policy.effective_at | stored_policy.expires_at | stored_policy.premium | cancelled_at   |
      | 123e4567-e89b-12d3-a456-426614174000 | 9b2f0c1e-4d3a-4f5b-8c6d-7e8f9a0b1c2d | [{"peril": "fire", "limit": 100000}] | 2026-01-01T00:00:00Z       | 2027-01-01T00:00:00Z     | 36500                 | <cancelled_at> |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                     | definition   | cancelled_at         |
      | cancellation_within_term | cancellation | 2025-12-31T23:59:59Z |
      | cancellation_within_term | cancellation | 2027-01-01T00:00:01Z |
      | format                   | cancelled_at | 2026-07-02           |
      | required                 | cancellation |                      |

  Scenario Outline: An answer that breaks a rule is not an answer
    When I check a "<definition>" with:
      | refund   | <event>.policy_id | <event>.cancelled_at | <event>.refund |
      | <refund> | <policy_id>       | <cancelled_at>       | <event_refund> |
    Then the value is rejected by "<rule>" of "<failing>"

    Examples:
      | definition           | event            | rule     | failing              | refund | policy_id                            | cancelled_at         | event_refund |
      | refund_quote         | policy_cancelled | minimum  | refund               | -1     | 123e4567-e89b-12d3-a456-426614174000 | 2026-07-02T00:00:00Z | -1           |
      | refund_quote         | policy_cancelled | required | refund_quote         |        | 123e4567-e89b-12d3-a456-426614174000 | 2026-07-02T00:00:00Z | 18300        |
      | refund_quote         | policy_cancelled | required | policy_cancelled     | 18300  | 123e4567-e89b-12d3-a456-426614174000 |                      | 18300        |
      | refund_below_minimum | refund_refused   | required | refund_below_minimum |        | 123e4567-e89b-12d3-a456-426614174000 | 2027-01-01T00:00:00Z | 0            |
      | refund_below_minimum | refund_refused   | required | refund_refused       | 0      |                                      | 2027-01-01T00:00:00Z | 0            |
      | refund_below_minimum | refund_refused   | format   | cancelled_at         | 0      | 123e4567-e89b-12d3-a456-426614174000 | 2027-01-01           | 0            |
