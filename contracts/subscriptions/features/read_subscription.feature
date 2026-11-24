Feature: Read a subscription
  The shell loads the subscription that the request names. Staff read any subscription; a customer
  reads only their own.

  Scenario Outline: The stored subscription is the answer
    When I run "read_subscription" with:
      | subscription_id              | caller.caller_kind | caller.customer_id | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <kind>             | <customer>         | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | active | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the output is "subscription":
      | subscription_id              | customer_id | subscription_status | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | active              | 2026-12-01T00:00:00Z |

    Examples:
      | kind     | customer |
      | staff    |          |
      | customer | cus_1    |

  Scenario: A subscription that is not stored is not found
    When I run "read_subscription" with:
      | subscription_id              | caller.caller_kind |
      | sub_000000000000000000000000 | staff              |
    Then the output is "subscription_not_found":
      | subscription_id              |
      | sub_000000000000000000000000 |

  Scenario: A customer may not read another customer's subscription
    When I run "read_subscription" with:
      | subscription_id              | caller.caller_kind | caller.customer_id | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | customer           | cus_2              | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | active | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the output is "forbidden":
      | caller                                              |
      | {"caller_kind": "customer", "customer_id": "cus_2"} |

  Scenario: A request that names another subscription than the one loaded is rejected
    When I run "read_subscription" with:
      | subscription_id              | caller.caller_kind | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_bbbbbbbbbbbbbbbbbbbbbbbb | staff              | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | active | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the input is rejected by "names_the_subscription" of "subscription_lookup"

  Scenario Outline: A request that breaks a rule is rejected
    When I run "read_subscription" with:
      | subscription_id   | caller.caller_kind |
      | <subscription_id> | <kind>             |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition          | subscription_id              | kind  |
      | pattern  | subscription_id     | sub_AAAAAAAAAAAAAAAAAAAAAAAA | staff |
      | pattern  | subscription_id     | sub_aaaa                     | staff |
      | required | subscription_lookup | sub_aaaaaaaaaaaaaaaaaaaaaaaa |       |
