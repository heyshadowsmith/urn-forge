Feature: Create a subscription
  Staff with the billing-admin role subscribe a customer to a plan, which the shell loads. The time
  of the call is now; the day of the request is its UTC date. The harness checks each answer against
  the rules of its output: the status, the trial, the trial notice and the events.

  Scenario Outline: A subscription without a trial is active, starts its period now and bills its first invoice
    When I run "create_subscription" with:
      | customer_id | plan_id    | quantity   | trial_days   | idempotency_key   | caller.caller_kind | caller.staff_roles | now                  | plan                                                                                                         |
      | cus_1       | plan_basic | <quantity> | <trial_days> | <idempotency_key> | staff              | [billing-admin]    | 2026-11-22T10:00:00Z | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} |
    Then the output is "subscription_change"

    Examples:
      | quantity | trial_days | idempotency_key |
      | 1        |            |                 |
      | 10000    | 0          | k               |

  Scenario: The first period of a monthly plan ends on the last day of a shorter month
    When I run "create_subscription" with:
      | customer_id | plan_id    | quantity | caller.caller_kind | caller.staff_roles | now                  | plan                                                                                                         |
      | cus_1       | plan_basic | 2        | staff              | [billing-admin]    | 2026-01-31T10:00:00Z | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} |
    Then the output is "subscription_change":
      | subscription |
      | {"subscription_id": "sub_1c6xsp00k30tv30k5231i06n", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 2, "subscription_status": "active", "current_period_start": "2026-01-31T10:00:00Z", "current_period_end": "2026-02-28T10:00:00Z"} |

  Scenario: A trial of 14 days ends 14 days after today and is left to the clock
    When I run "create_subscription" with:
      | customer_id | plan_id             | quantity | trial_days | caller.caller_kind | caller.staff_roles | now                  | plan                                                                                                                  |
      | cus_1       | plan_team-quarterly | 1        | 14         | staff              | [billing-admin]    | 2026-11-30T10:00:00Z | {"plan_id": "plan_team-quarterly", "billing_period": "month", "interval_count": 3, "price": {"amount_minor": 4500, "currency": "EUR"}} |
    Then the output is "subscription_change":
      | subscription |
      | {"subscription_id": "sub_0waf70n1w60jsy1esislt0py", "customer_id": "cus_1", "plan": {"plan_id": "plan_team-quarterly", "billing_period": "month", "interval_count": 3, "price": {"amount_minor": 4500, "currency": "EUR"}}, "plan_id": "plan_team-quarterly", "quantity": 1, "subscription_status": "trialing", "current_period_start": "2026-11-30T10:00:00Z", "current_period_end": "2027-02-28T10:00:00Z", "trial_end": "2026-12-14"} |

  Scenario Outline: A trial that ends less than 3 days after today is announced at once and marked
    When I run "create_subscription" with:
      | customer_id | plan_id    | quantity | trial_days   | trial_end   | caller.caller_kind | caller.staff_roles | now                  | plan                                                                                                         |
      | cus_1       | plan_basic | 1        | <trial_days> | <trial_end> | staff              | [billing-admin]    | 2026-11-22T10:00:00Z | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} |
    Then the output is "subscription_change"

    Examples:
      | trial_days | trial_end  |
      | 2          |            |
      |            | 2026-11-23 |
      |            | 2026-11-24 |
      | 3          |            |
      |            | 2026-11-25 |
      | 730        |            |

  Scenario Outline: An explicit trial end from tomorrow to 730 days after today is accepted, at either edge of the day
    When I run "create_subscription" with:
      | customer_id | plan_id    | quantity | trial_end   | caller.caller_kind | caller.staff_roles | now   | plan                                                                                                         |
      | cus_1       | plan_basic | 1        | <trial_end> | staff              | [billing-admin]    | <now> | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} |
    Then the output is "subscription_change"

    Examples:
      | now                  | trial_end  |
      | 2026-11-22T10:00:00Z | 2026-11-23 |
      | 2026-11-22T10:00:00Z | 2028-11-21 |
      | 2026-11-22T23:59:59Z | 2026-11-23 |
      | 2026-11-22T00:00:00Z | 2028-11-21 |

  Scenario Outline: A trial end today or before, or more than 730 days after today, is rejected
    When I run "create_subscription" with:
      | customer_id | plan_id    | quantity | trial_end   | caller.caller_kind | caller.staff_roles | now   | plan                                                                                                         |
      | cus_1       | plan_basic | 1        | <trial_end> | staff              | [billing-admin]    | <now> | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} |
    Then the input is rejected by "trial_end_in_window" of "create_request"

    Examples:
      | now                  | trial_end  |
      | 2026-11-22T10:00:00Z | 2026-11-22 |
      | 2026-11-22T10:00:00Z | 2026-11-01 |
      | 2026-11-22T10:00:00Z | 2028-11-22 |
      | 2026-11-23T00:00:00Z | 2026-11-23 |
      | 2026-11-21T23:59:59Z | 2028-11-21 |

  Scenario: A request with trial days and a trial end is rejected
    When I run "create_subscription" with:
      | customer_id | plan_id    | quantity | trial_days | trial_end  | caller.caller_kind | caller.staff_roles | now                  | plan                                                                                                         |
      | cus_1       | plan_basic | 1        | 14         | 2026-12-06 | staff              | [billing-admin]    | 2026-11-22T10:00:00Z | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} |
    Then the input is rejected by "trial_days_or_trial_end" of "create_request"

  Scenario: A request that names another plan than the one loaded is rejected
    When I run "create_subscription" with:
      | customer_id | plan_id  | quantity | caller.caller_kind | caller.staff_roles | now                  | plan                                                                                                         |
      | cus_1       | plan_pro | 1        | staff              | [billing-admin]    | 2026-11-22T10:00:00Z | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} |
    Then the input is rejected by "names_the_plan" of "create_request"

  Scenario Outline: A customer with a live subscription to the plan gets conflict
    When I run "create_subscription" with:
      | customer_id | plan_id    | quantity | caller.caller_kind | caller.staff_roles | now                  | plan                                                                                                         | existing_subscription.subscription_id | existing_subscription.customer_id | existing_subscription.plan                                                                                   | existing_subscription.plan_id | existing_subscription.quantity | existing_subscription.subscription_status | existing_subscription.current_period_start | existing_subscription.current_period_end |
      | cus_1       | plan_basic | 1        | staff              | [billing-admin]    | 2026-11-22T10:00:00Z | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | sub_aaaaaaaaaaaaaaaaaaaaaaaa          | cus_1                             | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic                    | 1                              | <status>                                  | 2026-11-01T00:00:00Z                       | 2026-12-01T00:00:00Z                     |
    Then the output is "conflict":
      | customer_id | plan_id    |
      | cus_1       | plan_basic |

    Examples:
      | status   |
      | trialing |
      | active   |
      | past_due |
      | paused   |

  Scenario Outline: An existing subscription that is not the customer's live one to the plan is rejected
    When I run "create_subscription" with:
      | customer_id | plan_id    | quantity | caller.caller_kind | caller.staff_roles | now                  | plan                                                                                                         | existing_subscription.subscription_id | existing_subscription.customer_id | existing_subscription.plan                                                                                   | existing_subscription.plan_id | existing_subscription.quantity | existing_subscription.subscription_status | existing_subscription.current_period_start | existing_subscription.current_period_end |
      | cus_1       | plan_basic | 1        | staff              | [billing-admin]    | 2026-11-22T10:00:00Z | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | sub_aaaaaaaaaaaaaaaaaaaaaaaa          | <customer_id>                     | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic                    | 1                              | <status>                                  | 2026-11-01T00:00:00Z                       | 2026-12-01T00:00:00Z                     |
    Then the input is rejected by "existing_is_the_customers_live_one" of "create_request"

    Examples:
      | customer_id | status   |
      | cus_2       | active   |
      | cus_1       | canceled |
      | cus_1       | expired  |

  Scenario Outline: Only staff with the billing-admin role may create a subscription
    When I run "create_subscription" with:
      | customer_id | plan_id    | quantity | caller.caller_kind | caller.customer_id | caller.staff_roles | now                  | plan                                                                                                         |
      | cus_1       | plan_basic | 1        | <kind>             | <customer>         | <roles>            | 2026-11-22T10:00:00Z | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} |
    Then the output is "forbidden":
      | caller   |
      | <caller> |

    Examples:
      | kind     | customer | roles     | caller                                                |
      | customer | cus_1    |           | {"caller_kind": "customer", "customer_id": "cus_1"}  |
      | staff    |          | [support] | {"caller_kind": "staff", "staff_roles": ["support"]} |
      | staff    |          |           | {"caller_kind": "staff"}                              |
      | clock    |          |           | {"caller_kind": "clock"}                              |

  Scenario Outline: A request that breaks a limit is rejected
    When I run "create_subscription" with:
      | customer_id   | plan_id   | quantity   | trial_days   | trial_end   | idempotency_key   | caller.caller_kind | caller.staff_roles | now   | plan                                                                                                         |
      | <customer_id> | <plan_id> | <quantity> | <trial_days> | <trial_end> | <idempotency_key> | staff              | [billing-admin]    | <now> | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule      | definition      | customer_id | plan_id    | quantity | trial_days | trial_end  | idempotency_key | now                       |
      | minLength | customer_id     | ""          | plan_basic | 1        |            |            |                 | 2026-11-22T10:00:00Z      |
      | pattern   | plan_id         | cus_1       | plan_Basic | 1        |            |            |                 | 2026-11-22T10:00:00Z      |
      | pattern   | plan_id         | cus_1       | basic      | 1        |            |            |                 | 2026-11-22T10:00:00Z      |
      | pattern   | plan_id         | cus_1       | plan_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx | 1 |  |      |                 | 2026-11-22T10:00:00Z      |
      | minimum   | quantity        | cus_1       | plan_basic | 0        |            |            |                 | 2026-11-22T10:00:00Z      |
      | maximum   | quantity        | cus_1       | plan_basic | 10001    |            |            |                 | 2026-11-22T10:00:00Z      |
      | minimum   | trial_days      | cus_1       | plan_basic | 1        | -1         |            |                 | 2026-11-22T10:00:00Z      |
      | maximum   | trial_days      | cus_1       | plan_basic | 1        | 731        |            |                 | 2026-11-22T10:00:00Z      |
      | format    | trial_end       | cus_1       | plan_basic | 1        |            | 2026/12/01 |                 | 2026-11-22T10:00:00Z      |
      | minLength | idempotency_key | cus_1       | plan_basic | 1        |            |            | ""              | 2026-11-22T10:00:00Z      |
      | maxLength | idempotency_key | cus_1       | plan_basic | 1        |            |            | kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk | 2026-11-22T10:00:00Z |
      | format    | utc_time        | cus_1       | plan_basic | 1        |            |            |                 | 2026-11-22 10:00:00       |
      | pattern   | utc_time        | cus_1       | plan_basic | 1        |            |            |                 | 2026-11-22T10:00:00+01:00 |

  Scenario Outline: A caller that breaks a rule is rejected
    When I run "create_subscription" with:
      | customer_id | plan_id    | quantity | caller.caller_kind | caller.customer_id | caller.staff_roles | now                  | plan                                                                                                         |
      | cus_1       | plan_basic | 1        | <kind>             | <customer>         | <roles>            | 2026-11-22T10:00:00Z | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                | definition  | kind     | customer | roles                          |
      | enum                | caller_kind | robot    |          |                                |
      | required            | caller      |          | cus_1    |                                |
      | customer_has_id     | caller      | customer |          |                                |
      | roles_are_for_staff | caller      | customer | cus_1    | [billing-admin]                |
      | minLength           | staff_role  | staff    |          | [""]                           |
      | uniqueItems         | staff_roles | staff    |          | [billing-admin, billing-admin] |

  Scenario: A request with no plan is rejected
    When I run "create_subscription" with:
      | customer_id | plan_id    | quantity | caller.caller_kind | caller.staff_roles | now                  |
      | cus_1       | plan_basic | 1        | staff              | [billing-admin]    | 2026-11-22T10:00:00Z |
    Then the input is rejected by "required" of "create_request"
