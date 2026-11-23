@urn-forge:strict
@urn:corpus:subscriptions:subscription:operation:create_subscription
Feature: Create a subscription

  Scenario Outline: A subscription without a trial is active and bills its first invoice
    Given the time is "2026-11-22T10:00:00Z"
    When I run the operation with:
      | customer_id   | plan_id   | quantity   | idempotency_key   |
      | <customer_id> | <plan_id> | <quantity> | <idempotency_key> |
    Then the output is:
      | subscription_id              | customer_id   | quantity   | status | trial_end | trial_will_end_sent_at |
      | sub_nnnnnnnnnnnnnnnnnnnnnnnn | <customer_id> | <quantity> | active |           |                        |
    And the operation emits "urn:corpus:subscriptions:subscription:event:created":
      | subscription_id              | occurred_at          |
      | sub_nnnnnnnnnnnnnnnnnnnnnnnn | 2026-11-22T10:00:00Z |
    And the operation emits "urn:corpus:subscriptions:invoice:event:created":
      | subscription_id              | invoice_id |
      | sub_nnnnnnnnnnnnnnnnnnnnnnnn | in_1       |
    And the operation emits "urn:corpus:subscriptions:invoice:event:paid":
      | subscription_id              | invoice_id |
      | sub_nnnnnnnnnnnnnnnnnnnnnnnn | in_1       |
    And the operation emits no "urn:corpus:subscriptions:subscription:event:trial_will_end"

    Examples:
      | customer_id | plan_id                    | quantity | idempotency_key   |
      | cus_1       | plan_basic                 | 1        |                   |
      | c           | plan_a                     | 10000    | k                 |
      | cus_1       | ="plan_" + repeat(40, "x") | 3        | =repeat(255, "k") |
      | cus_1       | plan_pro-yearly-2          | 2        |                   |

  Scenario Outline: The subscription shows the billing period of its plan
    Given the time is "2026-11-22T10:00:00Z"
    When I run the operation with:
      | customer_id | plan_id   | quantity |
      | cus_1       | <plan_id> | 1        |
    Then the output is:
      | plan   |
      | <plan> |

    Examples:
      | plan_id                  | plan                                                                                                                  |
      | plan_pro-yearly-2        | { plan_id: plan_pro-yearly-2, billing_period: year, interval_count: 1, price: { amount_minor: 1500, currency: EUR } }        |
      | plan_team-quarterly      | { plan_id: plan_team-quarterly, billing_period: month, interval_count: 3, price: { amount_minor: 1500, currency: EUR } }     |
      | plan_team-annual-monthly | { plan_id: plan_team-annual-monthly, billing_period: month, interval_count: 12, price: { amount_minor: 1500, currency: EUR } } |

  Scenario Outline: Trial days of 0 make an active subscription, and more than 0 a trialing one
    Given the time is "2026-11-22T10:00:00Z"
    When I run the operation with:
      | customer_id | plan_id    | quantity | trial_days   |
      | cus_1       | plan_basic | 1        | <trial_days> |
    Then the output is:
      | status   | trial_end   |
      | <status> | <trial_end> |

    Examples:
      | trial_days | status   | trial_end  |
      | 0          | active   |            |
      | 14         | trialing | 2026-12-06 |
      | 730        | trialing | 2028-11-21 |

  Scenario: Trial days count from today, the UTC date of the time of the request
    Given the time is "2026-11-23T00:00:00Z"
    When I run the operation with:
      | customer_id | plan_id    | quantity | trial_days |
      | cus_1       | plan_basic | 1        | 2          |
    Then the output is:
      | status   | trial_end  | trial_will_end_sent_at |
      | trialing | 2026-11-25 | 2026-11-23T00:00:00Z   |
    And the operation emits "urn:corpus:subscriptions:subscription:event:trial_will_end":
      | subscription_id              |
      | sub_nnnnnnnnnnnnnnnnnnnnnnnn |

  Scenario Outline: A trial shorter than 3 days announces its end at once, and keeps the mark so that the clock does not announce it again
    Given the time is "2026-11-22T10:00:00Z"
    When I run the operation with:
      | customer_id | plan_id    | quantity | trial_days   | trial_end   |
      | cus_1       | plan_basic | 1        | <trial_days> | <trial_end> |
    Then the output is:
      | status   | trial_will_end_sent_at |
      | trialing | 2026-11-22T10:00:00Z   |
    And the operation emits "urn:corpus:subscriptions:subscription:event:trial_will_end":
      | subscription_id              |
      | sub_nnnnnnnnnnnnnnnnnnnnnnnn |
    And the operation emits no "urn:corpus:subscriptions:invoice:event:created"
    And the operation emits no "urn:corpus:subscriptions:invoice:event:paid"

    Examples:
      | trial_days | trial_end  |
      | 2          |            |
      |            | 2026-11-23 |
      |            | 2026-11-24 |

  Scenario Outline: An explicit trial end in the window is accepted; a trial of 3 days or more is left to the clock, with no mark
    Given the time is "2026-11-22T10:00:00Z"
    When I run the operation with:
      | customer_id | plan_id    | quantity | trial_end   |
      | cus_1       | plan_basic | 1        | <trial_end> |
    Then the output is:
      | status   | trial_end   | trial_will_end_sent_at |
      | trialing | <trial_end> |                        |
    And the operation emits "urn:corpus:subscriptions:subscription:event:created"
    And the operation emits no "urn:corpus:subscriptions:subscription:event:trial_will_end"
    And the operation emits no "urn:corpus:subscriptions:invoice:event:created"
    And the operation emits no "urn:corpus:subscriptions:invoice:event:paid"

    Examples:
      | trial_end  |
      | 2028-11-21 |
      | 2026-11-25 |

  Scenario Outline: A request that breaks a field limit is rejected
    Given the time is "2026-11-22T10:00:00Z"
    When I run the operation with:
      | customer_id   | plan_id   | quantity   | trial_days   | idempotency_key   |
      | <customer_id> | <plan_id> | <quantity> | <trial_days> | <idempotency_key> |
    Then the input is rejected on "<field>"

    Examples:
      | field           | customer_id | plan_id                                | quantity | trial_days | idempotency_key   |
      | customer_id     | ""          | plan_basic                             | 1        |            |                   |
      | plan_id         | cus_1       | plan_                                  | 1        |            |                   |
      | plan_id         | cus_1       | ="plan_" + repeat(41, "x")  | 1        |            |                   |
      | plan_id         | cus_1       | plan_Basic                             | 1        |            |                   |
      | plan_id         | cus_1       | basic                                  | 1        |            |                   |
      | quantity        | cus_1       | plan_basic                             | 0        |            |                   |
      | quantity        | cus_1       | plan_basic                             | 10001    |            |                   |
      | quantity        | cus_1       | plan_basic                             | 1.5      |            |                   |
      | trial_days      | cus_1       | plan_basic                             | 1        | -1         |                   |
      | trial_days      | cus_1       | plan_basic                             | 1        | 731        |                   |
      | idempotency_key | cus_1       | plan_basic                             | 1        |            | ""                |
      | idempotency_key | cus_1       | plan_basic                             | 1        |            | =repeat(256, "k") |

  Scenario: Trial days and a trial end together are rejected
    Given the time is "2026-11-22T10:00:00Z"
    When I run the operation with:
      | customer_id | plan_id    | quantity | trial_days | trial_end  |
      | cus_1       | plan_basic | 1        | 14         | 2026-12-06 |
    Then the input is rejected by "urn:corpus:subscriptions:subscription:invariant:trial_days_or_trial_end"

  Scenario Outline: A trial end that is not after today, or more than 730 days after today, is refused, at 2026-11-22T10:00:00Z
    Given the time is "2026-11-22T10:00:00Z"
    When I run the operation with:
      | customer_id | plan_id    | quantity | trial_end   |
      | cus_1       | plan_basic | 1        | <trial_end> |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:invalid_trial_end":
      | trial_end   |
      | <trial_end> |
    And the operation emits no event

    Examples:
      | trial_end  |
      | 2026-11-22 |
      | 2026-11-01 |
      | 2028-11-22 |

  Scenario Outline: A trial end that is not after today, or more than 730 days after today, is refused, at 2026-11-23T00:00:00Z
    Given the time is "2026-11-23T00:00:00Z"
    When I run the operation with:
      | customer_id | plan_id    | quantity | trial_end   |
      | cus_1       | plan_basic | 1        | <trial_end> |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:invalid_trial_end":
      | trial_end   |
      | <trial_end> |
    And the operation emits no event

    Examples:
      | trial_end  |
      | 2026-11-23 |
      | 2028-11-23 |

  Scenario Outline: Today is the UTC date of the time of the request, at 2026-11-22T23:59:59.999Z
    Given the time is "2026-11-22T23:59:59.999Z"
    When I run the operation with:
      | customer_id | plan_id    | quantity | trial_end   |
      | cus_1       | plan_basic | 1        | <trial_end> |
    Then the output is:
      | status   | trial_end   |
      | trialing | <trial_end> |

    Examples:
      | trial_end  |
      | 2026-11-23 |

  Scenario Outline: Today is the UTC date of the time of the request, at 2026-11-23T00:00:00Z
    Given the time is "2026-11-23T00:00:00Z"
    When I run the operation with:
      | customer_id | plan_id    | quantity | trial_end   |
      | cus_1       | plan_basic | 1        | <trial_end> |
    Then the output is:
      | status   | trial_end   |
      | trialing | <trial_end> |

    Examples:
      | trial_end  |
      | 2026-11-24 |
      | 2028-11-22 |

  Scenario Outline: A second subscription of a customer to a plan that it has a live subscription to is a conflict, and nothing changes
    Given these subscription records are stored:
      | subscription_id              | customer_id | plan_id    | status   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | plan_basic | <status> |
    And the time is "2026-11-22T10:00:00Z"
    When I run the operation with:
      | customer_id | plan_id    | quantity |
      | cus_1       | plan_basic | 1        |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:conflict":
      | customer_id | plan_id    |
      | cus_1       | plan_basic |
    And nothing changes

    Examples:
      | status   |
      | trialing |
      | active   |
      | past_due |
      | paused   |

  Scenario Outline: A canceled or expired subscription of the customer to the plan does not stop a new one
    Given these subscription records are stored:
      | subscription_id              | customer_id | plan_id    | status   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | plan_basic | <status> |
    And the time is "2026-11-22T10:00:00Z"
    When I run the operation with:
      | customer_id | plan_id    | quantity |
      | cus_1       | plan_basic | 1        |
    Then the output is:
      | subscription_id              | customer_id | plan_id    | status |
      | sub_nnnnnnnnnnnnnnnnnnnnnnnn | cus_1       | plan_basic | active |
    And the operation emits "urn:corpus:subscriptions:subscription:event:created"

    Examples:
      | status   |
      | canceled |
      | expired  |

  Scenario Outline: A live subscription to another plan, or of another customer, does not stop a new one
    Given these subscription records are stored:
      | subscription_id              | customer_id   | plan_id   | status |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <customer_id> | <plan_id> | active |
    And the time is "2026-11-22T10:00:00Z"
    When I run the operation with:
      | customer_id | plan_id    | quantity |
      | cus_1       | plan_basic | 1        |
    Then the output is:
      | subscription_id              | customer_id | plan_id    | status |
      | sub_nnnnnnnnnnnnnnnnnnnnnnnn | cus_1       | plan_basic | active |

    Examples:
      | customer_id | plan_id         |
      | cus_1       | plan_pro-yearly |
      | cus_2       | plan_basic      |

  Scenario: A repeat of the same key and the same body within 24 hours returns the first answer and has no second effect
    Given the time is "2026-11-22T10:00:00Z"
    When I run the operation with:
      | customer_id | plan_id    | quantity | idempotency_key |
      | cus_1       | plan_basic | 1        | key-1           |
    And the time is "2026-11-23T09:59:59Z"
    And I run the operation again with:
      | customer_id | plan_id    | quantity | idempotency_key |
      | cus_1       | plan_basic | 1        | key-1           |
    Then the answer is the first answer
    And the operation emits no event

  Scenario: A repeat of the same key with a different body within 24 hours is refused with conflict
    Given the time is "2026-11-22T10:00:00Z"
    When I run the operation with:
      | customer_id | plan_id    | quantity | idempotency_key |
      | cus_1       | plan_basic | 1        | key-1           |
    And I run the operation again with:
      | customer_id | plan_id    | quantity | idempotency_key |
      | cus_1       | plan_basic | 2        | key-1           |
    Then the operation fails with "urn:corpus:subscriptions:request:error:conflict":
      | idempotency_key |
      | key-1           |
    And the operation emits no event

  Scenario: After 24 hours the same key is free, and the request runs again
    Given the time is "2026-11-22T10:00:00Z"
    When I run the operation with:
      | customer_id | plan_id    | quantity | idempotency_key |
      | cus_1       | plan_basic | 1        | key-1           |
    And the time is "2026-11-23T10:00:00Z"
    And I run the operation again with:
      | customer_id | plan_id    | quantity | idempotency_key |
      | cus_1       | plan_basic | 1        | key-1           |
    Then the operation emits "urn:corpus:subscriptions:subscription:event:created"

  Scenario: A repeat without a key is a new request, and runs again
    Given the time is "2026-11-22T10:00:00Z"
    When I run the operation with:
      | customer_id | plan_id    | quantity |
      | cus_1       | plan_basic | 1        |
    And I run the operation again with:
      | customer_id | plan_id    | quantity |
      | cus_1       | plan_basic | 1        |
    Then the operation emits "urn:corpus:subscriptions:subscription:event:created"

  Scenario Outline: The first period starts now and ends the plan's number of calendar months later, on the last day of a month that lacks the start's day
    Given the time is "<now>"
    When I run the operation with:
      | customer_id | plan_id   | quantity | trial_days   |
      | cus_1       | <plan_id> | 1        | <trial_days> |
    Then the output is:
      | current_period_start | current_period_end   |
      | <now>                | <current_period_end> |

    Examples:
      | now                  | plan_id                  | trial_days | current_period_end   |
      | 2026-01-31T10:00:00Z | plan_basic               |            | 2026-02-28T10:00:00Z |
      | 2028-01-31T10:00:00Z | plan_basic               |            | 2028-02-29T10:00:00Z |
      | 2026-03-31T10:00:00Z | plan_basic               |            | 2026-04-30T10:00:00Z |
      | 2026-05-31T00:00:00Z | plan_basic               | 14         | 2026-06-30T00:00:00Z |
      | 2026-12-31T23:59:59Z | plan_basic               |            | 2027-01-31T23:59:59Z |
      | 2026-01-30T10:00:00Z | plan_basic               |            | 2026-02-28T10:00:00Z |
      | 2026-02-28T10:00:00Z | plan_basic               |            | 2026-03-28T10:00:00Z |
      | 2026-11-22T10:00:00Z | plan_basic               |            | 2026-12-22T10:00:00Z |
      | 2026-11-30T10:00:00Z | plan_team-quarterly      |            | 2027-02-28T10:00:00Z |
      | 2026-01-31T10:00:00Z | plan_team-annual-monthly |            | 2027-01-31T10:00:00Z |
      | 2028-02-29T10:00:00Z | plan_pro-yearly          |            | 2029-02-28T10:00:00Z |
