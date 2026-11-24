Feature: List the invoices of a subscription
  The shell loads the subscription and its stored invoices; the answer holds the subscription's, with
  the status asked for if any. A customer lists only the invoices of their own subscriptions.

  Scenario Outline: The subscription's invoices with the status asked for are listed
    When I run "list_invoices" with:
      | subscription_id              | invoice_status | caller.caller_kind | caller.customer_id | stored_subscription | stored_invoices    |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <status>       | <kind>             | <customer>         | {"subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "active", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"} | [{"invoice_id": "in_1", "subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "invoice_status": "paid", "period_start": "2026-11-01T00:00:00Z", "period_end": "2026-12-01T00:00:00Z", "billing_period": "month", "interval_count": 1, "lines": [{"line_quantity": 2, "amount": {"amount_minor": 3000, "currency": "EUR"}}], "total": {"amount_minor": 3000, "currency": "EUR"}}, {"invoice_id": "in_2", "subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "invoice_status": "open", "period_start": "2026-11-01T00:00:00Z", "period_end": "2026-12-01T00:00:00Z", "billing_period": "month", "interval_count": 1, "lines": [{"line_quantity": 2, "amount": {"amount_minor": 3000, "currency": "EUR"}}], "total": {"amount_minor": 3000, "currency": "EUR"}}, {"invoice_id": "in_3", "subscription_id": "sub_bbbbbbbbbbbbbbbbbbbbbbbb", "invoice_status": "paid", "period_start": "2026-11-01T00:00:00Z", "period_end": "2026-12-01T00:00:00Z", "billing_period": "month", "interval_count": 1, "lines": [{"line_quantity": 2, "amount": {"amount_minor": 3000, "currency": "EUR"}}], "total": {"amount_minor": 3000, "currency": "EUR"}}] |
    Then the output is "invoice_list":
      | invoices |
      | <listed> |

    Examples:
      | status | kind     | customer | listed      |
      |        | staff    |          | [{"invoice_id": "in_1", "subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "invoice_status": "paid", "period_start": "2026-11-01T00:00:00Z", "period_end": "2026-12-01T00:00:00Z", "billing_period": "month", "interval_count": 1, "lines": [{"line_quantity": 2, "amount": {"amount_minor": 3000, "currency": "EUR"}}], "total": {"amount_minor": 3000, "currency": "EUR"}}, {"invoice_id": "in_2", "subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "invoice_status": "open", "period_start": "2026-11-01T00:00:00Z", "period_end": "2026-12-01T00:00:00Z", "billing_period": "month", "interval_count": 1, "lines": [{"line_quantity": 2, "amount": {"amount_minor": 3000, "currency": "EUR"}}], "total": {"amount_minor": 3000, "currency": "EUR"}}] |
      | open   | customer | cus_1    | [{"invoice_id": "in_2", "subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "invoice_status": "open", "period_start": "2026-11-01T00:00:00Z", "period_end": "2026-12-01T00:00:00Z", "billing_period": "month", "interval_count": 1, "lines": [{"line_quantity": 2, "amount": {"amount_minor": 3000, "currency": "EUR"}}], "total": {"amount_minor": 3000, "currency": "EUR"}}]       |
      | void   | staff    |          | []          |

  Scenario: The invoices of a subscription that is not stored are not found
    When I run "list_invoices" with:
      | subscription_id              | caller.caller_kind | stored_invoices |
      | sub_000000000000000000000000 | staff              | []              |
    Then the output is "subscription_not_found":
      | subscription_id              |
      | sub_000000000000000000000000 |

  Scenario: A customer may not list the invoices of another customer's subscription
    When I run "list_invoices" with:
      | subscription_id              | caller.caller_kind | caller.customer_id | stored_subscription | stored_invoices |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | customer           | cus_2              | {"subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "active", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"} | []              |
    Then the output is "forbidden":
      | caller                                              |
      | {"caller_kind": "customer", "customer_id": "cus_2"} |

  Scenario Outline: A request that breaks a rule is rejected
    When I run "list_invoices" with:
      | subscription_id   | invoice_status | caller.caller_kind | stored_subscription | stored_invoices |
      | <subscription_id> | <status>       | staff              | {"subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "active", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"} | <stored>        |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                   | definition           | subscription_id              | status | stored      |
      | names_the_subscription | invoice_list_request | sub_bbbbbbbbbbbbbbbbbbbbbbbb |        | []          |
      | enum                   | invoice_status       | sub_aaaaaaaaaaaaaaaaaaaaaaaa | lost   | []          |
      | required               | invoice_list_request | sub_aaaaaaaaaaaaaaaaaaaaaaaa |        |             |
      | uniqueItems            | invoices             | sub_aaaaaaaaaaaaaaaaaaaaaaaa |        | [{"invoice_id": "in_1", "subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "invoice_status": "paid", "period_start": "2026-11-01T00:00:00Z", "period_end": "2026-12-01T00:00:00Z", "billing_period": "month", "interval_count": 1, "lines": [{"line_quantity": 2, "amount": {"amount_minor": 3000, "currency": "EUR"}}], "total": {"amount_minor": 3000, "currency": "EUR"}}, {"invoice_id": "in_1", "subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "invoice_status": "paid", "period_start": "2026-11-01T00:00:00Z", "period_end": "2026-12-01T00:00:00Z", "billing_period": "month", "interval_count": 1, "lines": [{"line_quantity": 2, "amount": {"amount_minor": 3000, "currency": "EUR"}}], "total": {"amount_minor": 3000, "currency": "EUR"}}] |
