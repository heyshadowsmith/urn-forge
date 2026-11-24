Feature: Expire a payment

  Scenario: The clock expires an authorized card payment 7 days after its authorization
    When I run "expire_payment" with:
      | payment_id                  | stored_payment.payment_id   | stored_payment.merchant_id | stored_payment.amount | stored_payment.currency | stored_payment.method | stored_payment.status | stored_payment.captured_amount | stored_payment.refunded_amount | stored_payment.created_at | caller.key_kind | now                  | event_id                             |
      | pay_aaaaaaaaaaaaaaaaaaaaaaaa | pay_aaaaaaaaaaaaaaaaaaaaaaaa | m_1                        | 5000                  | EUR                     | card                  | authorized            | 0                              | 0                              | 2026-11-17T10:00:00Z      | clock           | 2026-11-24T10:00:00Z | 00000000-0000-4000-8000-000000000001 |
    Then the output is "payment_changed":
      | payment_event                                                                                                                                                                                                                                              |
      | {"event_id": "00000000-0000-4000-8000-000000000001", "event_type": "payment.expired", "payment_id": "pay_aaaaaaaaaaaaaaaaaaaaaaaa", "merchant_id": "m_1", "amount": 5000, "currency": "EUR", "previous_status": "authorized", "new_status": "expired", "occurred_at": "2026-11-24T10:00:00Z"} |

  Scenario Outline: An expiry is refused
    When I run "expire_payment" with:
      | payment_id                  | stored_payment.payment_id   | stored_payment.merchant_id | stored_payment.amount | stored_payment.currency | stored_payment.method | stored_payment.status | stored_payment.captured_amount | stored_payment.refunded_amount | stored_payment.created_at | caller.key_kind | caller.merchant_id | now                  | event_id                             |
      | pay_aaaaaaaaaaaaaaaaaaaaaaaa | pay_aaaaaaaaaaaaaaaaaaaaaaaa | m_1                        | 5000                  | EUR                     | <method>              | <status>              | 0                              | 0                              | <created_at>              | <kind>          | <caller_merchant>  | 2026-11-24T10:00:00Z | 00000000-0000-4000-8000-000000000001 |
    Then the output is "<output>"

    Examples:
      | output        | method        | status     | created_at           | kind   | caller_merchant |
      | invalid_state | card          | authorized | 2026-11-17T10:00:01Z | clock  |                 |
      | invalid_state | card          | voided     | 2026-11-10T10:00:00Z | clock  |                 |
      | invalid_state | bank_transfer | authorized | 2026-11-10T10:00:00Z | clock  |                 |
      | forbidden     | card          | authorized | 2026-11-10T10:00:00Z | secret | m_1             |
      | unauthorized  | card          | authorized | 2026-11-10T10:00:00Z | none   |                 |

  Scenario: An expiry that names another payment than the one loaded is rejected
    When I run "expire_payment" with:
      | payment_id                  | stored_payment.payment_id   | stored_payment.merchant_id | stored_payment.amount | stored_payment.currency | stored_payment.method | stored_payment.status | stored_payment.captured_amount | stored_payment.refunded_amount | stored_payment.created_at | caller.key_kind | now                  | event_id                             |
      | pay_bbbbbbbbbbbbbbbbbbbbbbbb | pay_aaaaaaaaaaaaaaaaaaaaaaaa | m_1                        | 5000                  | EUR                     | card                  | authorized            | 0                              | 0                              | 2026-11-17T10:00:00Z      | clock           | 2026-11-24T10:00:00Z | 00000000-0000-4000-8000-000000000001 |
    Then the input is rejected by "names_the_payment" of "expiry"

  Scenario: An expiry with no stored payment is rejected
    When I run "expire_payment" with:
      | payment_id                  | caller.key_kind | now                  | event_id                             |
      | pay_aaaaaaaaaaaaaaaaaaaaaaaa | clock           | 2026-11-24T10:00:00Z | 00000000-0000-4000-8000-000000000001 |
    Then the input is rejected by "required" of "expiry"
