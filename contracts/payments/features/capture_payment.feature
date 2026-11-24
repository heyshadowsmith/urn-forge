Feature: Capture a payment

  Scenario Outline: An authorized payment is captured, in full or in part
    When I run "capture_payment" with:
      | merchant_id | payment_id                  | amount   | stored_payment.payment_id   | stored_payment.merchant_id | stored_payment.amount | stored_payment.currency | stored_payment.method | stored_payment.status | stored_payment.captured_amount | stored_payment.refunded_amount | stored_payment.created_at | caller.key_kind | caller.merchant_id | now                  | event_id                             |
      | m_1         | pay_aaaaaaaaaaaaaaaaaaaaaaaa | <amount> | pay_aaaaaaaaaaaaaaaaaaaaaaaa | m_1                        | 5000                  | EUR                     | <method>              | authorized            | 0                              | 0                              | 2026-11-20T10:00:00Z      | secret          | m_1                | 2026-11-24T10:00:00Z | 00000000-0000-4000-8000-000000000001 |
    Then the output is "payment_changed":
      | payment                                                                                                                                                                                                                                         | payment_event                                                                                                                                                                                                                                              |
      | {"payment_id": "pay_aaaaaaaaaaaaaaaaaaaaaaaa", "merchant_id": "m_1", "amount": 5000, "currency": "EUR", "method": "<method>", "status": "captured", "captured_amount": <captured>, "refunded_amount": 0, "created_at": "2026-11-20T10:00:00Z", "captured_at": "2026-11-24T10:00:00Z"} | {"event_id": "00000000-0000-4000-8000-000000000001", "event_type": "payment.captured", "payment_id": "pay_aaaaaaaaaaaaaaaaaaaaaaaa", "merchant_id": "m_1", "amount": 5000, "currency": "EUR", "previous_status": "authorized", "new_status": "captured", "occurred_at": "2026-11-24T10:00:00Z"} |

    Examples:
      | method        | amount | captured |
      | card          |        | 5000     |
      | card          | 3000   | 3000     |
      | bank_transfer | 5000   | 5000     |

  Scenario Outline: A capture is refused
    When I run "capture_payment" with:
      | merchant_id | payment_id                  | amount   | stored_payment.payment_id   | stored_payment.merchant_id | stored_payment.amount | stored_payment.currency | stored_payment.method | stored_payment.status | stored_payment.captured_amount | stored_payment.refunded_amount | stored_payment.created_at | caller.key_kind | caller.merchant_id | now                  | event_id                             |
      | m_1         | pay_aaaaaaaaaaaaaaaaaaaaaaaa | <amount> | pay_aaaaaaaaaaaaaaaaaaaaaaaa | <owner>                    | 5000                  | EUR                     | card                  | <status>              | 0                              | 0                              | <created_at>              | <kind>          | <caller_merchant>  | 2026-11-24T10:00:00Z | 00000000-0000-4000-8000-000000000001 |
    Then the output is "<output>"

    Examples:
      | output                     | amount | owner | status     | created_at           | kind      | caller_merchant |
      | capture_exceeds_authorized | 5001   | m_1   | authorized | 2026-11-20T10:00:00Z | secret    | m_1             |
      | invalid_state              |        | m_1   | voided     | 2026-11-20T10:00:00Z | secret    | m_1             |
      | invalid_state              |        | m_1   | expired    | 2026-11-10T10:00:00Z | secret    | m_1             |
      | invalid_state              |        | m_1   | authorized | 2026-11-17T10:00:00Z | secret    | m_1             |
      | not_found                  |        | m_2   | authorized | 2026-11-20T10:00:00Z | secret    | m_1             |
      | not_found                  |        | m_1   | authorized | 2026-11-20T10:00:00Z | secret    | m_2             |
      | forbidden                  |        | m_1   | authorized | 2026-11-20T10:00:00Z | read_only | m_1             |
      | unauthorized               |        | m_1   | authorized | 2026-11-20T10:00:00Z | none      |                 |

  Scenario: A capture that names another payment than the one loaded is rejected
    When I run "capture_payment" with:
      | merchant_id | payment_id                  | stored_payment.payment_id   | stored_payment.merchant_id | stored_payment.amount | stored_payment.currency | stored_payment.method | stored_payment.status | stored_payment.captured_amount | stored_payment.refunded_amount | stored_payment.created_at | caller.key_kind | caller.merchant_id | now                  | event_id                             |
      | m_1         | pay_bbbbbbbbbbbbbbbbbbbbbbbb | pay_aaaaaaaaaaaaaaaaaaaaaaaa | m_1                        | 5000                  | EUR                     | card                  | authorized            | 0                              | 0                              | 2026-11-20T10:00:00Z      | secret          | m_1                | 2026-11-24T10:00:00Z | 00000000-0000-4000-8000-000000000001 |
    Then the input is rejected by "names_the_payment" of "capture_request"

  Scenario: A capture with no stored payment is rejected
    When I run "capture_payment" with:
      | merchant_id | payment_id                  | caller.key_kind | caller.merchant_id | now                  | event_id                             |
      | m_1         | pay_aaaaaaaaaaaaaaaaaaaaaaaa | secret          | m_1                | 2026-11-24T10:00:00Z | 00000000-0000-4000-8000-000000000001 |
    Then the input is rejected by "required" of "capture_request"
