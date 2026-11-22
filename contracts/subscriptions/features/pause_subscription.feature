@urn-forge:strict
@urn:corpus:subscriptions:subscription:operation:pause_subscription
Feature: Pause a subscription

  Scenario Outline: An active or trialing subscription pauses, with or without a resume day
    Given the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | <status> | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              | requested_on | resume_on   | idempotency_key   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | 2026-11-22   | <resume_on> | <idempotency_key> |
    Then the output is:
      | status | resume_on   |
      | paused | <resume_on> |
    And the operation emits "urn:corpus:subscriptions:subscription:event:updated"

    Examples:
      | status   | resume_on  | idempotency_key   |
      | active   |            | k                 |
      | trialing | 2026-11-23 | =repeat(255, "k") |
      | active   | 2027-02-20 |                   |

  Scenario Outline: A resume day less than 1 day or more than 90 days after the request is rejected
    Given the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | active   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              | requested_on | resume_on   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | 2026-11-22   | <resume_on> |
    Then the input is rejected by "urn:corpus:subscriptions:subscription:invariant:resume_in_window"

    Examples:
      | resume_on  |
      | 2026-11-22 |
      | 2027-02-21 |

  Scenario Outline: A request that breaks a field limit is rejected
    Given the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | active   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id   | requested_on | idempotency_key   |
      | <subscription_id> | 2026-11-22   | <idempotency_key> |
    Then the input is rejected on "<field>"

    Examples:
      | field           | subscription_id              | idempotency_key   |
      | subscription_id | sub_                         |                   |
      | idempotency_key | sub_aaaaaaaaaaaaaaaaaaaaaaaa | ""                |
      | idempotency_key | sub_aaaaaaaaaaaaaaaaaaaaaaaa | =repeat(256, "k") |

  Scenario: An unknown subscription is not found
    Given there is no current subscription
    When I run the operation with:
      | subscription_id              | requested_on |
      | sub_000000000000000000000000 | 2026-11-22   |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:not_found"

  Scenario Outline: Only an active or trialing subscription can pause
    Given the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | <status> | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              | requested_on |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | 2026-11-22   |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:invalid_state_transition":
      | subscription_id              | status   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <status> |
    And the operation emits no event

    Examples:
      | status   |
      | past_due |
      | paused   |
      | canceled |
      | expired  |
