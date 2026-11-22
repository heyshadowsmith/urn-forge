@urn-forge:strict
@urn:corpus:subscriptions:subscription:operation:change_plan
Feature: Change the plan of a subscription

  Scenario Outline: An immediate change, or a change with no proration, moves the subscription to the new plan
    When I run the operation with:
      | subscription_id              | plan_id   | proration   | idempotency_key   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <plan_id> | <proration> | <idempotency_key> |
    Then the output is:
      | plan                                                                                                         | scheduled_plan_id |
      | { plan_id: <plan_id>, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } |                   |
    And the operation emits "urn:corpus:subscriptions:subscription:event:updated":
      | subscription_id              |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa |

    Examples:
      | plan_id                    | proration | idempotency_key   |
      | plan_pro                   | immediate | k                 |
      | ="plan_" + repeat(40, "p") | none      | =repeat(255, "k") |

  Scenario: A change at the end of the period shows the new plan as scheduled and keeps the current plan
    When I run the operation with:
      | subscription_id              | plan_id  | proration     |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro | at_period_end |
    Then the output is:
      | plan                                                                                                           | scheduled_plan_id |
      | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_pro          |

  Scenario Outline: A request that breaks a field limit is rejected
    When I run the operation with:
      | subscription_id   | plan_id   | proration   | idempotency_key   |
      | <subscription_id> | <plan_id> | <proration> | <idempotency_key> |
    Then the input is rejected on "<field>"

    Examples:
      | field           | subscription_id              | plan_id                    | proration | idempotency_key   |
      | subscription_id | sub_short                    | plan_pro                   | none      |                   |
      | plan_id         | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro_x                 | none      |                   |
      | plan_id         | sub_aaaaaaaaaaaaaaaaaaaaaaaa | ="plan_" + repeat(41, "p") | none      |                   |
      | proration       | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro                   | later     |                   |
      | idempotency_key | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro                   | none      | ""                |
      | idempotency_key | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro                   | none      | =repeat(256, "k") |

  Scenario: A request without a proration mode is rejected
    When I run the operation with:
      | subscription_id              | plan_id  | proration |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro |           |
    Then the input is rejected on "proration"

  Scenario: A plan in a different currency is refused
    When I run the operation with:
      | subscription_id              | plan_id  | proration |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_usd | immediate |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:currency_mismatch":
      | plan_currency | subscription_currency |
      | USD           | EUR                   |
    And the operation emits no event

  Scenario: An unknown subscription is not found
    When I run the operation with:
      | subscription_id              | plan_id  | proration |
      | sub_000000000000000000000000 | plan_pro | immediate |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:not_found"

  Scenario: A canceled subscription cannot change its plan
    When I run the operation with:
      | subscription_id              | plan_id  | proration |
      | sub_cccccccccccccccccccccccc | plan_pro | immediate |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:invalid_state_transition":
      | status   |
      | canceled |
