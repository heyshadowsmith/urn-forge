@urn-forge:strict
@urn:corpus:subscriptions:invoice:operation:read_invoice
Feature: Read an invoice

  Scenario: An invoice is read with its lines and its total
    When I run the operation with:
      | invoice_id |
      | i          |
    Then the output is:
      | invoice_id | status | period_start         | period_end           | lines                                                     | total                                 |
      | i          | paid   | 2026-11-01T00:00:00Z | 2026-12-01T00:00:00Z | [{ quantity: 2, amount: { amount_minor: 3000, currency: EUR } }] | { amount_minor: 3000, currency: EUR } |

  Scenario: An empty invoice id is rejected
    When I run the operation with:
      | invoice_id |
      | ""         |
    Then the input is rejected on "invoice_id"

  Scenario: An unknown invoice is not found
    When I run the operation with:
      | invoice_id |
      | in_missing |
    Then the operation fails with "urn:corpus:subscriptions:invoice:error:not_found":
      | invoice_id |
      | in_missing |

  Scenario Outline: An invoice's period ends its number of calendar months after it starts, on the last day of a month that lacks the start's day
    When I run the operation with:
      | invoice_id   |
      | <invoice_id> |
    Then the output is:
      | period_start   | period_end   | billing_period   | interval_count   |
      | <period_start> | <period_end> | <billing_period> | <interval_count> |

    Examples:
      | invoice_id              | period_start         | period_end           | billing_period | interval_count |
      | in_2026-01-31           | 2026-01-31T00:00:00Z | 2026-02-28T00:00:00Z | month          | 1              |
      | in_2028-01-31           | 2028-01-31T00:00:00Z | 2028-02-29T00:00:00Z | month          | 1              |
      | in_2026-03-31           | 2026-03-31T12:30:00Z | 2026-04-30T12:30:00Z | month          | 1              |
      | in_2026-12-31           | 2026-12-31T23:59:59Z | 2027-01-31T23:59:59Z | month          | 1              |
      | in_quarterly-2026-11-30 | 2026-11-30T00:00:00Z | 2027-02-28T00:00:00Z | month          | 3              |
      | in_yearly-2028-02-29    | 2028-02-29T00:00:00Z | 2029-02-28T00:00:00Z | year           | 1              |
