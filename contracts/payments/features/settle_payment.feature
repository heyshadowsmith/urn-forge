Feature: Settle a bank transfer payment

  Scenario Outline: The bank's report authorizes or fails a pending payment
    When I run "settle_payment" with:
      | payment_id                  | transfer_outcome | stored_payment.payment_id   | stored_payment.merchant_id | stored_payment.amount | stored_payment.currency | stored_payment.method | stored_payment.status | stored_payment.captured_amount | stored_payment.refunded_amount | stored_payment.created_at | caller.key_kind | now                  | event_id                             |
      | pay_aaaaaaaaaaaaaaaaaaaaaaaa | <outcome>        | pay_aaaaaaaaaaaaaaaaaaaaaaaa | m_1                        | 5000                  | EUR                     | bank_transfer         | pending               | 0                              | 0                              | 2026-11-20T10:00:00Z      | bank            | 2026-11-24T10:00:00Z | 00000000-0000-4000-8000-000000000001 |
    Then the output is "payment_changed":
      | payment_event                                                                                                                                                                                                                                                  |
      | {"event_id": "00000000-0000-4000-8000-000000000001", "event_type": "payment.<status>", "payment_id": "pay_aaaaaaaaaaaaaaaaaaaaaaaa", "merchant_id": "m_1", "amount": 5000, "currency": "EUR", "previous_status": "pending", "new_status": "<status>", "occurred_at": "2026-11-24T10:00:00Z"} |

    Examples:
      | outcome | status     |
      | arrived | authorized |
      | failed  | failed     |

  Scenario Outline: A settlement is refused
    When I run "settle_payment" with:
      | payment_id                  | transfer_outcome | stored_payment.payment_id   | stored_payment.merchant_id | stored_payment.amount | stored_payment.currency | stored_payment.method | stored_payment.status | stored_payment.captured_amount | stored_payment.refunded_amount | stored_payment.created_at | caller.key_kind | caller.merchant_id | now                  | event_id                             |
      | pay_aaaaaaaaaaaaaaaaaaaaaaaa | arrived          | pay_aaaaaaaaaaaaaaaaaaaaaaaa | m_1                        | 5000                  | EUR                     | bank_transfer         | <status>              | 0                              | 0                              | 2026-11-20T10:00:00Z      | <kind>          | <caller_merchant>  | 2026-11-24T10:00:00Z | 00000000-0000-4000-8000-000000000001 |
    Then the output is "<output>"

    Examples:
      | output        | status     | kind   | caller_merchant |
      | invalid_state | authorized | bank   |                 |
      | forbidden     | pending    | clock  |                 |
      | forbidden     | pending    | secret | m_1             |
      | unauthorized  | pending    | none   |                 |

  Scenario Outline: A settlement that breaks a rule is rejected
    When I run "settle_payment" with:
      | payment_id   | transfer_outcome | stored_payment.payment_id   | stored_payment.merchant_id | stored_payment.amount | stored_payment.currency | stored_payment.method | stored_payment.status | stored_payment.captured_amount | stored_payment.refunded_amount | stored_payment.created_at | caller.key_kind | now                  | event_id                             |
      | <payment_id> | <outcome>        | pay_aaaaaaaaaaaaaaaaaaaaaaaa | m_1                        | 5000                  | EUR                     | bank_transfer         | pending               | 0                              | 0                              | 2026-11-20T10:00:00Z      | bank            | 2026-11-24T10:00:00Z | 00000000-0000-4000-8000-000000000001 |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule              | definition       | payment_id                  | outcome |
      | names_the_payment | settlement       | pay_bbbbbbbbbbbbbbbbbbbbbbbb | arrived |
      | enum              | transfer_outcome | pay_aaaaaaaaaaaaaaaaaaaaaaaa | lost    |
      | required          | settlement       | pay_aaaaaaaaaaaaaaaaaaaaaaaa |         |
      | pattern           | payment_id       | pay_123                     | arrived |
