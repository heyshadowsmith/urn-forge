@urn-forge:strict
@urn:corpus:subscriptions:subscription:operation:announce_trial_end
Feature: Announce the end of a trial, 3 days before it ends

  The shell's clock calls this operation for each subscription that selectSubscriptionAnnounceTrialEndDue
  finds. It publishes subscription.trial_will_end once: the subscription keeps its status and gets
  the mark trial_will_end_sent_at, so a second call is not due.

  Scenario Outline: A trialing subscription is due from the day 3 days before its trial ends
    Given the time is "<now>"
    And the current subscription is:
      | subscription_id              | customer_id | plan | quantity | status   | current_period_start | current_period_end   | trial_end  |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | trialing | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z | 2026-11-25 |
    When I run the operation with:
      | subscription_id              |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa |
    Then the output is:
      | status   | trial_end  | trial_will_end_sent_at |
      | trialing | 2026-11-25 | <now>                  |
    And the operation emits "urn:corpus:subscriptions:subscription:event:trial_will_end":
      | subscription_id              | occurred_at |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <now>       |

    Examples:
      | now                      |
      | 2026-11-22T00:00:00Z     |
      | 2026-11-22T10:00:00Z     |
      | 2026-11-24T23:59:59.999Z |
      | 2026-11-26T08:00:00Z     |

  Scenario Outline: A trialing subscription is not due before the day 3 days before its trial ends
    Given the time is "<now>"
    And the current subscription is:
      | subscription_id              | customer_id | plan | quantity | status   | current_period_start | current_period_end   | trial_end  |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | trialing | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z | 2026-11-25 |
    When I run the operation with:
      | subscription_id              |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa |
    Then the operation is not due

    Examples:
      | now                      |
      | 2026-11-21T23:59:59.999Z |
      | 2026-11-01T10:00:00Z     |

  Scenario Outline: A trial that was announced already is not due again
    Given the time is "<now>"
    And the current subscription is:
      | subscription_id              | customer_id | plan | quantity | status   | current_period_start | current_period_end   | trial_end  | trial_will_end_sent_at |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | trialing | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z | 2026-11-25 | <trial_will_end_sent_at> |
    When I run the operation with:
      | subscription_id              |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa |
    Then the operation is not due

    Examples:
      | trial_will_end_sent_at | now                  |
      | 2026-11-22T00:00:00Z | 2026-11-22T00:01:00Z |
      | 2026-11-22T00:00:00Z | 2026-11-24T10:00:00Z |
      | 2026-11-23T10:00:00Z | 2026-11-23T10:00:00Z |

  Scenario: A trialing subscription with no trial end is never due
    Given the time is "2026-11-22T10:00:00Z"
    And the current subscription is:
      | subscription_id              | customer_id | plan | quantity | status   | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | trialing | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
    When I run the operation with:
      | subscription_id              |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa |
    Then the operation is not due

  Scenario Outline: A subscription that is no longer trialing is not announced, even when its trial end is near
    Given the time is "2026-11-23T10:00:00Z"
    And the current subscription is:
      | subscription_id              | customer_id | plan | quantity | status   | current_period_start | current_period_end   | trial_end  |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | <status> | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z | 2026-11-25 |
    When I run the operation with:
      | subscription_id              |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:invalid_state_transition":
      | subscription_id              | status   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <status> |
    And the operation emits no event

    Examples:
      | status   |
      | active   |
      | past_due |
      | paused   |
      | canceled |
      | expired  |

  Scenario: A subscription that is gone is not found
    Given the time is "2026-11-23T10:00:00Z"
    And there is no current subscription
    When I run the operation with:
      | subscription_id              |
      | sub_000000000000000000000000 |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:not_found"
    And the operation emits no event

  Scenario Outline: A request that breaks a field limit is rejected
    Given the time is "2026-11-23T10:00:00Z"
    And the current subscription is:
      | subscription_id              | customer_id | plan | quantity | status   | current_period_start | current_period_end   | trial_end  |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 1        | trialing | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z | 2026-11-25 |
    When I run the operation with:
      | subscription_id   |
      | <subscription_id> |
    Then the input is rejected on "subscription_id"

    Examples:
      | subscription_id               |
      | sub_short                     |
      | sub_AAAAAAAAAAAAAAAAAAAAAAAA  |
