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
