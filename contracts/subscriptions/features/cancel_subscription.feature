Feature: Cancel a subscription
  Cancelling immediately makes a live subscription canceled; cancelling at the period end keeps its
  status and marks it. A canceled or expired subscription cannot change. A customer cancels only
  their own.

  Scenario Outline: A live subscription is canceled immediately
    When I run "cancel_subscription" with:
      | subscription_id              | cancel_mode | caller.caller_kind | caller.customer_id | now                  | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | immediately | customer           | cus_1              | 2026-11-22T10:00:00Z | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | <status> | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the output is "subscription_change":
      | subscription |
      | {"subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "canceled", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"} |

    Examples:
      | status   |
      | trialing |
      | active   |
      | past_due |
      | paused   |

  Scenario: A subscription canceled at the period end keeps its status until then
    When I run "cancel_subscription" with:
      | subscription_id              | cancel_mode   | caller.caller_kind | now                  | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | at_period_end | staff              | 2026-11-22T10:00:00Z | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | past_due | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the output is "subscription_change":
      | subscription |
      | {"subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "past_due", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z", "cancel_at": "at_period_end"} |

  Scenario Outline: A canceled or expired subscription cannot be canceled again
    When I run "cancel_subscription" with:
      | subscription_id              | cancel_mode   | caller.caller_kind | now                  | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <cancel_mode> | staff              | 2026-11-22T10:00:00Z | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | <status> | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the output is "invalid_state_transition":
      | subscription_id              | subscription_status |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <status>            |

    Examples:
      | status   | cancel_mode   |
      | canceled | immediately   |
      | expired  | at_period_end |

  Scenario: A subscription that is not stored is not found
    When I run "cancel_subscription" with:
      | subscription_id              | cancel_mode | caller.caller_kind | now                  |
      | sub_000000000000000000000000 | immediately | staff              | 2026-11-22T10:00:00Z |
    Then the output is "subscription_not_found":
      | subscription_id              |
      | sub_000000000000000000000000 |

  Scenario: A customer may not cancel another customer's subscription
    When I run "cancel_subscription" with:
      | subscription_id              | cancel_mode | caller.caller_kind | caller.customer_id | now                  | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | immediately | customer           | cus_2              | 2026-11-22T10:00:00Z | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | active | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the output is "forbidden":
      | caller                                              |
      | {"caller_kind": "customer", "customer_id": "cus_2"} |

  Scenario Outline: A request that breaks a rule is rejected
    When I run "cancel_subscription" with:
      | subscription_id   | cancel_mode   | caller.caller_kind | now                  | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | <subscription_id> | <cancel_mode> | staff              | 2026-11-22T10:00:00Z | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | active | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                   | definition     | subscription_id              | cancel_mode |
      | names_the_subscription | cancel_request | sub_bbbbbbbbbbbbbbbbbbbbbbbb | immediately |
      | enum                   | cancel_mode    | sub_aaaaaaaaaaaaaaaaaaaaaaaa | later       |
      | required               | cancel_request | sub_aaaaaaaaaaaaaaaaaaaaaaaa |             |
