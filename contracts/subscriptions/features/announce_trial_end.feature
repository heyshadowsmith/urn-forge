Feature: Announce the end of a trial
  The shell's clock calls it for a trialing subscription whose trial ends within 3 days of today and
  was not announced yet. The subscription keeps its status and is marked as announced now.

  Scenario Outline: A trial that ends within 3 days is announced
    When I run "announce_trial_end" with:
      | subscription_id              | caller.caller_kind | now   | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end | stored_subscription.trial_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <kind>             | <now> | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | trialing | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z | <trial_end> |
    Then the output is "subscription_change"

    Examples:
      | kind  | trial_end  | now                  |
      | clock | 2026-11-25 | 2026-11-22T10:00:00Z |
      | clock | 2026-11-25 | 2026-11-22T00:00:00Z |
      | staff | 2026-11-23 | 2026-11-22T23:59:59Z |
      | clock | 2026-11-20 | 2026-11-22T10:00:00Z |

  Scenario: The announced subscription keeps its trial end and gets the mark
    When I run "announce_trial_end" with:
      | subscription_id              | caller.caller_kind | now                  | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end | stored_subscription.trial_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | clock              | 2026-11-22T10:00:00Z | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | trialing | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z | 2026-11-25 |
    Then the output is "subscription_change":
      | subscription |
      | {"subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "trialing", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z", "trial_end": "2026-11-25", "trial_will_end_sent_at": "2026-11-22T10:00:00Z"} |

  Scenario Outline: A trial that is not due, was announced, or is not trialing is refused
    When I run "announce_trial_end" with:
      | subscription_id              | caller.caller_kind | now   | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end | stored_subscription.trial_end | stored_subscription.trial_will_end_sent_at |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | clock              | <now> | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | <status> | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z | <trial_end> | <sent_at> |
    Then the output is "invalid_state_transition":
      | subscription_id              | subscription_status |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <status>            |

    Examples:
      | status   | trial_end  | sent_at              | now                  |
      | trialing | 2026-11-26 |                      | 2026-11-22T10:00:00Z |
      | trialing | 2026-11-26 |                      | 2026-11-22T23:59:59Z |
      | trialing | 2026-11-25 | 2026-11-22T09:00:00Z | 2026-11-22T10:00:00Z |
      | trialing |            |                      | 2026-11-22T10:00:00Z |
      | active   | 2026-11-25 |                      | 2026-11-22T10:00:00Z |
      | canceled | 2026-11-25 |                      | 2026-11-22T10:00:00Z |

  Scenario: A subscription that is not stored is not found
    When I run "announce_trial_end" with:
      | subscription_id              | caller.caller_kind | now                  |
      | sub_000000000000000000000000 | clock              | 2026-11-22T10:00:00Z |
    Then the output is "subscription_not_found":
      | subscription_id              |
      | sub_000000000000000000000000 |

  Scenario: A customer may not announce the end of a trial
    When I run "announce_trial_end" with:
      | subscription_id              | caller.caller_kind | caller.customer_id | now                  | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end | stored_subscription.trial_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | customer           | cus_1              | 2026-11-22T10:00:00Z | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | trialing | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z | 2026-11-25 |
    Then the output is "forbidden":
      | caller                                              |
      | {"caller_kind": "customer", "customer_id": "cus_1"} |

  Scenario Outline: A request that breaks a rule is rejected
    When I run "announce_trial_end" with:
      | subscription_id   | caller.caller_kind | now   | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end | stored_subscription.trial_end |
      | <subscription_id> | clock              | <now> | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | trialing | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z | 2026-11-25 |
    Then the input is rejected by "<rule>" of "announce_request"

    Examples:
      | rule                   | subscription_id              | now                  |
      | names_the_subscription | sub_bbbbbbbbbbbbbbbbbbbbbbbb | 2026-11-22T10:00:00Z |
      | required               | sub_aaaaaaaaaaaaaaaaaaaaaaaa |                      |
