Feature: Void a payment

  Scenario: An authorized payment is voided, and only its status changes
    When I run "void_payment" with:
      | merchant_id | payment_id                  | stored_payment                                                                                                                                                                                                                                                                  | caller.key_kind | caller.merchant_id | now                  | event_id                             |
      | m_1         | pay_aaaaaaaaaaaaaaaaaaaaaaaa | {"payment_id": "pay_aaaaaaaaaaaaaaaaaaaaaaaa", "merchant_id": "m_1", "amount": 5000, "currency": "EUR", "method": "card", "status": "authorized", "captured_amount": 0, "refunded_amount": 0, "card_summary": {"brand": "visa", "last4": "4242", "exp_month": 12, "exp_year": 2030}, "created_at": "2026-11-20T10:00:00Z"} | secret          | m_1                | 2026-11-24T10:00:00Z | 00000000-0000-4000-8000-000000000001 |
    Then the output is "payment_changed":
      | payment                                                                                                                                                                                                                                                                      | payment_event                                                                                                                                                                                                                                             |
      | {"payment_id": "pay_aaaaaaaaaaaaaaaaaaaaaaaa", "merchant_id": "m_1", "amount": 5000, "currency": "EUR", "method": "card", "status": "voided", "captured_amount": 0, "refunded_amount": 0, "card_summary": {"brand": "visa", "last4": "4242", "exp_month": 12, "exp_year": 2030}, "created_at": "2026-11-20T10:00:00Z"} | {"event_id": "00000000-0000-4000-8000-000000000001", "event_type": "payment.voided", "payment_id": "pay_aaaaaaaaaaaaaaaaaaaaaaaa", "merchant_id": "m_1", "amount": 5000, "currency": "EUR", "previous_status": "authorized", "new_status": "voided", "occurred_at": "2026-11-24T10:00:00Z"} |

  Scenario Outline: A void is refused
    When I run "void_payment" with:
      | merchant_id | payment_id                  | stored_payment.payment_id   | stored_payment.merchant_id | stored_payment.amount | stored_payment.currency | stored_payment.method | stored_payment.status | stored_payment.captured_amount | stored_payment.refunded_amount | stored_payment.created_at | stored_payment.captured_at | caller.key_kind | caller.merchant_id | now                  | event_id                             |
      | m_1         | pay_aaaaaaaaaaaaaaaaaaaaaaaa | pay_aaaaaaaaaaaaaaaaaaaaaaaa | <owner>                    | 5000                  | EUR                     | card                  | <status>              | <captured>                     | 0                              | <created_at>              | <captured_at>              | <kind>          | <caller_merchant>  | 2026-11-24T10:00:00Z | 00000000-0000-4000-8000-000000000001 |
    Then the output is "<output>"

    Examples:
      | output        | owner | status     | captured | created_at           | captured_at          | kind      | caller_merchant |
      | invalid_state | m_1   | captured   | 5000     | 2026-11-20T10:00:00Z | 2026-11-21T10:00:00Z | secret    | m_1             |
      | invalid_state | m_1   | authorized | 0        | 2026-11-17T10:00:00Z |                      | secret    | m_1             |
      | not_found     | m_2   | authorized | 0        | 2026-11-20T10:00:00Z |                      | secret    | m_1             |
      | forbidden     | m_1   | authorized | 0        | 2026-11-20T10:00:00Z |                      | read_only | m_1             |
      | unauthorized  | m_1   | authorized | 0        | 2026-11-20T10:00:00Z |                      | none      |                 |

  Scenario: A void that names another payment than the one loaded is rejected
    When I run "void_payment" with:
      | merchant_id | payment_id                  | stored_payment.payment_id   | stored_payment.merchant_id | stored_payment.amount | stored_payment.currency | stored_payment.method | stored_payment.status | stored_payment.captured_amount | stored_payment.refunded_amount | stored_payment.created_at | caller.key_kind | caller.merchant_id | now                  | event_id                             |
      | m_1         | pay_bbbbbbbbbbbbbbbbbbbbbbbb | pay_aaaaaaaaaaaaaaaaaaaaaaaa | m_1                        | 5000                  | EUR                     | card                  | authorized            | 0                              | 0                              | 2026-11-20T10:00:00Z      | secret          | m_1                | 2026-11-24T10:00:00Z | 00000000-0000-4000-8000-000000000001 |
    Then the input is rejected by "names_the_payment" of "void_request"

  Scenario: A void with no stored payment is rejected
    When I run "void_payment" with:
      | merchant_id | payment_id                  | caller.key_kind | caller.merchant_id | now                  | event_id                             |
      | m_1         | pay_aaaaaaaaaaaaaaaaaaaaaaaa | secret          | m_1                | 2026-11-24T10:00:00Z | 00000000-0000-4000-8000-000000000001 |
    Then the input is rejected by "required" of "void_request"
