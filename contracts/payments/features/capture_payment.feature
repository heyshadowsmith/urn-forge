@urn-forge:strict
@urn:corpus:payments:payment:operation:capture_payment
Feature: Capture a payment

  Scenario Outline: An authorized payment is captured in full when the request has no amount, else for the amount
    When I run the operation with:
      | merchant_id | payment_id                   | amount   |
      | mer_1       | pay_authorized00000000000000 | <amount> |
    Then the output is:
      | payment_id                   | currency | authorized_amount | captured_amount   | status   |
      | pay_authorized00000000000000 | EUR      | 5000              | <captured_amount> | captured |
    And the operation emits "urn:corpus:payments:payment:event:captured":
      | payment_id                   | merchant_id | amount | currency | previous_status | new_status |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | authorized      | captured   |

    Examples:
      | amount | captured_amount |
      |        | 5000            |
      | 1      | 1               |
      | 5000   | 5000            |

  Scenario Outline: A capture of more than the authorized amount is refused
    When I run the operation with:
      | merchant_id | payment_id                   | amount   |
      | mer_1       | pay_authorized00000000000000 | <amount> |
    Then the operation fails with "urn:corpus:payments:payment:error:capture_exceeds_authorized":
      | amount   | authorized_amount |
      | <amount> | 5000              |
    And the operation emits no event

    Examples:
      | amount   |
      | 5001     |
      | 99999999 |

  Scenario Outline: A request with a value out of its limits is rejected on that value
    When I run the operation with:
      | merchant_id | payment_id   | amount   |
      | mer_1       | <payment_id> | <amount> |
    Then the input is rejected on "<field>"

    Examples:
      | field      | payment_id                   | amount    |
      | amount     | pay_authorized00000000000000 | 0         |
      | amount     | pay_authorized00000000000000 | 100000000 |
      | payment_id | pay_AUTHORIZED00000000000000 |           |

  Scenario: A payment that is not authorized cannot be captured
    When I run the operation with:
      | merchant_id | payment_id                   |
      | mer_1       | pay_captured0000000000000000 |
    Then the operation fails with "urn:corpus:payments:payment:error:invalid_state":
      | status   |
      | captured |

  Scenario Outline: An unknown payment, or a payment of another merchant, is not found
    When I run the operation with:
      | merchant_id   | payment_id   |
      | <merchant_id> | <payment_id> |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"

    Examples:
      | merchant_id | payment_id                   |
      | mer_1       | pay_unknown00000000000000000 |
      | mer_2       | pay_authorized00000000000000 |
