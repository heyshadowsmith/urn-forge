Feature: Resume a subscription
  A paused subscription becomes active, with no resume day. A customer resumes only their own.

  Scenario: A paused subscription is resumed
    When I run "resume_subscription" with:
      | subscription_id              | caller.caller_kind | caller.customer_id | now                  | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end | stored_subscription.resume_on |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | customer           | cus_1              | 2026-11-22T10:00:00Z | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | paused | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z | 2026-12-15 |
    Then the output is "subscription_change":
      | subscription |
      | {"subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "active", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"} |

  Scenario Outline: A subscription that is not paused cannot be resumed
    When I run "resume_subscription" with:
      | subscription_id              | caller.caller_kind | now                  | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | staff              | 2026-11-22T10:00:00Z | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | <status> | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the output is "invalid_state_transition":
      | subscription_id              | subscription_status |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <status>            |

    Examples:
      | status   |
      | active   |
      | trialing |
      | canceled |
      | expired  |

  Scenario: A subscription that is not stored is not found
    When I run "resume_subscription" with:
      | subscription_id              | caller.caller_kind | now                  |
      | sub_000000000000000000000000 | staff              | 2026-11-22T10:00:00Z |
    Then the output is "subscription_not_found":
      | subscription_id              |
      | sub_000000000000000000000000 |

  Scenario: A customer may not resume another customer's subscription
    When I run "resume_subscription" with:
      | subscription_id              | caller.caller_kind | caller.customer_id | now                  | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | customer           | cus_2              | 2026-11-22T10:00:00Z | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | paused | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the output is "forbidden":
      | caller                                              |
      | {"caller_kind": "customer", "customer_id": "cus_2"} |

  Scenario Outline: A request that breaks a rule is rejected
    When I run "resume_subscription" with:
      | subscription_id   | caller.caller_kind | now   | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | <subscription_id> | staff              | <now> | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | paused | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the input is rejected by "<rule>" of "resume_request"

    Examples:
      | rule                   | subscription_id              | now                  |
      | names_the_subscription | sub_bbbbbbbbbbbbbbbbbbbbbbbb | 2026-11-22T10:00:00Z |
      | required               | sub_aaaaaaaaaaaaaaaaaaaaaaaa |                      |
