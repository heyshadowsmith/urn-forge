@urn-forge:strict
@urn:corpus:payments:payment:operation:void_payment
Feature: Void a payment

  Scenario: An authorized payment that was not captured is voided
    When I run the operation with:
      | merchant_id | payment_id                   |
      | mer_1       | pay_authorized00000000000000 |
    Then the output is:
      | payment_id                   | status | captured_amount |
      | pay_authorized00000000000000 | voided | 0               |
    And the operation emits "urn:corpus:payments:payment:event:voided":
      | payment_id                   | merchant_id | previous_status | new_status |
      | pay_authorized00000000000000 | mer_1       | authorized      | voided     |

  Scenario Outline: A payment that is not authorized cannot be voided
    When I run the operation with:
      | merchant_id | payment_id   |
      | mer_1       | <payment_id> |
    Then the operation fails with "urn:corpus:payments:payment:error:invalid_state":
      | status   |
      | <status> |
    And the operation emits no event

    Examples:
      | payment_id                   | status             |
      | pay_captured0000000000000000 | captured           |
      | pay_partiallyrefunded0000000 | partially_refunded |
      | pay_voided000000000000000000 | voided             |

  Scenario: A payment id that does not have its form is rejected
    When I run the operation with:
      | merchant_id | payment_id     |
      | mer_1       | py_authorized1 |
    Then the input is rejected on "payment_id"

  Scenario: A payment of another merchant is not found
    When I run the operation with:
      | merchant_id | payment_id                   |
      | mer_2       | pay_authorized00000000000000 |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"
