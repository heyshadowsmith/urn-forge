@urn-forge:strict
@urn:corpus:payments:refund:operation:refund_payment
Feature: Refund a payment

  Scenario: A part of a captured payment is refunded, and the payment becomes partially refunded
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status   | captured_amount | refunded_amount | created_at           | captured_at          |
      | pay_captured0000000000000000 | mer_1       | 5000   | EUR      | card   | captured | 5000            | 0               | 2026-11-22T10:00:00Z | 2026-11-01T09:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key |
      | mer_1       | pay_captured0000000000000000 | 1      | k               |
    Then the output is:
      | refund_id                   | payment_id                   | amount | currency | captured_amount | refunded_total | created_at           |
      | re_000000000000000000000002 | pay_captured0000000000000000 | 1      | EUR      | 5000            | 1              | 2026-11-22T10:00:00Z |
    And the operation emits "urn:corpus:payments:payment:event:partially_refunded":
      | payment_id                   | merchant_id | amount | currency | previous_status | new_status         | occurred_at          |
      | pay_captured0000000000000000 | mer_1       | 5000   | EUR      | captured        | partially_refunded | 2026-11-22T10:00:00Z |
    And the operation emits no "urn:corpus:payments:payment:event:refunded"

  Scenario: A part of what is left of a partially refunded payment is refunded, and the payment stays partially refunded
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status             | captured_amount | refunded_amount | created_at           | captured_at          |
      | pay_partiallyrefunded0000000 | mer_1       | 5000   | EUR      | card   | partially_refunded | 5000            | 2000            | 2026-11-22T10:00:00Z | 2026-11-01T09:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key  |
      | mer_1       | pay_partiallyrefunded0000000 | 1000   | =repeat(64, "k") |
    Then the output is:
      | refund_id                   | payment_id                   | amount | currency | captured_amount | refunded_total | created_at           |
      | re_000000000000000000000002 | pay_partiallyrefunded0000000 | 1000   | EUR      | 5000            | 3000           | 2026-11-22T10:00:00Z |
    And the operation emits "urn:corpus:payments:payment:event:partially_refunded":
      | payment_id                   | merchant_id | amount | currency | previous_status    | new_status         | occurred_at          |
      | pay_partiallyrefunded0000000 | mer_1       | 5000   | EUR      | partially_refunded | partially_refunded | 2026-11-22T10:00:00Z |

  Scenario: A refund of all of a captured payment makes the payment refunded
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status   | captured_amount | refunded_amount | created_at           | captured_at          |
      | pay_captured0000000000000000 | mer_1       | 5000   | EUR      | card   | captured | 5000            | 0               | 2026-11-22T10:00:00Z | 2026-11-01T09:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key |
      | mer_1       | pay_captured0000000000000000 | 5000   | refund-1        |
    Then the output is:
      | amount | captured_amount | refunded_total |
      | 5000   | 5000            | 5000           |
    And the operation emits "urn:corpus:payments:payment:event:refunded":
      | payment_id                   | previous_status | new_status | occurred_at          |
      | pay_captured0000000000000000 | captured        | refunded   | 2026-11-22T10:00:00Z |
    And the operation emits no "urn:corpus:payments:payment:event:partially_refunded"

  Scenario: A refund of all that is left of a partially refunded payment makes the payment refunded
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status             | captured_amount | refunded_amount | created_at           | captured_at          |
      | pay_partiallyrefunded0000000 | mer_1       | 5000   | EUR      | card   | partially_refunded | 5000            | 2000            | 2026-11-22T10:00:00Z | 2026-11-01T09:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key |
      | mer_1       | pay_partiallyrefunded0000000 | 3000   | refund-1        |
    Then the output is:
      | amount | captured_amount | refunded_total |
      | 3000   | 5000            | 5000           |
    And the operation emits "urn:corpus:payments:payment:event:refunded":
      | payment_id                   | previous_status    | new_status | occurred_at          |
      | pay_partiallyrefunded0000000 | partially_refunded | refunded   | 2026-11-22T10:00:00Z |

  Scenario Outline: A refund that would take more than the captured amount is refused
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status   | captured_amount | refunded_amount | created_at           | captured_at          |
      | pay_captured0000000000000000 | mer_1       | 5000   | EUR      | card   | captured | 5000            | 0               | 2026-11-22T10:00:00Z | 2026-11-01T09:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   | amount   | idempotency_key |
      | mer_1       | pay_captured0000000000000000 | <amount> | refund-2        |
    Then the operation fails with "urn:corpus:payments:refund:error:amount_exceeds_captured":
      | amount   | captured_amount | refunded_amount |
      | <amount> | 5000            | 0               |
    And the operation emits no event

    Examples:
      | amount   |
      | 5001     |
      | 99999999 |

  Scenario: A refund that would take more than is left of a partially refunded payment is refused
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status             | captured_amount | refunded_amount | created_at           | captured_at          |
      | pay_partiallyrefunded0000000 | mer_1       | 5000   | EUR      | card   | partially_refunded | 5000            | 2000            | 2026-11-22T10:00:00Z | 2026-11-01T09:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key |
      | mer_1       | pay_partiallyrefunded0000000 | 3001   | refund-2        |
    Then the operation fails with "urn:corpus:payments:refund:error:amount_exceeds_captured":
      | amount | captured_amount | refunded_amount |
      | 3001   | 5000            | 2000            |
    And the operation emits no event

  Scenario Outline: A request with a value out of its limits is rejected on that value
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status   | captured_amount | refunded_amount | created_at           | captured_at          |
      | pay_captured0000000000000000 | mer_1       | 5000   | EUR      | card   | captured | 5000            | 0               | 2026-11-22T10:00:00Z | 2026-11-01T09:00:00Z |
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
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status   | captured_amount | refunded_amount | created_at           | captured_at   |
      | pay_payment00000000000000000 | mer_1       | 5000   | EUR      | card   | <status> | 0               | 0               | 2026-11-22T10:00:00Z | <captured_at> |
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key |
      | mer_1       | pay_payment00000000000000000 | 100    | refund-4        |
    Then the operation fails with "urn:corpus:payments:payment:error:invalid_state":
      | status   |
      | <status> |
    And the operation emits no event

    Examples:
      | status     | captured_at |
      | pending    |             |
      | authorized |             |
      | voided     |             |

  Scenario: A payment refunded in full cannot be refunded again
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status   | captured_amount | refunded_amount | created_at           | captured_at          |
      | pay_payment00000000000000000 | mer_1       | 5000   | EUR      | card   | refunded | 5000            | 5000            | 2026-11-22T10:00:00Z | 2026-11-01T09:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key |
      | mer_1       | pay_payment00000000000000000 | 100    | refund-4        |
    Then the operation fails with "urn:corpus:payments:payment:error:invalid_state":
      | status   |
      | refunded |
    And the operation emits no event

  Scenario: A refund exactly 180 days after the capture is allowed
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status   | captured_amount | refunded_amount | created_at           | captured_at          |
      | pay_captured0000000000000000 | mer_1       | 5000   | EUR      | card   | captured | 5000            | 0               | 2026-05-26T09:00:00Z | 2026-05-26T10:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key |
      | mer_1       | pay_captured0000000000000000 | 100    | refund-5        |
    Then the output is:
      | payment_id                   | amount | refunded_total | created_at           |
      | pay_captured0000000000000000 | 100    | 100            | 2026-11-22T10:00:00Z |
    And the operation emits "urn:corpus:payments:payment:event:partially_refunded":
      | payment_id                   | previous_status | new_status         | occurred_at          |
      | pay_captured0000000000000000 | captured        | partially_refunded | 2026-11-22T10:00:00Z |

  Scenario: A refund a millisecond before the end of the 180 days is allowed
    Given the time is "2026-11-22T09:59:59.999Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status   | captured_amount | refunded_amount | created_at           | captured_at          |
      | pay_captured0000000000000000 | mer_1       | 5000   | EUR      | card   | captured | 5000            | 0               | 2026-05-26T09:00:00Z | 2026-05-26T10:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key |
      | mer_1       | pay_captured0000000000000000 | 100    | refund-5        |
    Then the output is:
      | payment_id                   | amount | refunded_total | created_at               |
      | pay_captured0000000000000000 | 100    | 100            | 2026-11-22T09:59:59.999Z |
    And the operation emits "urn:corpus:payments:payment:event:partially_refunded":
      | payment_id                   | previous_status | new_status         | occurred_at              |
      | pay_captured0000000000000000 | captured        | partially_refunded | 2026-11-22T09:59:59.999Z |

  Scenario: A refund a millisecond after the 180 days is refused
    Given the time is "2026-11-22T10:00:00.001Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status   | captured_amount | refunded_amount | created_at           | captured_at          |
      | pay_captured0000000000000000 | mer_1       | 5000   | EUR      | card   | captured | 5000            | 0               | 2026-05-26T09:00:00Z | 2026-05-26T10:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key |
      | mer_1       | pay_captured0000000000000000 | 100    | refund-5        |
    Then the operation fails with "urn:corpus:payments:refund:error:refund_window_closed"
    And the operation emits no event

  Scenario: A refund a second after the 180 days is refused
    Given the time is "2026-11-22T10:00:01Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status   | captured_amount | refunded_amount | created_at           | captured_at          |
      | pay_captured0000000000000000 | mer_1       | 5000   | EUR      | card   | captured | 5000            | 0               | 2026-05-26T09:00:00Z | 2026-05-26T10:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key |
      | mer_1       | pay_captured0000000000000000 | 100    | refund-5        |
    Then the operation fails with "urn:corpus:payments:refund:error:refund_window_closed"
    And the operation emits no event

  Scenario: A partially refunded payment captured more than 180 days ago can no longer be refunded
    Given the time is "2026-11-23T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status             | captured_amount | refunded_amount | created_at           | captured_at          |
      | pay_captured0000000000000000 | mer_1       | 5000   | EUR      | card   | partially_refunded | 5000            | 2000            | 2026-05-26T09:00:00Z | 2026-05-26T10:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key |
      | mer_1       | pay_captured0000000000000000 | 100    | refund-5        |
    Then the operation fails with "urn:corpus:payments:refund:error:refund_window_closed"
    And the operation emits no event

  Scenario: An idempotency key that an earlier, different request used is refused
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status   | captured_amount | refunded_amount | created_at           | captured_at          |
      | pay_captured0000000000000000 | mer_1       | 5000   | EUR      | card   | captured | 5000            | 0               | 2026-11-22T10:00:00Z | 2026-11-01T09:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key |
      | mer_1       | pay_captured0000000000000000 | 100    | used-key        |
    Then the operation fails with "urn:corpus:payments:payment:error:idempotency_conflict":
      | idempotency_key |
      | used-key        |

  Scenario Outline: A key of another merchant, a read-only key, or the clock is refused as not found
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind   | merchant_id   |
      | <key_kind> | <merchant_id> |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status   | captured_amount | refunded_amount | created_at           | captured_at          |
      | pay_captured0000000000000000 | mer_1       | 5000   | EUR      | card   | captured | 5000            | 0               | 2026-11-22T10:00:00Z | 2026-11-01T09:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key |
      | mer_1       | pay_captured0000000000000000 | 100    | refund-6        |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"
    And the operation emits no event

    Examples:
      | key_kind  | merchant_id |
      | secret    | mer_2       |
      | read_only | mer_1       |
      | clock     |             |

  Scenario: A payment of another merchant is not found
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind   | merchant_id   |
      | secret     | mer_2         |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status   | captured_amount | refunded_amount | created_at           | captured_at          |
      | pay_captured0000000000000000 | mer_1       | 5000   | EUR      | card   | captured | 5000            | 0               | 2026-11-22T10:00:00Z | 2026-11-01T09:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key |
      | mer_2       | pay_captured0000000000000000 | 100    | refund-6        |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"
    And the operation emits no event

  Scenario: A request that names a merchant other than the one of the key is not found
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind   | merchant_id   |
      | secret     | mer_1         |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status   | captured_amount | refunded_amount | created_at           | captured_at          |
      | pay_captured0000000000000000 | mer_1       | 5000   | EUR      | card   | captured | 5000            | 0               | 2026-11-22T10:00:00Z | 2026-11-01T09:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key |
      | mer_2       | pay_captured0000000000000000 | 100    | refund-6        |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"
    And the operation emits no event

  Scenario: An unknown payment is not found
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And there is no current payment
    When I run the operation with:
      | merchant_id | payment_id                   | amount | idempotency_key |
      | mer_1       | pay_unknown00000000000000000 | 100    | refund-7        |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"
    And the operation emits no event
