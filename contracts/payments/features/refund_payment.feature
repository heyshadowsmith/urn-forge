Feature: Refund a payment

  Scenario Outline: A captured payment is refunded in part or in full
    When I run "refund_payment" with:
      | merchant_id | payment_id                  | amount   | idempotency_key | stored_payment.payment_id   | stored_payment.merchant_id | stored_payment.amount | stored_payment.currency | stored_payment.method | stored_payment.status | stored_payment.captured_amount | stored_payment.refunded_amount | stored_payment.created_at | stored_payment.captured_at | caller.key_kind | caller.merchant_id | now   | event_id                             |
      | m_1         | pay_aaaaaaaaaaaaaaaaaaaaaaaa | <amount> | refund-1        | pay_aaaaaaaaaaaaaaaaaaaaaaaa | m_1                        | 5000                  | EUR                     | card                  | <status>              | 4000                           | <refunded>                     | 2026-05-20T10:00:00Z      | 2026-05-28T10:00:00Z       | secret          | m_1                | <now> | 00000000-0000-4000-8000-000000000001 |
    Then the output is "refund_made":
      | payment_event                                                                                                                                                                                                                                                        |
      | {"event_id": "00000000-0000-4000-8000-000000000001", "event_type": "payment.<new_status>", "payment_id": "pay_aaaaaaaaaaaaaaaaaaaaaaaa", "merchant_id": "m_1", "amount": 5000, "currency": "EUR", "previous_status": "<status>", "new_status": "<new_status>", "occurred_at": "<now>"} |

    Examples:
      | amount | status             | refunded | now                  | new_status         |
      | 1000   | captured           | 0        | 2026-06-01T10:00:00Z | partially_refunded |
      | 4000   | captured           | 0        | 2026-06-01T10:00:00Z | refunded           |
      | 1000   | partially_refunded | 1000     | 2026-06-01T10:00:00Z | partially_refunded |
      | 3000   | partially_refunded | 1000     | 2026-11-24T10:00:00Z | refunded           |

  Scenario Outline: A refund is refused
    When I run "refund_payment" with:
      | merchant_id | payment_id                  | amount   | idempotency_key | stored_payment.payment_id   | stored_payment.merchant_id | stored_payment.amount | stored_payment.currency | stored_payment.method | stored_payment.status | stored_payment.captured_amount | stored_payment.refunded_amount | stored_payment.created_at | stored_payment.captured_at | caller.key_kind | caller.merchant_id | now   | event_id                             |
      | m_1         | pay_aaaaaaaaaaaaaaaaaaaaaaaa | <amount> | <key>           | pay_aaaaaaaaaaaaaaaaaaaaaaaa | <owner>                    | 5000                  | EUR                     | card                  | <status>              | <captured>                     | <refunded>                     | 2026-05-20T10:00:00Z      | <captured_at>              | <kind>          | <caller_merchant>  | <now> | 00000000-0000-4000-8000-000000000001 |
    Then the output is "<output>"

    Examples:
      | output                  | amount | key                    | owner | status     | captured | refunded | captured_at          | kind      | caller_merchant | now                      |
      | amount_exceeds_captured | 3001   | refund-1               | m_1   | captured   | 4000     | 1000     | 2026-05-28T10:00:00Z | secret    | m_1             | 2026-06-01T10:00:00Z     |
      | refund_window_closed    | 1000   | refund-1               | m_1   | captured   | 4000     | 0        | 2026-05-28T10:00:00Z | secret    | m_1             | 2026-11-24T10:00:00.001Z |
      | invalid_state           | 1000   | refund-1               | m_1   | authorized | 0        | 0        |                      | secret    | m_1             | 2026-06-01T10:00:00Z     |
      | invalid_state           | 1000   | refund-1               | m_1   | refunded   | 4000     | 4000     | 2026-05-28T10:00:00Z | secret    | m_1             | 2026-06-01T10:00:00Z     |
      | idempotency_conflict    | 1000   | used-with-another-body | m_1   | captured   | 4000     | 0        | 2026-05-28T10:00:00Z | secret    | m_1             | 2026-06-01T10:00:00Z     |
      | not_found               | 1000   | refund-1               | m_2   | captured   | 4000     | 0        | 2026-05-28T10:00:00Z | secret    | m_1             | 2026-06-01T10:00:00Z     |
      | forbidden               | 1000   | refund-1               | m_1   | captured   | 4000     | 0        | 2026-05-28T10:00:00Z | read_only | m_1             | 2026-06-01T10:00:00Z     |
      | unauthorized            | 1000   | refund-1               | m_1   | captured   | 4000     | 0        | 2026-05-28T10:00:00Z | none      |                 | 2026-06-01T10:00:00Z     |

  Scenario Outline: A refund that breaks a rule is rejected
    When I run "refund_payment" with:
      | merchant_id | payment_id   | amount   | idempotency_key | stored_payment.payment_id   | stored_payment.merchant_id | stored_payment.amount | stored_payment.currency | stored_payment.method | stored_payment.status | stored_payment.captured_amount | stored_payment.refunded_amount | stored_payment.created_at | stored_payment.captured_at | caller.key_kind | caller.merchant_id | now                  | event_id                             |
      | m_1         | <payment_id> | <amount> | refund-1        | pay_aaaaaaaaaaaaaaaaaaaaaaaa | m_1                        | 5000                  | EUR                     | card                  | <status>              | <captured>                     | <refunded>                     | 2026-05-20T10:00:00Z      | <captured_at>              | secret          | m_1                | 2026-06-01T10:00:00Z | 00000000-0000-4000-8000-000000000001 |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                              | definition     | payment_id                  | amount | status   | captured  | refunded | captured_at          |
      | names_the_payment                 | refund_request | pay_bbbbbbbbbbbbbbbbbbbbbbbb | 1000   | captured | 4000      | 0        | 2026-05-28T10:00:00Z |
      | required                          | refund_request | pay_aaaaaaaaaaaaaaaaaaaaaaaa |        | captured | 4000      | 0        | 2026-05-28T10:00:00Z |
      | captured_payment_has_capture_time | payment        | pay_aaaaaaaaaaaaaaaaaaaaaaaa | 1000   | captured | 4000      | 0        |                      |
      | amounts_within_payment            | payment        | pay_aaaaaaaaaaaaaaaaaaaaaaaa | 1000   | captured | 4000      | 4001     | 2026-05-28T10:00:00Z |
      | minimum                           | total          | pay_aaaaaaaaaaaaaaaaaaaaaaaa | 1000   | captured | 4000      | -1       | 2026-05-28T10:00:00Z |
      | maximum                           | total          | pay_aaaaaaaaaaaaaaaaaaaaaaaa | 1000   | captured | 100000000 | 0        | 2026-05-28T10:00:00Z |
      | enum                              | status         | pay_aaaaaaaaaaaaaaaaaaaaaaaa | 1000   | settled  | 4000      | 0        | 2026-05-28T10:00:00Z |
