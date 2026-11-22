@urn-forge:strict
@urn:corpus:payments:refund:operation:get_refund
Feature: Read a refund

  Scenario Outline: A merchant reads its refund with a secret or a read-only key
    Given the caller is:
      | key_kind   | merchant_id |
      | <key_kind> | mer_1       |
    And the current refund is:
      | refund_id                   | payment_id                   | merchant_id | amount | currency | captured_amount | refunded_total | created_at           |
      | re_000000000000000000000001 | pay_partiallyrefunded0000000 | mer_1       | 2000   | EUR      | 5000            | 2000           | 2026-11-22T10:00:00Z |
    When I run the operation with:
      | merchant_id | refund_id                   |
      | mer_1       | re_000000000000000000000001 |
    Then the output is:
      | refund_id                   | payment_id                   | merchant_id | amount | currency | captured_amount | refunded_total | created_at           |
      | re_000000000000000000000001 | pay_partiallyrefunded0000000 | mer_1       | 2000   | EUR      | 5000            | 2000           | 2026-11-22T10:00:00Z |

    Examples:
      | key_kind  |
      | secret    |
      | read_only |

  Scenario: A refund id that does not have its form is rejected
    Given the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And there is no current refund
    When I run the operation with:
      | merchant_id | refund_id                    |
      | mer_1       | re_0000000000000000000000001 |
    Then the input is rejected on "refund_id"

  Scenario: An unknown refund is not found
    Given the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    And there is no current refund
    When I run the operation with:
      | merchant_id | refund_id                   |
      | mer_1       | re_000000000000000000000009 |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"

  Scenario Outline: A key of another merchant is refused as not found
    Given the caller is:
      | key_kind   | merchant_id   |
      | <key_kind> | <merchant_id> |
    And the current refund is:
      | refund_id                   | payment_id                   | merchant_id | amount | currency | captured_amount | refunded_total | created_at           |
      | re_000000000000000000000001 | pay_partiallyrefunded0000000 | mer_1       | 2000   | EUR      | 5000            | 2000           | 2026-11-22T10:00:00Z |
    When I run the operation with:
      | merchant_id | refund_id                   |
      | mer_1       | re_000000000000000000000001 |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"

    Examples:
      | key_kind  | merchant_id |
      | secret    | mer_2       |
      | read_only | mer_2       |

  Scenario: A refund of another merchant is not found
    Given the caller is:
      | key_kind   | merchant_id   |
      | secret     | mer_2         |
    And the current refund is:
      | refund_id                   | payment_id                   | merchant_id | amount | currency | captured_amount | refunded_total | created_at           |
      | re_000000000000000000000001 | pay_partiallyrefunded0000000 | mer_1       | 2000   | EUR      | 5000            | 2000           | 2026-11-22T10:00:00Z |
    When I run the operation with:
      | merchant_id | refund_id                   |
      | mer_2       | re_000000000000000000000001 |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"

  Scenario: A request that names a merchant other than the one of the key is not found
    Given the caller is:
      | key_kind   | merchant_id   |
      | secret     | mer_1         |
    And the current refund is:
      | refund_id                   | payment_id                   | merchant_id | amount | currency | captured_amount | refunded_total | created_at           |
      | re_000000000000000000000001 | pay_partiallyrefunded0000000 | mer_1       | 2000   | EUR      | 5000            | 2000           | 2026-11-22T10:00:00Z |
    When I run the operation with:
      | merchant_id | refund_id                   |
      | mer_2       | re_000000000000000000000001 |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"
