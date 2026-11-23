@urn-forge:strict
@urn:corpus:subscriptions:subscription:operation:pause_subscription
Feature: Pause a subscription

  Scenario Outline: An active or trialing subscription pauses, with or without a resume day
    Given the time is "2026-11-22T10:00:00Z"
    And the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | plan_id | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_basic | 1        | <status> | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              | resume_on   | idempotency_key   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <resume_on> | <idempotency_key> |
    Then the output is:
      | status | resume_on   |
      | paused | <resume_on> |
    And the operation emits "urn:corpus:subscriptions:subscription:event:updated"

    Examples:
      | status   | resume_on  | idempotency_key   |
      | active   |            | k                 |
      | trialing | 2026-11-23 | =repeat(255, "k") |
      | active   | 2027-02-20 |                   |

  Scenario Outline: A resume day less than 1 day or more than 90 days after the request is refused, at 2026-11-22T10:00:00Z
    Given the time is "2026-11-22T10:00:00Z"
    And the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | plan_id | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_basic | 1        | active   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              | resume_on   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <resume_on> |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:invalid_resume_date":
      | resume_on   |
      | <resume_on> |
    And the operation emits no event

    Examples:
      | resume_on  |
      | 2026-11-22 |
      | 2026-11-01 |
      | 2027-02-21 |

  Scenario Outline: A resume day less than 1 day or more than 90 days after the request is refused, at 2026-11-23T00:00:00Z
    Given the time is "2026-11-23T00:00:00Z"
    And the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | plan_id | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_basic | 1        | active   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              | resume_on   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <resume_on> |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:invalid_resume_date":
      | resume_on   |
      | <resume_on> |
    And the operation emits no event

    Examples:
      | resume_on  |
      | 2026-11-23 |

  Scenario Outline: A resume day less than 1 day or more than 90 days after the request is refused, at 2026-11-22T23:59:59.999Z
    Given the time is "2026-11-22T23:59:59.999Z"
    And the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | plan_id | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_basic | 1        | active   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              | resume_on   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <resume_on> |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:invalid_resume_date":
      | resume_on   |
      | <resume_on> |
    And the operation emits no event

    Examples:
      | resume_on  |
      | 2027-02-21 |

  Scenario Outline: Today is the UTC date of the time of the request, at 2026-11-22T23:59:59.999Z
    Given the time is "2026-11-22T23:59:59.999Z"
    And the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | plan_id | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_basic | 1        | active   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              | resume_on   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <resume_on> |
    Then the output is:
      | status | resume_on   |
      | paused | <resume_on> |

    Examples:
      | resume_on  |
      | 2026-11-23 |

  Scenario Outline: Today is the UTC date of the time of the request, at 2026-11-23T00:00:00Z
    Given the time is "2026-11-23T00:00:00Z"
    And the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | plan_id | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_basic | 1        | active   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              | resume_on   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <resume_on> |
    Then the output is:
      | status | resume_on   |
      | paused | <resume_on> |

    Examples:
      | resume_on  |
      | 2026-11-24 |
      | 2027-02-21 |

  Scenario Outline: A request that breaks a field limit is rejected
    Given the time is "2026-11-22T10:00:00Z"
    And the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | plan_id | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_basic | 1        | active   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id   | idempotency_key   |
      | <subscription_id> | <idempotency_key> |
    Then the input is rejected on "<field>"

    Examples:
      | field           | subscription_id              | idempotency_key   |
      | subscription_id | sub_                         |                   |
      | idempotency_key | sub_aaaaaaaaaaaaaaaaaaaaaaaa | ""                |
      | idempotency_key | sub_aaaaaaaaaaaaaaaaaaaaaaaa | =repeat(256, "k") |

  Scenario: An unknown subscription is not found
    Given the time is "2026-11-22T10:00:00Z"
    And there is no current subscription
    When I run the operation with:
      | subscription_id              |
      | sub_000000000000000000000000 |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:not_found"

  Scenario Outline: Only an active or trialing subscription can pause
    Given the time is "2026-11-22T10:00:00Z"
    And the current subscription is:
      | subscription_id              | customer_id | plan                                                                                                          | plan_id | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_basic | 1        | <status> | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa |
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

  Scenario: A repeat of the same key and the same body within 24 hours returns the first answer and has no second effect
    Given the time is "2026-11-22T10:00:00Z"
    And the current subscription is:
      | subscription_id | customer_id | plan                                                                                                          | plan_id | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_basic | 1        | active   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id | resume_on  | idempotency_key |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa |            | key-1 |
    And the time is "2026-11-23T09:59:59Z"
    And I run the operation again with:
      | subscription_id | resume_on  | idempotency_key |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa |            | key-1 |
    Then the answer is the first answer
    And the operation emits no event

  Scenario: A repeat of the same key with a different body within 24 hours is refused with conflict
    Given the time is "2026-11-22T10:00:00Z"
    And the current subscription is:
      | subscription_id | customer_id | plan                                                                                                          | plan_id | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | plan_basic | 1        | active   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id | resume_on  | idempotency_key |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa |            | key-1 |
    And I run the operation again with:
      | subscription_id | resume_on  | idempotency_key |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | 2026-12-01 | key-1 |
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
      | subscription_id | resume_on  | idempotency_key |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa |            | key-1 |
    And the time is "2026-11-23T10:00:00Z"
    And I run the operation again with:
      | subscription_id | resume_on  | idempotency_key |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa |            | key-1 |
    Then the operation emits "urn:corpus:subscriptions:subscription:event:updated"
