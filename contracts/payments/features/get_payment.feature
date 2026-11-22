@urn-forge:strict
@urn:corpus:payments:payment:operation:get_payment
Feature: Read a payment

  Scenario Outline: A merchant reads its payment with a secret or a read-only key, and the answer shows only a summary of the card
    Given the caller is:
      | key_kind   | merchant_id |
      | <key_kind> | mer_1       |
    And the current payment is:
      | payment_id   | merchant_id | amount | currency | method | status   | captured_amount   | refunded_amount   | card                                                        | created_at           | captured_at   |
      | <payment_id> | mer_1       | 5000   | EUR      | card   | <status> | <captured_amount> | <refunded_amount> | { brand: visa, last4: 4242, exp_month: 12, exp_year: 2030 } | 2026-11-22T10:00:00Z | <captured_at> |
    When I run the operation with:
      | merchant_id | payment_id   |
      | mer_1       | <payment_id> |
    Then the output is:
      | payment_id   | merchant_id | amount | currency | status   | captured_amount   | refunded_amount   | card                                                        | created_at           |
      | <payment_id> | mer_1       | 5000   | EUR      | <status> | <captured_amount> | <refunded_amount> | { brand: visa, last4: 4242, exp_month: 12, exp_year: 2030 } | 2026-11-22T10:00:00Z |
    And the operation emits no event

    Examples:
      | key_kind  | payment_id                   | status             | captured_amount | refunded_amount | captured_at          |
      | secret    | pay_authorized00000000000000 | authorized         | 0               | 0               |                      |
      | read_only | pay_partiallyrefunded0000000 | partially_refunded | 5000            | 2000            | 2026-11-01T09:00:00Z |

  Scenario: A payment id that does not have its form is rejected
    Given the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And there is no current payment
    When I run the operation with:
      | merchant_id | payment_id                    |
      | mer_1       | pay_authorized000000000000000 |
    Then the input is rejected on "payment_id"

  Scenario: An unknown payment is not found
    Given the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And there is no current payment
    When I run the operation with:
      | merchant_id | payment_id                   |
      | mer_1       | pay_unknown00000000000000000 |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"

  Scenario Outline: A key of another merchant is refused as not found
    Given the caller is:
      | key_kind   | merchant_id   |
      | <key_kind> | <merchant_id> |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status     | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | card   | authorized | 0               | 0               | 2026-11-22T10:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   |
      | mer_1       | pay_authorized00000000000000 |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"

    Examples:
      | key_kind  | merchant_id |
      | secret    | mer_2       |
      | read_only | mer_2       |

  Scenario: A payment of another merchant is not found
    Given the caller is:
      | key_kind   | merchant_id   |
      | secret     | mer_2         |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status     | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | card   | authorized | 0               | 0               | 2026-11-22T10:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   |
      | mer_2       | pay_authorized00000000000000 |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"

  Scenario: A request that names a merchant other than the one of the key is not found
    Given the caller is:
      | key_kind   | merchant_id   |
      | secret     | mer_1         |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status     | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | card   | authorized | 0               | 0               | 2026-11-22T10:00:00Z |
    When I run the operation with:
      | merchant_id | payment_id                   |
      | mer_2       | pay_authorized00000000000000 |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"
