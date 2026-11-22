@urn-forge:strict
@urn:corpus:subscriptions:subscription:operation:change_plan
Feature: Change the plan of a subscription

  Scenario Outline: An immediate change, or a change with no proration, moves the subscription to the new plan
    Given the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | <status> | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              | plan_id   | proration   | idempotency_key   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <plan_id> | <proration> | <idempotency_key> |
    Then the output is:
      | status   | plan                                                                                                         | scheduled_plan_id |
      | <status> | { plan_id: <plan_id>, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } |                   |
    And the operation emits "urn:corpus:subscriptions:subscription:event:updated":
      | subscription_id              |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa |

    Examples:
      | status   | plan_id                    | proration | idempotency_key   |
      | active   | plan_pro                   | immediate | k                 |
      | trialing | ="plan_" + repeat(40, "p") | none      | =repeat(255, "k") |
      | past_due | plan_pro                   | none      |                   |
      | paused   | plan_pro                   | immediate |                   |

  Scenario: A change at the end of the period shows the new plan as scheduled and keeps the current plan
    Given the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | quantity | status | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | active | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              | plan_id  | proration     |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro | at_period_end |
    Then the output is:
      | plan                                                                                                           | scheduled_plan_id |
      | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_pro          |

  Scenario Outline: A request that breaks a field limit is rejected
    Given the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | quantity | status | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | active | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
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
    Given the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | quantity | status | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | active | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              | plan_id  | proration |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro |           |
    Then the input is rejected on "proration"

  Scenario: A plan in a different currency is refused
    Given the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | quantity | status | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | active | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              | plan_id  | proration |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_usd | immediate |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:currency_mismatch":
      | plan_currency | subscription_currency |
      | USD           | EUR                   |
    And the operation emits no event

  Scenario: An unknown subscription is not found
    Given there is no current subscription
    When I run the operation with:
      | subscription_id              | plan_id  | proration |
      | sub_000000000000000000000000 | plan_pro | immediate |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:not_found"

  Scenario Outline: A canceled or expired subscription cannot change its plan
    Given the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | <status> | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              | plan_id  | proration |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro | immediate |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:invalid_state_transition":
      | subscription_id              | status   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <status> |
    And the operation emits no event

    Examples:
      | status   |
      | canceled |
      | expired  |

  Scenario Outline: A change keeps the mark of a trial that was announced, so the clock does not announce it again
    Given the current subscription is:
      | subscription_id              | customer_id | plan | quantity | status   | current_period_start | current_period_end   | trial_end  | trial_will_end_sent_at |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | trialing | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z | 2026-11-25 | 2026-11-22T00:00:00Z   |
    When I run the operation with:
      | subscription_id              | plan_id  | proration   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro | <proration> |
    Then the output is:
      | status   | trial_end  | trial_will_end_sent_at |
      | trialing | 2026-11-25 | 2026-11-22T00:00:00Z   |

    Examples:
      | proration     |
      | immediate     |
      | at_period_end |

  Scenario: A repeat of the same key and the same body within 24 hours returns the first answer and has no second effect
    Given the time is "2026-11-22T10:00:00Z"
    And the current subscription is:
      | subscription_id | customer_id | plan                                                                                                          | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | active   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id | plan_id  | proration | idempotency_key |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro | immediate | key-1 |
    And the time is "2026-11-23T09:59:59Z"
    And I run the operation again with:
      | subscription_id | plan_id  | proration | idempotency_key |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro | immediate | key-1 |
    Then the answer is the first answer
    And the operation emits no event

  Scenario: A repeat of the same key with a different body within 24 hours is refused with conflict
    Given the time is "2026-11-22T10:00:00Z"
    And the current subscription is:
      | subscription_id | customer_id | plan                                                                                                          | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | active   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id | plan_id  | proration | idempotency_key |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro | immediate | key-1 |
    And I run the operation again with:
      | subscription_id | plan_id  | proration | idempotency_key |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro | none      | key-1 |
    Then the operation fails with "urn:corpus:subscriptions:request:error:conflict":
      | idempotency_key |
      | key-1           |
    And the operation emits no event

  Scenario: After 24 hours the same key is free, and the request runs again
    Given the time is "2026-11-22T10:00:00Z"
    And the current subscription is:
      | subscription_id | customer_id | plan                                                                                                          | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | active   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id | plan_id  | proration | idempotency_key |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro | immediate | key-1 |
    And the time is "2026-11-23T10:00:00Z"
    And I run the operation again with:
      | subscription_id | plan_id  | proration | idempotency_key |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro | immediate | key-1 |
    Then the operation emits "urn:corpus:subscriptions:subscription:event:updated"
