@urn-forge:strict
@urn:corpus:subscriptions:subscription:operation:list_subscriptions
Feature: List the subscriptions of a customer

  Scenario: All subscriptions of a customer are listed
    When I run the operation with:
      | customer_id |
      | c           |
    Then the output is:
      | subscriptions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
      | [{ subscription_id: sub_aaaaaaaaaaaaaaaaaaaaaaaa, customer_id: c, plan: { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } }, quantity: 1, status: active, current_period_start: 2026-11-01T00:00:00Z, current_period_end: 2026-12-01T00:00:00Z }, { subscription_id: sub_pppppppppppppppppppppppp, customer_id: c, plan: { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } }, quantity: 1, status: paused, current_period_start: 2026-11-01T00:00:00Z, current_period_end: 2026-12-01T00:00:00Z }, { subscription_id: sub_cccccccccccccccccccccccc, customer_id: c, plan: { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } }, quantity: 1, status: canceled, current_period_start: 2026-11-01T00:00:00Z, current_period_end: 2026-12-01T00:00:00Z }] |

  Scenario Outline: A list can keep one status only
    When I run the operation with:
      | customer_id | status   |
      | cus_1       | <status> |
    Then the output is:
      | subscriptions |
      | <subscriptions>      |

    Examples:
      | status   | subscriptions |
      | trialing | []     |
      | past_due | []     |
      | expired  | []     |

  Scenario Outline: A list of one status gives the subscriptions of that status
    When I run the operation with:
      | customer_id | status   |
      | cus_1       | <status> |
    Then the output is:
      | subscriptions   |
      | <subscriptions> |

    Examples:
      | status   | subscriptions |
      | active   | [{ subscription_id: sub_aaaaaaaaaaaaaaaaaaaaaaaa, customer_id: cus_1, plan: { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } }, quantity: 1, status: active, current_period_start: 2026-11-01T00:00:00Z, current_period_end: 2026-12-01T00:00:00Z }] |
      | paused   | [{ subscription_id: sub_pppppppppppppppppppppppp, customer_id: cus_1, plan: { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } }, quantity: 1, status: paused, current_period_start: 2026-11-01T00:00:00Z, current_period_end: 2026-12-01T00:00:00Z }] |
      | canceled | [{ subscription_id: sub_cccccccccccccccccccccccc, customer_id: cus_1, plan: { plan_id: plan_basic, billing_period: month, interval_count: 1, price: { amount_minor: 1500, currency: EUR } }, quantity: 1, status: canceled, current_period_start: 2026-11-01T00:00:00Z, current_period_end: 2026-12-01T00:00:00Z }] |

  Scenario Outline: An unknown status or an empty customer id is rejected
    When I run the operation with:
      | customer_id   | status   |
      | <customer_id> | <status> |
    Then the input is rejected on "<field>"

    Examples:
      | field       | customer_id | status   |
      | status      | cus_1       | unpaid   |
      | customer_id | ""          |          |
