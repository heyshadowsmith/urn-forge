@urn-forge:strict
@urn:corpus:payments:payment:operation:capture_payment
Feature: Capture a payment

  Scenario Outline: An authorized payment is captured in full when the request has no amount, else for the amount
    Given the time is "2026-11-22T18:30:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status     | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | card   | authorized | 0               | 0               | 2026-11-22T10:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   | amount   |
      | mer_1       | pay_authorized00000000000000 | <amount> |
    Then the output is:
      | payment_id                   | currency | authorized_amount | captured_amount   | status   | captured_at          |
      | pay_authorized00000000000000 | EUR      | 5000              | <captured_amount> | captured | 2026-11-22T18:30:00Z |
    And the operation emits "urn:corpus:payments:payment:event:captured":
      | event_id                             | payment_id                   | merchant_id | amount | currency | previous_status | new_status | occurred_at          |
      | 00000000-0000-4000-8000-000000000001 | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | authorized      | captured   | 2026-11-22T18:30:00Z |

    Examples:
      | amount | captured_amount |
      |        | 5000            |
      | 1      | 1               |
      | 5000   | 5000            |

  Scenario Outline: An authorized card payment is captured until 7 days after its authorization, and a bank transfer payment later too
    Given the time is "<now>"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method   | status     | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | <method> | authorized | 0               | 0               | 2026-11-01T12:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   |
      | mer_1       | pay_authorized00000000000000 |
    Then the output is:
      | payment_id                   | currency | authorized_amount | captured_amount | status   | captured_at |
      | pay_authorized00000000000000 | EUR      | 5000              | 5000            | captured | <now>       |
    And the operation emits "urn:corpus:payments:payment:event:captured"

    Examples:
      | method        | now                      |
      | card          | 2026-11-08T11:59:59.999Z |
      | bank_transfer | 2026-11-08T12:00:00Z     |
      | bank_transfer | 2027-01-01T00:00:00Z     |

  Scenario Outline: An authorized card payment can no longer be captured from 7 days after its authorization, even before it expires
    Given the time is "<now>"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status     | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | card   | authorized | 0               | 0               | 2026-11-01T12:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   |
      | mer_1       | pay_authorized00000000000000 |
    Then the operation fails with "urn:corpus:payments:payment:error:invalid_state":
      | status     |
      | authorized |
    And the operation emits no event

    Examples:
      | now                  |
      | 2026-11-08T12:00:00Z |
      | 2027-01-01T00:00:00Z |

  Scenario Outline: A capture of more than the authorized amount is refused
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status     | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | card   | authorized | 0               | 0               | 2026-11-22T10:00:00Z |
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
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status     | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | card   | authorized | 0               | 0               | 2026-11-22T10:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id   | amount   |
      | mer_1       | <payment_id> | <amount> |
    Then the input is rejected on "<field>"

    Examples:
      | field      | payment_id                   | amount    |
      | amount     | pay_authorized00000000000000 | 0         |
      | amount     | pay_authorized00000000000000 | 100000000 |
      | payment_id | pay_AUTHORIZED00000000000000 |           |

  Scenario Outline: A payment that is not authorized cannot be captured
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status   | captured_amount   | refunded_amount   | created_at           | captured_at   |
      | pay_payment00000000000000000 | mer_1       | 5000   | EUR      | card   | <status> | <captured_amount> | <refunded_amount> | 2026-11-22T10:00:00Z | <captured_at> |
    When I run the operation with:
      | merchant_id | payment_id                   |
      | mer_1       | pay_payment00000000000000000 |
    Then the operation fails with "urn:corpus:payments:payment:error:invalid_state":
      | status   |
      | <status> |
    And the operation emits no event

    Examples:
      | status             | captured_amount | refunded_amount | captured_at          |
      | pending            | 0               | 0               |                      |
      | captured           | 5000            | 0               | 2026-11-01T09:00:00Z |
      | partially_refunded | 5000            | 2000            | 2026-11-01T09:00:00Z |
      | voided             | 0               | 0               |                      |
      | expired            | 0               | 0               |                      |
      | refunded           | 5000            | 5000            | 2026-11-01T09:00:00Z |

  Scenario Outline: A key of another merchant, a read-only key, or the clock is refused as not found
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind   | merchant_id   |
      | <key_kind> | <merchant_id> |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status     | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | card   | authorized | 0               | 0               | 2026-11-22T10:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   |
      | mer_1       | pay_authorized00000000000000 |
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
      | payment_id                   | merchant_id | amount | currency | method | status     | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | card   | authorized | 0               | 0               | 2026-11-22T10:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   |
      | mer_2       | pay_authorized00000000000000 |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"
    And the operation emits no event

  Scenario: A request that names a merchant other than the one of the key is not found
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind   | merchant_id   |
      | secret     | mer_1         |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status     | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | card   | authorized | 0               | 0               | 2026-11-22T10:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   |
      | mer_2       | pay_authorized00000000000000 |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"
    And the operation emits no event

  Scenario: An unknown payment is not found
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And there is no current payment
    When I run the operation with:
      | merchant_id | payment_id                   |
      | mer_1       | pay_unknown00000000000000000 |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"
    And the operation emits no event
