@urn-forge:strict
@urn:corpus:payments:refund:operation:get_refund
Feature: Read a refund

  Scenario: A merchant reads its refund
    When I run the operation with:
      | merchant_id | refund_id                   |
      | mer_1       | re_000000000000000000000001 |
    Then the output is:
      | refund_id                   | payment_id                   | merchant_id | amount | currency | captured_amount | refunded_total | created_at           |
      | re_000000000000000000000001 | pay_partiallyrefunded0000000 | mer_1       | 2000   | EUR      | 5000            | 2000           | 2026-11-22T10:00:00Z |

  Scenario: A refund id that does not have its form is rejected
    When I run the operation with:
      | merchant_id | refund_id                    |
      | mer_1       | re_0000000000000000000000001 |
    Then the input is rejected on "refund_id"

  Scenario Outline: An unknown refund, or a refund of another merchant, is not found
    When I run the operation with:
      | merchant_id   | refund_id   |
      | <merchant_id> | <refund_id> |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"

    Examples:
      | merchant_id | refund_id                   |
      | mer_1       | re_000000000000000000000009 |
      | mer_2       | re_000000000000000000000001 |
