Feature: Read an invoice
  The shell loads the invoice that the request names and its subscription. Staff read any invoice; a
  customer reads only the invoices of their own subscriptions. Every invoice that is answered has a
  total that is the sum of its lines, and a period that ends after it starts.

  Scenario Outline: The stored invoice is the answer
    When I run "read_invoice" with:
      | invoice_id | caller.caller_kind | caller.customer_id | stored_invoice.invoice_id | stored_invoice.subscription_id | stored_invoice.invoice_status | stored_invoice.period_start | stored_invoice.period_end | stored_invoice.billing_period | stored_invoice.interval_count | stored_invoice.lines | stored_invoice.total | stored_subscription |
      | in_1       | <kind>             | <customer>         | in_1 | sub_aaaaaaaaaaaaaaaaaaaaaaaa | paid | <start> | <end> | <period> | <count> | [{"line_quantity": 2, "amount": {"amount_minor": 3000, "currency": "EUR"}}] | {"amount_minor": 3000, "currency": "EUR"} | {"subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "active", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"} |
    Then the output is "invoice":
      | invoice_id | invoice_status | period_start | period_end | total |
      | in_1       | paid           | <start>      | <end>      | {"amount_minor": 3000, "currency": "EUR"} |

    Examples:
      | kind     | customer | start                | end                  | period | count |
      | staff    |          | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z | month  | 1     |
      | customer | cus_1    | 2026-01-31T00:00:00Z | 2026-02-28T00:00:00Z | month  | 1     |
      | staff    |          | 2028-01-31T00:00:00Z | 2028-02-29T00:00:00Z | month  | 1     |
      | staff    |          | 2026-03-31T12:30:00Z | 2026-04-30T12:30:00Z | month  | 1     |
      | staff    |          | 2026-12-31T23:59:59Z | 2027-01-31T23:59:59Z | month  | 1     |
      | staff    |          | 2026-11-30T00:00:00Z | 2027-02-28T00:00:00Z | month  | 3     |
      | staff    |          | 2028-02-29T00:00:00Z | 2029-02-28T00:00:00Z | year   | 1     |

  Scenario: An invoice that is not stored is not found
    When I run "read_invoice" with:
      | invoice_id | caller.caller_kind |
      | in_missing | staff              |
    Then the output is "invoice_not_found":
      | invoice_id |
      | in_missing |

  Scenario: A customer may not read an invoice of another customer's subscription
    When I run "read_invoice" with:
      | invoice_id | caller.caller_kind | caller.customer_id | stored_invoice.invoice_id | stored_invoice.subscription_id | stored_invoice.invoice_status | stored_invoice.period_start | stored_invoice.period_end | stored_invoice.billing_period | stored_invoice.interval_count | stored_invoice.lines | stored_invoice.total | stored_subscription |
      | in_1       | customer           | cus_2              | in_1 | sub_aaaaaaaaaaaaaaaaaaaaaaaa | paid | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z | month | 1 | [{"line_quantity": 2, "amount": {"amount_minor": 3000, "currency": "EUR"}}] | {"amount_minor": 3000, "currency": "EUR"} | {"subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "active", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"} |
    Then the output is "forbidden":
      | caller                                              |
      | {"caller_kind": "customer", "customer_id": "cus_2"} |

  Scenario Outline: A request that does not match what was loaded is rejected
    When I run "read_invoice" with:
      | invoice_id   | caller.caller_kind | stored_invoice.invoice_id | stored_invoice.subscription_id | stored_invoice.invoice_status | stored_invoice.period_start | stored_invoice.period_end | stored_invoice.billing_period | stored_invoice.interval_count | stored_invoice.lines | stored_invoice.total | stored_subscription |
      | <invoice_id> | staff              | in_1 | <subscription_id> | paid | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z | month | 1 | [{"line_quantity": 2, "amount": {"amount_minor": 3000, "currency": "EUR"}}] | {"amount_minor": 3000, "currency": "EUR"} | <subscription> |
    Then the input is rejected by "<rule>" of "invoice_lookup"

    Examples:
      | rule                        | invoice_id | subscription_id              | subscription |
      | names_the_invoice           | in_2       | sub_aaaaaaaaaaaaaaaaaaaaaaaa | {"subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "active", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"} |
      | subscription_is_the_invoices | in_1      | sub_bbbbbbbbbbbbbbbbbbbbbbbb | {"subscription_id": "sub_aaaaaaaaaaaaaaaaaaaaaaaa", "customer_id": "cus_1", "plan": {"plan_id": "plan_basic", "billing_period": "month", "interval_count": 1, "price": {"amount_minor": 1500, "currency": "EUR"}}, "plan_id": "plan_basic", "quantity": 1, "subscription_status": "active", "current_period_start": "2026-11-01T00:00:00Z", "current_period_end": "2026-12-01T00:00:00Z"} |
      | subscription_is_the_invoices | in_1      | sub_aaaaaaaaaaaaaaaaaaaaaaaa |              |

  Scenario Outline: A request that breaks a rule is rejected
    When I run "read_invoice" with:
      | invoice_id   | caller.caller_kind |
      | <invoice_id> | <kind>             |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule      | definition     | invoice_id | kind  |
      | minLength | invoice_id     | ""         | staff |
      | required  | invoice_lookup | in_1       |       |
