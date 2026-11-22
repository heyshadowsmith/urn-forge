@urn-forge:strict
@urn:corpus:subscriptions:subscription:operation:resume_subscription
Feature: Resume a subscription

  Scenario Outline: A paused subscription becomes active again
    Given the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | quantity | status   | current_period_start | current_period_end   |
      | sub_pppppppppppppppppppppppp | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | paused   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
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
    Given the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | quantity | status   | current_period_start | current_period_end   |
      | sub_pppppppppppppppppppppppp | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | paused   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
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
    Given there is no current subscription
    When I run the operation with:
      | subscription_id              |
      | sub_000000000000000000000000 |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:not_found"

  Scenario Outline: A subscription that is not paused cannot resume
    Given the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | quantity | status   | current_period_start | current_period_end   |
      | sub_pppppppppppppppppppppppp | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | <status> | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              |
      | sub_pppppppppppppppppppppppp |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:invalid_state_transition":
      | status   |
      | <status> |

    Examples:
      | status   |
      | canceled |
      | active   |
      | expired  |

  Scenario: A repeat of the same key and the same body within 24 hours returns the first answer and has no second effect
    Given the time is "2026-11-22T10:00:00Z"
    And the current subscription is:
      | subscription_id | customer_id | plan                                                                                                          | quantity | status   | current_period_start | current_period_end   |
      | sub_pppppppppppppppppppppppp | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | paused   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id | idempotency_key |
      | sub_pppppppppppppppppppppppp | key-1 |
    And the time is "2026-11-23T09:59:59Z"
    And I run the operation again with:
      | subscription_id | idempotency_key |
      | sub_pppppppppppppppppppppppp | key-1 |
    Then the answer is the first answer
    And the operation emits no event

  Scenario: A repeat of the same key with a different body within 24 hours is refused with conflict
    Given the time is "2026-11-22T10:00:00Z"
    And the current subscription is:
      | subscription_id | customer_id | plan                                                                                                          | quantity | status   | current_period_start | current_period_end   |
      | sub_pppppppppppppppppppppppp | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | paused   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id | idempotency_key |
      | sub_pppppppppppppppppppppppp | key-1 |
    And I run the operation again with:
      | subscription_id | idempotency_key |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | key-1 |
    Then the operation fails with "urn:corpus:subscriptions:request:error:conflict":
      | idempotency_key |
      | key-1           |
    And the operation emits no event

  Scenario: After 24 hours the same key is free, and the request runs again
    Given the time is "2026-11-22T10:00:00Z"
    And the current subscription is:
      | subscription_id | customer_id | plan                                                                                                          | quantity | status   | current_period_start | current_period_end   |
      | sub_pppppppppppppppppppppppp | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | paused   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id | idempotency_key |
      | sub_pppppppppppppppppppppppp | key-1 |
    And the time is "2026-11-23T10:00:00Z"
    And I run the operation again with:
      | subscription_id | idempotency_key |
      | sub_pppppppppppppppppppppppp | key-1 |
    Then the operation emits "urn:corpus:subscriptions:subscription:event:updated"
