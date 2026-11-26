Feature: The rules of the values
  Each value that crosses the boundary is checked: in a request, in an answer, and in a stored record
  that the shell loads.

  Scenario Outline: A money amount that breaks a rule is rejected
    When I check a "money" with:
      | amount_minor | currency   |
      | <amount>     | <currency> |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition   | amount    | currency |
      | minimum  | amount_minor | -1        | EUR      |
      | maximum  | amount_minor | 100000000 | EUR      |
      | enum     | currency     | 100       | CHF      |
      | enum     | currency     | 100       | eur      |
      | required | money        |           | EUR      |

  Scenario Outline: A money amount at the edges is accepted
    When I check a "money" with:
      | amount_minor | currency   |
      | <amount>     | <currency> |
    Then the value is accepted

    Examples:
      | amount   | currency |
      | 0        | EUR      |
      | 99999999 | GBP      |
      | 1500     | USD      |

  Scenario Outline: A plan that breaks a rule is rejected
    When I check a "plan" with:
      | plan_id   | billing_period | interval_count | price.amount_minor | price.currency |
      | <plan_id> | <period>       | <count>        | 1500               | EUR            |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                   | definition     | plan_id    | period | count |
      | enum                   | billing_period | plan_basic | week   | 1     |
      | minimum                | interval_count | plan_basic | month  | 0     |
      | maximum                | interval_count | plan_basic | month  | 13    |
      | yearly_interval_is_one | plan           | plan_basic | year   | 2     |
      | required               | plan           | plan_basic |        | 1     |

  Scenario Outline: A plan within the limits is accepted
    When I check a "plan" with:
      | plan_id   | billing_period | interval_count | price.amount_minor | price.currency |
      | <plan_id> | <period>       | <count>        | 1500               | EUR            |
    Then the value is accepted

    Examples:
      | plan_id                                       | period | count |
      | plan_basic                                    | month  | 12    |
      | plan_pro-yearly                               | year   | 1     |
      | plan_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx | month  | 1     |

  Scenario Outline: A subscription that breaks a rule is rejected
    When I check a "subscription" with:
      | subscription_id              | customer_id | plan | plan_id   | quantity | subscription_status | current_period_start | current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}} | <plan_id> | 1        | active              | <start>              | <end>              |
    Then the value is rejected by "<rule>" of "subscription"

    Examples:
      | rule                    | plan_id    | start                | end                  |
      | plan_id_is_plan         | plan_pro   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z |
      | period_ends_after_start | plan_basic | 2026-12-01T00:00:00Z | 2026-12-01T00:00:00Z |
      | period_is_the_plans     | plan_basic | 2026-01-31T10:00:00Z | 2026-03-03T10:00:00Z |
      | period_is_the_plans     | plan_basic | 2026-01-31T10:00:00Z | 2026-02-27T10:00:00Z |
      | period_is_the_plans     | plan_basic | 2028-01-31T10:00:00Z | 2028-02-28T10:00:00Z |
      | period_is_the_plans     | plan_basic | 2026-11-01T00:00:00Z | 2026-12-11T00:00:00Z |
      | period_is_the_plans     | plan_basic | 2026-01-31T10:00:00Z | 2026-02-28T23:59:59Z |
      | period_is_the_plans     | plan_basic | 2026-12-31T10:00:00Z | 2026-01-31T10:00:00Z |
      | required                | plan_basic | 2026-11-01T00:00:00Z |                      |

  Scenario Outline: A period of the plan's calendar months, which ends on the last day of a shorter month, is accepted
    When I check a "subscription" with:
      | subscription_id              | customer_id | plan                                                                                                                                  | plan_id   | quantity | subscription_status | current_period_start | current_period_end |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | cus_1       | {"plan_id": "<plan_id>", "billing_period": "<period>", "interval_count": <count>, "price": {"amount_minor": 1500, "currency": "EUR"}} | <plan_id> | 1        | active              | <start>              | <end>              |
    Then the value is accepted

    Examples:
      | plan_id    | period | count | start                    | end                      |
      | plan_basic | month  | 1     | 2026-01-31T10:00:00Z     | 2026-02-28T10:00:00Z     |
      | plan_basic | month  | 1     | 2028-01-31T10:00:00Z     | 2028-02-29T10:00:00Z     |
      | plan_basic | month  | 1     | 2026-03-31T00:00:00Z     | 2026-04-30T00:00:00Z     |
      | plan_basic | month  | 1     | 2026-12-31T23:59:59.250Z | 2027-01-31T23:59:59.250Z |
      | plan_basic | month  | 1     | 2026-02-28T10:00:00Z     | 2026-03-28T10:00:00Z     |
      | plan_team  | month  | 3     | 2026-11-30T10:00:00Z     | 2027-02-28T10:00:00Z     |
      | plan_team  | month  | 12    | 2026-05-15T08:30:00Z     | 2027-05-15T08:30:00Z     |
      | plan_pro   | year   | 1     | 2028-02-29T10:00:00Z     | 2029-02-28T10:00:00Z     |
      | plan_pro   | year   | 1     | 2100-01-31T10:00:00Z     | 2101-01-31T10:00:00Z     |

  Scenario Outline: An event that breaks a rule is rejected
    When I check an "event" with:
      | event_id   | event_type   | subscription_id              | invoice_id   | occurred_at          |
      | <event_id> | <event_type> | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <invoice_id> | 2026-11-22T10:00:00Z |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                        | definition | event_id                             | event_type           | invoice_id |
      | pattern                     | event_id   | 1                                    | subscription.created |            |
      | enum                        | event_type | 00000000-0000-4000-8000-000000000001 | subscription.deleted |            |
      | invoice_event_names_invoice | event      | 00000000-0000-4000-8000-000000000001 | invoice.paid         |            |
      | invoice_event_names_invoice | event      | 00000000-0000-4000-8000-000000000001 | subscription.created | in_1       |
      | required                    | event      |                                      | subscription.created |            |

  Scenario Outline: A subscription change that breaks a rule is rejected
    When I check a "subscription_change" with:
      | subscription | events   |
      | {"subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "active", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"} | <events> |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                        | definition          | events       |
      | event_ids_differ            | events              | [{"event_id": "00000000-0000-4000-8000-000000000001", "event_type": "subscription.updated", "subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "occurred_at": "2026-11-22T10:00:00Z"}, {"event_id": "00000000-0000-4000-8000-000000000001", "event_type": "subscription.canceled", "subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "occurred_at": "2026-11-22T10:00:00Z"}] |
      | events_name_the_subscription | subscription_change | [{"event_id": "00000000-0000-4000-8000-000000000002", "event_type": "subscription.updated", "subscription_id": "sub_bbbbbbbbbbbbbbbbbbbbbbbb", "occurred_at": "2026-11-22T10:00:00Z"}]       |
      | required                    | subscription_change |              |

  Scenario Outline: An invoice that breaks a rule is rejected
    When I check an "invoice" with:
      | invoice_id | subscription_id              | invoice_status | period_start         | period_end   | billing_period | interval_count | lines   | total   |
      | in_1       | sub_aaaaaaaaaaaaaaaaaaaaaaaa | paid           | 2026-11-01T00:00:00Z | <period_end> | month          | 1              | <lines> | <total> |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                                 | definition    | period_end           | lines                                                                                                                                                  | total                                     |
      | invoice_period_ends_after_start      | invoice       | 2026-10-01T00:00:00Z | [{"line_quantity": 1, "amount": {"amount_minor": 3000, "currency": "EUR"}}]                                                                            | {"amount_minor": 3000, "currency": "EUR"} |
      | invoice_period_is_its_billing_period | invoice       | 2026-12-02T00:00:00Z | [{"line_quantity": 1, "amount": {"amount_minor": 3000, "currency": "EUR"}}]                                                                            | {"amount_minor": 3000, "currency": "EUR"} |
      | invoice_period_is_its_billing_period | invoice       | 2027-11-01T00:00:00Z | [{"line_quantity": 1, "amount": {"amount_minor": 3000, "currency": "EUR"}}]                                                                            | {"amount_minor": 3000, "currency": "EUR"} |
      | total_is_sum                         | invoice       | 2026-12-01T00:00:00Z | [{"line_quantity": 1, "amount": {"amount_minor": 1000, "currency": "EUR"}}, {"line_quantity": 2, "amount": {"amount_minor": 2500, "currency": "EUR"}}] | {"amount_minor": 3000, "currency": "EUR"} |
      | lines_in_total_currency              | invoice       | 2026-12-01T00:00:00Z | [{"line_quantity": 1, "amount": {"amount_minor": 3000, "currency": "USD"}}]                                                                            | {"amount_minor": 3000, "currency": "EUR"} |
      | minimum                              | line_quantity | 2026-12-01T00:00:00Z | [{"line_quantity": 0, "amount": {"amount_minor": 3000, "currency": "EUR"}}]                                                                            | {"amount_minor": 3000, "currency": "EUR"} |
      | required                             | line          | 2026-12-01T00:00:00Z | [{"amount": {"amount_minor": 3000, "currency": "EUR"}}]                                                                                                | {"amount_minor": 3000, "currency": "EUR"} |
      | minimum                              | amount_minor  | 2026-12-01T00:00:00Z | [{"line_quantity": 1, "amount": {"amount_minor": 0, "currency": "EUR"}}]                                                                               | {"amount_minor": -1, "currency": "EUR"}   |
      | required                             | invoice       | 2026-12-01T00:00:00Z | [{"line_quantity": 1, "amount": {"amount_minor": 3000, "currency": "EUR"}}]                                                                            |                                           |

  Scenario: An invoice whose total is the sum of its lines, in its currency, is accepted
    When I check an "invoice" with:
      | invoice_id | subscription_id              | invoice_status | period_start         | period_end           | billing_period | interval_count | lines                                                                                                                         | total                                     |
      | in_1       | sub_aaaaaaaaaaaaaaaaaaaaaaaa | open           | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z | month          | 1              | [{"line_quantity": 1, "amount": {"amount_minor": 1000, "currency": "GBP"}}, {"line_quantity": 2, "amount": {"amount_minor": 2000, "currency": "GBP"}}] | {"amount_minor": 3000, "currency": "GBP"} |
    Then the value is accepted

  Scenario Outline: An answer with a missing property is rejected
    When I check a "<definition>" with:
      | <property> |
      | <value>    |
    Then the value is rejected by "required" of "<definition>"

    Examples:
      | definition               | property              | value                        |
      | subscription_list        | subscriptions         |                              |
      | invoice_list             | invoices              |                              |
      | subscription_not_found   | subscription_id       |                              |
      | invoice_not_found        | invoice_id            |                              |
      | conflict                 | customer_id           | cus_1                        |
      | invalid_state_transition | subscription_id       | sub_aaaaaaaaaaaaaaaaaaaaaaaa |
      | currency_mismatch        | plan_currency         | USD                          |
      | forbidden                | caller                |                              |
