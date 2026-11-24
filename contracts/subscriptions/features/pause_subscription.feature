Feature: Pause a subscription
  An active or trialing subscription is paused, until a resume day from 1 to 90 days after the day of
  the request if one is given. A customer pauses only their own subscription.

  Scenario Outline: An active or trialing subscription is paused
    When I run "pause_subscription" with:
      | subscription_id              | resume_on   | caller.caller_kind | caller.customer_id | now   | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end | stored_subscription.trial_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <resume_on> | customer           | cus_1              | <now> | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | <status> | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z | <trial_end> |
    Then the output is "subscription_change"

    Examples:
      | status   | trial_end  | resume_on  | now                  |
      | active   |            |            | 2026-11-22T10:00:00Z |
      | trialing | 2026-12-01 | 2026-11-23 | 2026-11-22T10:00:00Z |
      | active   |            | 2027-02-20 | 2026-11-22T10:00:00Z |
      | active   |            | 2026-11-23 | 2026-11-22T23:59:59Z |
      | active   |            | 2027-02-20 | 2026-11-22T00:00:00Z |

  Scenario: The paused subscription keeps the resume day
    When I run "pause_subscription" with:
      | subscription_id              | resume_on  | caller.caller_kind | now                  | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | 2026-12-15 | staff              | 2026-11-22T10:00:00Z | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | active | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the output is "subscription_change":
      | subscription |
      | {"subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "paused", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z", "resume_on": "2026-12-15"} |

  Scenario Outline: A resume day that is not 1 to 90 days after the day of the request is rejected
    When I run "pause_subscription" with:
      | subscription_id              | resume_on   | caller.caller_kind | now   | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <resume_on> | staff              | <now> | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | active | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the input is rejected by "resume_on_in_window" of "pause_request"

    Examples:
      | resume_on  | now                  |
      | 2026-11-22 | 2026-11-22T10:00:00Z |
      | 2027-02-21 | 2026-11-22T10:00:00Z |
      | 2026-11-23 | 2026-11-23T00:00:00Z |
      | 2027-02-20 | 2026-11-21T23:59:59Z |

  Scenario Outline: A subscription that is neither active nor trialing cannot be paused
    When I run "pause_subscription" with:
      | subscription_id              | caller.caller_kind | now                  | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | staff              | 2026-11-22T10:00:00Z | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | <status> | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the output is "invalid_state_transition":
      | subscription_id              | subscription_status |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <status>            |

    Examples:
      | status   |
      | paused   |
      | past_due |
      | canceled |
      | expired  |

  Scenario: A subscription that is not stored is not found
    When I run "pause_subscription" with:
      | subscription_id              | caller.caller_kind | now                  |
      | sub_000000000000000000000000 | staff              | 2026-11-22T10:00:00Z |
    Then the output is "subscription_not_found":
      | subscription_id              |
      | sub_000000000000000000000000 |

  Scenario: A customer may not pause another customer's subscription
    When I run "pause_subscription" with:
      | subscription_id              | caller.caller_kind | caller.customer_id | now                  | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | customer           | cus_2              | 2026-11-22T10:00:00Z | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | active | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the output is "forbidden":
      | caller                                              |
      | {"caller_kind": "customer", "customer_id": "cus_2"} |

  Scenario Outline: A request that breaks a rule is rejected
    When I run "pause_subscription" with:
      | subscription_id   | resume_on   | caller.caller_kind | now   | stored_subscription.subscription_id | stored_subscription.customer_id | stored_subscription.plan | stored_subscription.plan_id | stored_subscription.quantity | stored_subscription.subscription_status | stored_subscription.current_period_start | stored_subscription.current_period_end |
      | <subscription_id> | <resume_on> | staff              | <now> | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1 | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | plan_basic | 1 | active | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                   | definition    | subscription_id              | resume_on  | now                  |
      | names_the_subscription | pause_request | sub_bbbbbbbbbbbbbbbbbbbbbbbb |            | 2026-11-22T10:00:00Z |
      | format                 | resume_on     | sub_aaaaaaaaaaaaaaaaaaaaaaaa | 15/12/2026 | 2026-11-22T10:00:00Z |
      | required               | pause_request | sub_aaaaaaaaaaaaaaaaaaaaaaaa |            |                      |
