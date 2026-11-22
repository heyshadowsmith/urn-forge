@urn-forge:strict
@urn:corpus:payments:payment:operation:void_payment
Feature: Void a payment

  Scenario: An authorized payment that was not captured is voided
    Given the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status     | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | card   | authorized | 0               | 0               | 2026-11-22T10:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   |
      | mer_1       | pay_authorized00000000000000 |
    Then the output is:
      | payment_id                   | merchant_id | amount | currency | method | status | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | card   | voided | 0               | 0               | 2026-11-22T10:00:00Z |
    And the operation emits "urn:corpus:payments:payment:event:voided":
      | payment_id                   | merchant_id | amount | currency | previous_status | new_status |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | authorized      | voided     |

  Scenario Outline: A payment that is not authorized cannot be voided
    Given the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status   | captured_amount   | refunded_amount   | created_at           |
      | pay_payment00000000000000000 | mer_1       | 5000   | EUR      | card   | <status> | <captured_amount> | <refunded_amount> | 2026-11-22T10:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   |
      | mer_1       | pay_payment00000000000000000 |
    Then the operation fails with "urn:corpus:payments:payment:error:invalid_state":
      | status   |
      | <status> |
    And the operation emits no event

    Examples:
      | status             | captured_amount | refunded_amount |
      | pending            | 0               | 0               |
      | captured           | 5000            | 0               |
      | partially_refunded | 5000            | 2000            |
      | voided             | 0               | 0               |
      | expired            | 0               | 0               |

  Scenario: A payment id that does not have its form is rejected
    Given the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status     | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | card   | authorized | 0               | 0               | 2026-11-22T10:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id     |
      | mer_1       | py_authorized1 |
    Then the input is rejected on "payment_id"

  Scenario: A payment of another merchant is not found
    Given the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status     | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | card   | authorized | 0               | 0               | 2026-11-22T10:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   |
      | mer_2       | pay_authorized00000000000000 |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"

  Scenario: An unknown payment is not found
    Given there is no current payment
    When I run the operation with:
      | merchant_id | payment_id                   |
      | mer_1       | pay_unknown00000000000000000 |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"
    And the operation emits no event
