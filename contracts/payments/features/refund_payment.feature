@urn-forge:strict
@urn:corpus:payments:refund:operation:refund_payment
Feature: Refund a payment

  Scenario Outline: A part of a captured payment is refunded, and the payment becomes partially refunded
    When I run the operation with:
      | merchant_id | payment_id   | amount   | idempotency_key   |
      | mer_1       | <payment_id> | <amount> | <idempotency_key> |
    Then the output is:
      | refund_id                   | payment_id   | amount   | currency | captured_amount | refunded_total   | created_at           |
      | re_000000000000000000000002 | <payment_id> | <amount> | EUR      | 5000            | <refunded_total> | 2026-11-22T10:00:00Z |
    And the operation emits "urn:corpus:payments:payment:event:partially_refunded":
      | payment_id   | merchant_id | amount | currency | previous_status   | new_status         |
      | <payment_id> | mer_1       | 5000   | EUR      | <previous_status> | partially_refunded |

    Examples:
      | payment_id                   | amount | idempotency_key  | refunded_total | previous_status    |
      | pay_captured0000000000000000 | 1      | k                | 1              | captured           |
      | pay_partiallyrefunded0000000 | 1000   | =repeat(64, "k") | 3000           | partially_refunded |

  Scenario Outline: A refund of all that is left makes the payment refunded
    When I run the operation with:
      | merchant_id | payment_id   | amount   | idempotency_key |
      | mer_1       | <payment_id> | <amount> | refund-1        |
    Then the output is:
      | amount   | captured_amount | refunded_total |
      | <amount> | 5000            | 5000           |
    And the operation emits "urn:corpus:payments:payment:event:refunded":
      | payment_id   | previous_status   | new_status |
      | <payment_id> | <previous_status> | refunded   |

    Examples:
      | payment_id                   | amount | previous_status    |
      | pay_captured0000000000000000 | 5000   | captured           |
      | pay_partiallyrefunded0000000 | 3000   | partially_refunded |

  Scenario Outline: A refund that would take more than is left of the captured amount is refused
    When I run the operation with:
      | merchant_id | payment_id   | amount   | idempotency_key |
      | mer_1       | <payment_id> | <amount> | refund-2        |
    Then the operation fails with "urn:corpus:payments:refund:error:amount_exceeds_captured":
      | amount   | available   |
      | <amount> | <available> |
    And the operation emits no event

    Examples:
      | payment_id                   | amount   | available |
      | pay_captured0000000000000000 | 5001     | 5000      |
      | pay_partiallyrefunded0000000 | 3001     | 3000      |
      | pay_captured0000000000000000 | 99999999 | 5000      |

  Scenario Outline: A request with a value out of its limits is rejected on that value
    When I run the operation with:
      | merchant_id | payment_id   | amount   | idempotency_key   |
      | mer_1       | <payment_id> | <amount> | <idempotency_key> |
    Then the input is rejected on "<field>"

    Examples:
      | field           | payment_id                   | amount    | idempotency_key  |
      | amount          | pay_captured0000000000000000 | 0         | refund-3         |
      | amount          | pay_captured0000000000000000 | 100000000 | refund-3         |
      | payment_id      | pay_captured                 | 1         | refund-3         |
      | idempotency_key | pay_captured0000000000000000 | 1         | ""               |
      | idempotency_key | pay_captured0000000000000000 | 1         | =repeat(65, "k") |
      | idempotency_key | pay_captured0000000000000000 | 1         | ="a\u0007b"      |

  Scenario Outline: A payment that is not captured cannot be refunded
    When I run the operation with:
      | merchant_id | payment_id   | amount | idempotency_key |
      | mer_1       | <payment_id> | 100    | refund-4        |
    Then the operation fails with "urn:corpus:payments:payment:error:invalid_state":
      | status   |
      | <status> |

    Examples:
      | payment_id                   | status     |
      | pay_authorized00000000000000 | authorized |
      | pay_voided000000000000000000 | voided     |

  Scenario: A payment captured more than 180 days ago can no longer be refunded
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key |
      | mer_1       | pay_capturedlongago000000000 | 100    | refund-5        |
    Then the operation fails with "urn:corpus:payments:refund:error:refund_window_closed"

  Scenario: An idempotency key that an earlier, different request used is refused
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key |
      | mer_1       | pay_captured0000000000000000 | 100    | used-key        |
    Then the operation fails with "urn:corpus:payments:payment:error:idempotency_conflict":
      | idempotency_key |
      | used-key        |

  Scenario: A payment of another merchant is not found
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key |
      | mer_2       | pay_captured0000000000000000 | 100    | refund-6        |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"
