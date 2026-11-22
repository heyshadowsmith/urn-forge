@urn-forge:strict
@urn:corpus:payments:payment:operation:expire_payment
Feature: Expire a card payment that was not captured within 7 days

  Scenario Outline: The clock expires an authorized card payment from 7 days after its authorization
    Given the time is "<now>"
    And the caller is:
      | key_kind |
      | clock    |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status     | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | card   | authorized | 0               | 0               | 2026-11-01T12:00:00Z |
    When I run the operation with:
      | payment_id                   |
      | pay_authorized00000000000000 |
    Then the output is:
      | payment_id                   | merchant_id | amount | currency | method | status  | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | card   | expired | 0               | 0               | 2026-11-01T12:00:00Z |
    And the operation emits "urn:corpus:payments:payment:event:expired":
      | event_id                             | payment_id                   | merchant_id | amount | currency | previous_status | new_status | occurred_at |
      | 00000000-0000-4000-8000-000000000001 | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | authorized      | expired    | <now>       |

    Examples:
      | now                      |
      | 2026-11-08T12:00:00Z     |
      | 2026-11-08T12:00:00.001Z |
      | 2027-01-01T00:00:00Z     |

  Scenario Outline: A card payment is not due to expire before 7 days, and a bank transfer payment never is
    Given the time is "<now>"
    And the caller is:
      | key_kind |
      | clock    |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method   | status     | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | <method> | authorized | 0               | 0               | 2026-11-01T12:00:00Z |
    When I run the operation with:
      | payment_id                   |
      | pay_authorized00000000000000 |
    Then the operation is not due

    Examples:
      | method        | now                      |
      | card          | 2026-11-08T11:59:59.999Z |
      | card          | 2026-11-01T12:00:00Z     |
      | bank_transfer | 2026-11-08T12:00:00Z     |
      | bank_transfer | 2027-01-01T00:00:00Z     |

  Scenario Outline: A payment that moved first, or is not authorized, is not expired
    Given the time is "2026-12-01T00:00:00Z"
    And the caller is:
      | key_kind |
      | clock    |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method   | status   | captured_amount   | refunded_amount   | created_at           | captured_at   |
      | pay_payment00000000000000000 | mer_1       | 5000   | EUR      | <method> | <status> | <captured_amount> | <refunded_amount> | 2026-11-01T12:00:00Z | <captured_at> |
    When I run the operation with:
      | payment_id                   |
      | pay_payment00000000000000000 |
    Then the operation fails with "urn:corpus:payments:payment:error:invalid_state":
      | status   |
      | <status> |
    And the operation emits no event

    Examples:
      | method        | status             | captured_amount | refunded_amount | captured_at          |
      | bank_transfer | pending            | 0               | 0               |                      |
      | card          | failed             | 0               | 0               |                      |
      | card          | captured           | 5000            | 0               | 2026-11-02T09:00:00Z |
      | card          | partially_refunded | 5000            | 2000            | 2026-11-02T09:00:00Z |
      | card          | refunded           | 5000            | 5000            | 2026-11-02T09:00:00Z |
      | card          | voided             | 0               | 0               |                      |
      | card          | expired            | 0               | 0               |                      |

  Scenario Outline: Only the clock may expire a payment: a merchant's key is refused as not found
    Given the time is "2026-12-01T00:00:00Z"
    And the caller is:
      | key_kind   | merchant_id |
      | <key_kind> | mer_1       |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status     | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | card   | authorized | 0               | 0               | 2026-11-01T12:00:00Z |
    When I run the operation with:
      | payment_id                   |
      | pay_authorized00000000000000 |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"
    And the operation emits no event

    Examples:
      | key_kind  |
      | secret    |
      | read_only |

  Scenario: A payment that no longer exists is not found
    Given the time is "2026-12-01T00:00:00Z"
    And the caller is:
      | key_kind |
      | clock    |
    And there is no current payment
    When I run the operation with:
      | payment_id                   |
      | pay_unknown00000000000000000 |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"
    And the operation emits no event

  Scenario: A request with a payment id that does not have its form is rejected
    Given the time is "2026-12-01T00:00:00Z"
    And the caller is:
      | key_kind |
      | clock    |
    And the current payment is:
      | payment_id                   | merchant_id | amount | currency | method | status     | captured_amount | refunded_amount | created_at           |
      | pay_authorized00000000000000 | mer_1       | 5000   | EUR      | card   | authorized | 0               | 0               | 2026-11-01T12:00:00Z |
    When I run the operation with:
      | payment_id                   |
      | pay_AUTHORIZED00000000000000 |
    Then the input is rejected on "payment_id"
