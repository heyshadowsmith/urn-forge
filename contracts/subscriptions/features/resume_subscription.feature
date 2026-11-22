@urn-forge:strict
@urn:corpus:subscriptions:subscription:operation:resume_subscription
Feature: Resume a subscription

  Scenario Outline: A paused subscription becomes active again
    When I run the operation with:
      | subscription_id              | idempotency_key   |
      | sub_pppppppppppppppppppppppp | <idempotency_key> |
    Then the output is:
      | status |
      | active |
    And the operation emits "urn:corpus:subscriptions:subscription:event:updated"

    Examples:
      | idempotency_key   |
      | k                 |
      | =repeat(255, "k") |

  Scenario Outline: A request that breaks a field limit is rejected
    When I run the operation with:
      | subscription_id   | idempotency_key   |
      | <subscription_id> | <idempotency_key> |
    Then the input is rejected on "<field>"

    Examples:
      | field           | subscription_id              | idempotency_key   |
      | subscription_id | SUB_pppppppppppppppppppppppp |                   |
      | idempotency_key | sub_pppppppppppppppppppppppp | ""                |
      | idempotency_key | sub_pppppppppppppppppppppppp | =repeat(256, "k") |

  Scenario: An unknown subscription is not found
    When I run the operation with:
      | subscription_id              |
      | sub_000000000000000000000000 |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:not_found"

  Scenario Outline: A subscription that is not paused cannot resume
    When I run the operation with:
      | subscription_id   |
      | <subscription_id> |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:invalid_state_transition":
      | status   |
      | <status> |

    Examples:
      | subscription_id              | status   |
      | sub_cccccccccccccccccccccccc | canceled |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | active   |
