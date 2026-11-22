@urn-forge:strict
@urn:corpus:subscriptions:subscription:operation:create_subscription
Feature: Create a subscription

  Scenario Outline: A subscription without a trial is active and bills its first invoice
    When I run the operation with:
      | customer_id   | plan_id   | quantity   | requested_on | idempotency_key   |
      | <customer_id> | <plan_id> | <quantity> | 2026-11-22   | <idempotency_key> |
    Then the output is:
      | subscription_id              | customer_id   | quantity   | status | trial_end |
      | sub_nnnnnnnnnnnnnnnnnnnnnnnn | <customer_id> | <quantity> | active |           |
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
    When I run the operation with:
      | customer_id | plan_id   | quantity | requested_on |
      | cus_1       | <plan_id> | 1        | 2026-11-22   |
    Then the output is:
      | plan   |
      | <plan> |

    Examples:
      | plan_id                  | plan                                                                                                                  |
      | plan_pro-yearly-2        | { plan_id: plan_pro-yearly-2, billing_period: year, interval_count: 1, price: { amount_minor: 1500, currency: EUR } }        |
      | plan_team-quarterly      | { plan_id: plan_team-quarterly, billing_period: month, interval_count: 3, price: { amount_minor: 1500, currency: EUR } }     |
      | plan_team-annual-monthly | { plan_id: plan_team-annual-monthly, billing_period: month, interval_count: 12, price: { amount_minor: 1500, currency: EUR } } |

  Scenario Outline: Trial days of 0 make an active subscription, and more than 0 a trialing one
    When I run the operation with:
      | customer_id | plan_id    | quantity | trial_days   | requested_on |
      | cus_1       | plan_basic | 1        | <trial_days> | 2026-11-22   |
    Then the output is:
      | status   | trial_end   |
      | <status> | <trial_end> |

    Examples:
      | trial_days | status   | trial_end  |
      | 0          | active   |            |
      | 14         | trialing | 2026-12-06 |
      | 730        | trialing | 2028-11-21 |

  Scenario Outline: A trial shorter than 3 days announces its end at once
    When I run the operation with:
      | customer_id | plan_id    | quantity | trial_days   | trial_end   | requested_on |
      | cus_1       | plan_basic | 1        | <trial_days> | <trial_end> | 2026-11-22   |
    Then the output is:
      | status   |
      | trialing |
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

  Scenario Outline: An explicit trial end in the window is accepted
    When I run the operation with:
      | customer_id | plan_id    | quantity | trial_end   | requested_on |
      | cus_1       | plan_basic | 1        | <trial_end> | 2026-11-22   |
    Then the output is:
      | status   | trial_end   |
      | trialing | <trial_end> |
    And the operation emits "urn:corpus:subscriptions:subscription:event:created"
    And the operation emits no "urn:corpus:subscriptions:subscription:event:trial_will_end"
    And the operation emits no "urn:corpus:subscriptions:invoice:event:created"
    And the operation emits no "urn:corpus:subscriptions:invoice:event:paid"

    Examples:
      | trial_end  |
      | 2028-11-21 |
      | 2026-11-25 |

  Scenario Outline: A request that breaks a field limit is rejected
    When I run the operation with:
      | customer_id   | plan_id   | quantity   | trial_days   | requested_on | idempotency_key   |
      | <customer_id> | <plan_id> | <quantity> | <trial_days> | 2026-11-22   | <idempotency_key> |
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
    When I run the operation with:
      | customer_id | plan_id    | quantity | trial_days | trial_end  | requested_on |
      | cus_1       | plan_basic | 1        | 14         | 2026-12-06 | 2026-11-22   |
    Then the input is rejected by "urn:corpus:subscriptions:subscription:invariant:trial_days_or_trial_end"

  Scenario Outline: A trial end that is not in the future, or more than 730 days away, is rejected
    When I run the operation with:
      | customer_id | plan_id    | quantity | trial_end   | requested_on |
      | cus_1       | plan_basic | 1        | <trial_end> | 2026-11-22   |
    Then the input is rejected by "urn:corpus:subscriptions:subscription:invariant:trial_end_in_window"

    Examples:
      | trial_end  |
      | 2026-11-22 |
      | 2026-11-01 |
      | 2028-11-22 |

  Scenario: A second subscription of a customer to the same plan is a conflict
    When I run the operation with:
      | customer_id | plan_id    | quantity | requested_on |
      | cus_taken   | plan_basic | 1        | 2026-11-22   |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:conflict":
      | customer_id | plan_id    |
      | cus_taken   | plan_basic |
    And the operation emits no event
