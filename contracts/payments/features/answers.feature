Feature: The answers and the stored records

  Scenario Outline: A payment that breaks a rule is rejected
    When I check a "payment" with:
      | payment_id   | merchant_id | amount | currency | method   | status   | captured_amount | refunded_amount | card_summary   | created_at           |
      | <payment_id> | <merchant>  | 5000   | EUR      | <method> | <status> | 0               | 0               | <card_summary> | 2026-11-20T10:00:00Z |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                           | definition   | payment_id                  | merchant | method | status     | card_summary                                                              |
      | required                       | payment      | pay_aaaaaaaaaaaaaaaaaaaaaaaa |          | card   | authorized |                                                                           |
      | pattern                        | payment_id   | PAY_1                       | m_1      | card   | authorized |                                                                           |
      | pending_only_for_bank_transfer | payment      | pay_aaaaaaaaaaaaaaaaaaaaaaaa | m_1      | card   | pending    |                                                                           |
      | required                       | card_summary | pay_aaaaaaaaaaaaaaaaaaaaaaaa | m_1      | card   | authorized | {"brand": "visa", "last4": "4242", "exp_month": 12}                       |
      | enum                           | brand        | pay_aaaaaaaaaaaaaaaaaaaaaaaa | m_1      | card   | authorized | {"brand": "diners", "last4": "4242", "exp_month": 12, "exp_year": 2030}   |
      | pattern                        | last4        | pay_aaaaaaaaaaaaaaaaaaaaaaaa | m_1      | card   | authorized | {"brand": "visa", "last4": "42424", "exp_month": 12, "exp_year": 2030}    |

  Scenario Outline: An event that breaks a rule is rejected
    When I check a "payment_event" with:
      | event_id                             | event_type   | payment_id                  | merchant_id | amount | currency | new_status | occurred_at          |
      | 00000000-0000-4000-8000-000000000001 | <event_type> | pay_aaaaaaaaaaaaaaaaaaaaaaaa | <merchant>  | 5000   | EUR      | captured   | 2026-11-20T10:00:00Z |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                        | definition    | event_type       | merchant |
      | required                    | payment_event | payment.captured |          |
      | event_type_names_the_status | payment_event | payment.voided   | m_1      |
      | enum                        | event_type    | payment.settled  | m_1      |

  Scenario: A change with no event is rejected
    When I check a "payment_changed" with:
      | payment                                                                                                                                                                                                                      |
      | {"payment_id": "pay_aaaaaaaaaaaaaaaaaaaaaaaa", "merchant_id": "m_1", "amount": 5000, "currency": "EUR", "method": "card", "status": "voided", "captured_amount": 0, "refunded_amount": 0, "created_at": "2026-11-20T10:00:00Z"} |
    Then the value is rejected by "required" of "payment_changed"

  Scenario: A refund made with no event is rejected
    When I check a "refund_made" with:
      | refund                                                                                                                                                                                                                                       |
      | {"refund_id": "re_cccccccccccccccccccccccc", "payment_id": "pay_aaaaaaaaaaaaaaaaaaaaaaaa", "merchant_id": "m_1", "amount": 1000, "currency": "EUR", "captured_amount": 5000, "refunded_total": 1000, "created_at": "2026-11-22T10:00:00Z"} |
    Then the value is rejected by "required" of "refund_made"

  Scenario: A refund with no merchant is rejected
    When I check a "refund" with:
      | refund_id                  | payment_id                  | amount | currency | captured_amount | refunded_total | created_at           |
      | re_cccccccccccccccccccccccc | pay_aaaaaaaaaaaaaaaaaaaaaaaa | 1000   | EUR      | 5000            | 1000           | 2026-11-22T10:00:00Z |
    Then the value is rejected by "required" of "refund"

  Scenario Outline: A refusal without the values it names is rejected
    When I check a "<refusal>" with:
      | <property> |
      |            |
    Then the value is rejected by "required" of "<refusal>"

    Examples:
      | refusal                    | property        |
      | unsupported_currency       | currency        |
      | idempotency_conflict       | idempotency_key |
      | invalid_state              | status          |
      | capture_exceeds_authorized | amount          |
      | amount_exceeds_captured    | amount          |

  Scenario: Line items over 100 are rejected
    When I check a "create_payment_request" with:
      | merchant_id | amount | currency | method        | idempotency_key | iban                   | line_items   | caller.key_kind | caller.merchant_id | now                  | event_id                             |
      | m_1         | 101    | EUR      | bank_transfer | order-5         | DE89370400440532013000 | [{"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}, {"quantity": 1, "unit_amount": 1}] | secret          | m_1                | 2026-11-24T10:00:00Z | 00000000-0000-4000-8000-000000000001 |
    Then the value is rejected by "maxItems" of "line_items"
