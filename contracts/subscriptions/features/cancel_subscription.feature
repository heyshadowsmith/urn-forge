@urn-forge:strict
@urn:corpus:subscriptions:subscription:operation:cancel_subscription
Feature: Cancel a subscription

  Scenario Outline: A subscription is canceled now or at the end of its period
    When I run the operation with:
      | subscription_id              | cancel_mode   | idempotency_key   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <cancel_mode> | <idempotency_key> |
    Then the output is:
      | status   | cancel_at   |
      | <status> | <cancel_at> |
    And the operation emits "urn:corpus:subscriptions:subscription:event:canceled":
      | subscription_id              |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa |

    Examples:
      | cancel_mode   | idempotency_key   | status   | cancel_at     |
      | immediately   | k                 | canceled |               |
      | at_period_end | =repeat(255, "k") | active   | at_period_end |

  Scenario Outline: A request that breaks a field limit is rejected
    When I run the operation with:
      | subscription_id   | cancel_mode   | idempotency_key   |
      | <subscription_id> | <cancel_mode> | <idempotency_key> |
    Then the input is rejected on "<field>"

    Examples:
      | field           | subscription_id              | cancel_mode | idempotency_key   |
      | subscription_id | sub_aaaa                     | immediately |                   |
      | cancel_mode     | sub_aaaaaaaaaaaaaaaaaaaaaaaa | tomorrow    |                   |
      | cancel_mode     | sub_aaaaaaaaaaaaaaaaaaaaaaaa |             |                   |
      | idempotency_key | sub_aaaaaaaaaaaaaaaaaaaaaaaa | immediately | ""                |
      | idempotency_key | sub_aaaaaaaaaaaaaaaaaaaaaaaa | immediately | =repeat(256, "k") |

  Scenario: An unknown subscription is not found
    When I run the operation with:
      | subscription_id              | cancel_mode |
      | sub_000000000000000000000000 | immediately |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:not_found"

  Scenario: A canceled subscription cannot change again
    When I run the operation with:
      | subscription_id              | cancel_mode |
      | sub_cccccccccccccccccccccccc | immediately |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:invalid_state_transition":
      | subscription_id              | status   |
      | sub_cccccccccccccccccccccccc | canceled |
    And the operation emits no event
