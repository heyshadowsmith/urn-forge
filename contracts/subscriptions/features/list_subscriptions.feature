Feature: List the subscriptions of a customer
  The shell loads the stored subscriptions; the answer holds the customer's, with the status asked
  for if any. A customer lists only their own.

  Scenario Outline: The customer's subscriptions with the status asked for are listed
    When I run "list_subscriptions" with:
      | customer_id | subscription_status | caller.caller_kind | caller.customer_id | stored_subscriptions                       |
      | cus_1       | <status>            | <kind>             | <customer>         | [{"subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "active", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"}, {"subscription_id": "sub_pppppppppppppppppppppppp", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "paused", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"}, {"subscription_id": "sub_bbbbbbbbbbbbbbbbbbbbbbbb", "customer_id": "cus_2", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "active", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"}] |
    Then the output is "subscription_list":
      | subscriptions |
      | <listed>      |

    Examples:
      | status   | kind     | customer | listed                       |
      |          | staff    |          | [{"subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "active", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"}, {"subscription_id": "sub_pppppppppppppppppppppppp", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "paused", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"}] |
      | paused   | customer | cus_1    | [{"subscription_id": "sub_pppppppppppppppppppppppp", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "paused", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"}]               |
      | canceled | staff    |          | []                           |

  Scenario: A customer may not list another customer's subscriptions
    When I run "list_subscriptions" with:
      | customer_id | caller.caller_kind | caller.customer_id | stored_subscriptions |
      | cus_2       | customer           | cus_1              | []                   |
    Then the output is "forbidden":
      | caller                                              |
      | {"caller_kind": "customer", "customer_id": "cus_1"} |

  Scenario Outline: A request that breaks a rule is rejected
    When I run "list_subscriptions" with:
      | customer_id | subscription_status | caller.caller_kind | stored_subscriptions |
      | cus_1       | <status>            | staff              | <stored>             |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule        | definition          | status | stored                       |
      | enum        | subscription_status | lost   | []                           |
      | required    | list_request        |        |                              |
      | uniqueItems | subscriptions       |        | [{"subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "active", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"}, {"subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "active", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"}] |
