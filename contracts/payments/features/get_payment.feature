@urn-forge:strict
@urn:corpus:payments:payment:operation:get_payment
Feature: Read a payment

  Scenario Outline: A merchant reads its payment, which shows only a summary of the card
    When I run the operation with:
      | merchant_id | payment_id   |
      | mer_1       | <payment_id> |
    Then the output is:
      | payment_id   | merchant_id | amount | currency | status   | captured_amount   | refunded_amount   | card                                                        | created_at           |
      | <payment_id> | mer_1       | 5000   | EUR      | <status> | <captured_amount> | <refunded_amount> | { brand: visa, last4: 4242, exp_month: 12, exp_year: 2030 } | 2026-11-22T10:00:00Z |
    And the operation emits no event

    Examples:
      | payment_id                   | status             | captured_amount | refunded_amount |
      | pay_authorized00000000000000 | authorized         | 0               | 0               |
      | pay_partiallyrefunded0000000 | partially_refunded | 5000            | 2000            |

  Scenario: A payment id that does not have its form is rejected
    When I run the operation with:
      | merchant_id | payment_id                    |
      | mer_1       | pay_authorized000000000000000 |
    Then the input is rejected on "payment_id"

  Scenario Outline: An unknown payment, or a payment of another merchant, is not found
    When I run the operation with:
      | merchant_id   | payment_id   |
      | <merchant_id> | <payment_id> |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"

    Examples:
      | merchant_id | payment_id                   |
      | mer_1       | pay_unknown00000000000000000 |
      | mer_2       | pay_authorized00000000000000 |
