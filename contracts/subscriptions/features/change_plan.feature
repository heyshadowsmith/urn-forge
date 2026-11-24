Feature: Change the plan of a subscription
  Staff with the billing-admin role move a live subscription to another plan of the same currency.
  The shell loads the subscription, the new plan and, if any, the customer's live subscription to the
  new plan. A plan with the same period keeps the current period; another one starts a period now.
  With at_period_end the plan stays and the new one is scheduled.

  Scenario Outline: A live subscription moves to another plan
    When I run "change_plan" with:
      | subscription_id              | plan_id   | proration   | caller.caller_kind | caller.staff_roles | now                  | new_plan   | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <plan_id> | <proration> | staff | [billing-admin] | 2026-11-22T10:00:00Z | <new_plan> | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | <status> | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the output is "subscription_change"

    Examples:
      | status   | plan_id         | proration     | new_plan |
      | active   | plan_pro        | immediate     | {"plan_id": "plan_pro", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 3000, "currency": "EUR"}} |
      | trialing | plan_pro        | none          | {"plan_id": "plan_pro", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 3000, "currency": "EUR"}} |
      | past_due | plan_pro-yearly | immediate     | {"plan_id": "plan_pro-yearly", "billing_period": "year", "interval_count": 1, "price": {"amount_minor": 30000, "currency": "EUR"}} |
      | paused   | plan_pro-yearly | at_period_end | {"plan_id": "plan_pro-yearly", "billing_period": "year", "interval_count": 1, "price": {"amount_minor": 30000, "currency": "EUR"}} |

  Scenario: A plan with another period starts a new period now, which ends on the last day of a shorter month
    When I run "change_plan" with:
      | subscription_id              | plan_id         | proration | caller.caller_kind | caller.staff_roles | now                  | new_plan | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro-yearly | immediate | staff | [billing-admin] | 2028-02-29T10:00:00Z | {"plan_id": "plan_pro-yearly", "billing_period": "year", "interval_count": 1, "price": {"amount_minor": 30000, "currency": "EUR"}} | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | active | 2028-02-01T00:00:00Z | 2028-03-01T00:00:00Z |
    Then the output is "subscription_change":
      | subscription |
      | {"subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "customer_id": "cus_1", "plan": {"plan_id": "plan_pro-yearly", "billing_period": "year", "interval_count": 1, "price": {"amount_minor": 30000, "currency": "EUR"}}, "plan_id": "plan_pro-yearly", "quantity": 1, "subscription_status": "active", "current_period_start": "2028-02-29T10:00:00Z", "current_period_end": "2029-02-28T10:00:00Z"} |

  Scenario: With at_period_end the plan and the period stay, and the new plan is scheduled
    When I run "change_plan" with:
      | subscription_id              | plan_id  | proration     | caller.caller_kind | caller.staff_roles | now                  | new_plan | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro | at_period_end | staff | [billing-admin] | 2026-11-22T10:00:00Z | {"plan_id": "plan_pro", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 3000, "currency": "EUR"}} | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | active | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the output is "subscription_change":
      | subscription |
      | {"subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "active", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z", "scheduled_plan_id": "plan_pro"} |

  Scenario: A subscription that is not stored is not found
    When I run "change_plan" with:
      | subscription_id              | plan_id  | proration | caller.caller_kind | caller.staff_roles | now                  | new_plan |
      | sub_000000000000000000000000 | plan_pro | immediate | staff | [billing-admin] | 2026-11-22T10:00:00Z | {"plan_id": "plan_pro", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 3000, "currency": "EUR"}} |
    Then the output is "subscription_not_found":
      | subscription_id              |
      | sub_000000000000000000000000 |

  Scenario Outline: A canceled or expired subscription cannot change its plan
    When I run "change_plan" with:
      | subscription_id              | plan_id  | proration | caller.caller_kind | caller.staff_roles | now                  | new_plan | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro | immediate | staff | [billing-admin] | 2026-11-22T10:00:00Z | {"plan_id": "plan_pro", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 3000, "currency": "EUR"}} | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | <status> | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the output is "invalid_state_transition":
      | subscription_id              | subscription_status |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <status>            |

    Examples:
      | status   |
      | canceled |
      | expired  |

  Scenario: A plan in another currency is refused
    When I run "change_plan" with:
      | subscription_id              | plan_id      | proration | caller.caller_kind | caller.staff_roles | now                  | new_plan | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro-usd | immediate | staff | [billing-admin] | 2026-11-22T10:00:00Z | {"plan_id": "plan_pro-usd", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 3000, "currency": "USD"}} | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | active | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the output is "currency_mismatch":
      | plan_currency | subscription_currency |
      | USD           | EUR                   |

  Scenario Outline: A customer with a live subscription to the new plan gets conflict
    When I run "change_plan" with:
      | subscription_id              | plan_id  | proration | caller.caller_kind | caller.staff_roles | now                  | new_plan | existing_subscription | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro | immediate | staff | [billing-admin] | 2026-11-22T10:00:00Z | {"plan_id": "plan_pro", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 3000, "currency": "EUR"}} | {"subscription_id": "sub_bbbbbbbbbbbbbbbbbbbbbbbb", "customer_id": "cus_1", "plan": {"plan_id": "plan_pro", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 3000, "currency": "EUR"}}, "plan_id": "plan_pro", "quantity": 1, "subscription_status": "<status>", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"} | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | active | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the output is "conflict":
      | customer_id | plan_id  |
      | cus_1       | plan_pro |

    Examples:
      | status   |
      | active   |
      | paused   |

  Scenario Outline: Only staff with the billing-admin role may change a plan
    When I run "change_plan" with:
      | subscription_id              | plan_id  | proration | caller.caller_kind | caller.customer_id | caller.staff_roles | now                  | new_plan | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro | immediate | <kind>             | <customer>         | <roles>            | 2026-11-22T10:00:00Z | {"plan_id": "plan_pro", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 3000, "currency": "EUR"}} | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | active | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the output is "forbidden":
      | caller   |
      | <caller> |

    Examples:
      | kind     | customer | roles     | caller                                                |
      | customer | cus_1    |           | {"caller_kind": "customer", "customer_id": "cus_1"}  |
      | staff    |          | [support] | {"caller_kind": "staff", "staff_roles": ["support"]} |

  Scenario Outline: A request that does not match what was loaded is rejected
    When I run "change_plan" with:
      | subscription_id   | plan_id   | proration | caller.caller_kind | caller.staff_roles | now                  | new_plan | existing_subscription | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | <subscription_id> | <plan_id> | immediate | staff | [billing-admin] | 2026-11-22T10:00:00Z | {"plan_id": "plan_pro", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 3000, "currency": "EUR"}} | <existing> | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | active | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the input is rejected by "<rule>" of "change_plan_request"

    Examples:
      | rule | subscription_id | plan_id | existing |
      | names_the_subscription | sub_bbbbbbbbbbbbbbbbbbbbbbbb | plan_pro |  |
      | names_the_new_plan | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro-yearly |  |
      | existing_is_the_holders_live_one | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro | {"subscription_id": "sub_bbbbbbbbbbbbbbbbbbbbbbbb", "customer_id": "cus_1", "plan": {"plan_id": "plan_pro", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 3000, "currency": "EUR"}}, "plan_id": "plan_pro", "quantity": 1, "subscription_status": "canceled", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"} |

  Scenario Outline: A request that breaks a rule is rejected
    When I run "change_plan" with:
      | subscription_id              | plan_id  | proration   | caller.caller_kind | caller.staff_roles | now                  | new_plan   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | plan_pro | <proration> | staff | [billing-admin] | 2026-11-22T10:00:00Z | <new_plan> |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition          | proration | new_plan |
      | enum     | proration           | later     | {"plan_id": "plan_pro", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 3000, "currency": "EUR"}} |
      | required | change_plan_request | immediate |          |
