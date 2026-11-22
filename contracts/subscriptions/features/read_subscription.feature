@urn-forge:strict
@urn:corpus:subscriptions:subscription:operation:read_subscription
Feature: Read a subscription

  Scenario: A subscription is read with its plan and its price
    When I run the operation with:
      | subscription_id              |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa |
    Then the output is:
      | subscription_id              | status | plan                                                                                                | current_period_start | current_period_end   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | active | { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } } | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |

  Scenario Outline: A subscription id that is not "sub_" and 24 lowercase letters or digits is rejected
    When I run the operation with:
      | subscription_id   |
      | <subscription_id> |
    Then the input is rejected on "subscription_id"

    Examples:
      | subscription_id               |
      | sub_aaaaaaaaaaaaaaaaaaaaaaa   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaaa |
      | sub_AAAAAAAAAAAAAAAAAAAAAAAA  |
      | aaaaaaaaaaaaaaaaaaaaaaaaaaaa  |

  Scenario: An unknown subscription is not found
    When I run the operation with:
      | subscription_id              |
      | sub_000000000000000000000000 |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:not_found":
      | subscription_id              |
      | sub_000000000000000000000000 |
