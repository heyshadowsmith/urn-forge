@urn-forge:strict
@urn:corpus:subscriptions:subscription:operation:cancel_subscription
Feature: Cancel a subscription

  Scenario Outline: An immediate cancel moves the subscription to canceled
    Given the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | plan_id | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_basic | 1        | <status> | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              | cancel_mode | idempotency_key   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | immediately | <idempotency_key> |
    Then the output is:
      | status   | cancel_at |
      | canceled |           |
    And the operation emits "urn:corpus:subscriptions:subscription:event:canceled":
      | subscription_id              |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa |

    Examples:
      | status   | idempotency_key   |
      | active   | k                 |
      | trialing | =repeat(255, "k") |
      | past_due |                   |
      | paused   |                   |

  Scenario Outline: A cancel at the end of the period keeps the status and sets the cancel
    Given the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | plan_id | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_basic | 1        | <status> | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              | cancel_mode   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | at_period_end |
    Then the output is:
      | status   | cancel_at     |
      | <status> | at_period_end |
    And the operation emits "urn:corpus:subscriptions:subscription:event:canceled":
      | subscription_id              |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa |

    Examples:
      | status   |
      | active   |
      | trialing |
      | past_due |
      | paused   |

  Scenario Outline: A request that breaks a field limit is rejected
    Given the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | plan_id | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_basic | 1        | active   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
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
    Given there is no current subscription
    When I run the operation with:
      | subscription_id              | cancel_mode |
      | sub_000000000000000000000000 | immediately |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:not_found":
      | subscription_id              |
      | sub_000000000000000000000000 |

  Scenario Outline: A canceled or expired subscription cannot change again
    Given the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | plan_id | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_basic | 1        | <status> | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              | cancel_mode   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <cancel_mode> |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:invalid_state_transition":
      | subscription_id              | status   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <status> |
    And the operation emits no event

    Examples:
      | status   | cancel_mode   |
      | canceled | immediately   |
      | canceled | at_period_end |
      | expired  | immediately   |

  Scenario: A cancel at the end of the period keeps the mark of a trial that was announced, so the clock does not announce it again
    Given the current subscription is:
      | subscription_id              | customer_id | plan | plan_id | quantity | status   | current_period_start | current_period_end   | trial_end  | trial_will_end_sent_at |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_basic | 1        | trialing | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z | 2026-11-25 | 2026-11-22T00:00:00Z   |
    When I run the operation with:
      | subscription_id              | cancel_mode   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | at_period_end |
    Then the output is:
      | status   | cancel_at     | trial_will_end_sent_at |
      | trialing | at_period_end | 2026-11-22T00:00:00Z   |

  Scenario: A repeat of the same key and the same body within 24 hours returns the first answer and has no second effect
    Given the time is "2026-11-22T10:00:00Z"
    And the current subscription is:
      | subscription_id | customer_id | plan                                                                                                          | plan_id | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_basic | 1        | active   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id | cancel_mode | idempotency_key |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | immediately | key-1 |
    And the time is "2026-11-23T09:59:59Z"
    And I run the operation again with:
      | subscription_id | cancel_mode | idempotency_key |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | immediately | key-1 |
    Then the answer is the first answer
    And the operation emits no event

  Scenario: A repeat of the same key with a different body within 24 hours is refused with conflict
    Given the time is "2026-11-22T10:00:00Z"
    And the current subscription is:
      | subscription_id | customer_id | plan                                                                                                          | plan_id | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_basic | 1        | active   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id | cancel_mode | idempotency_key |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | immediately | key-1 |
    And I run the operation again with:
      | subscription_id | cancel_mode | idempotency_key |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | at_period_end | key-1 |
    Then the operation fails with "urn:corpus:subscriptions:request:error:conflict":
      | idempotency_key |
      | key-1           |
    And the operation emits no event

  Scenario: After 24 hours the same key is free, and the request runs again
    Given the time is "2026-11-22T10:00:00Z"
    And the current subscription is:
      | subscription_id | customer_id | plan                                                                                                          | plan_id | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_basic | 1        | active   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id | cancel_mode | idempotency_key |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | immediately | key-1 |
    And the time is "2026-11-23T10:00:00Z"
    And I run the operation again with:
      | subscription_id | cancel_mode | idempotency_key |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | immediately | key-1 |
    Then the operation emits "urn:corpus:subscriptions:subscription:event:canceled"
