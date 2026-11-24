Feature: Read a payment

  Scenario Outline: A key of the merchant reads its payment as it is stored
    When I run "get_payment" with:
      | merchant_id | payment_id                  | stored_payment.payment_id   | stored_payment.merchant_id | stored_payment.amount | stored_payment.currency | stored_payment.method | stored_payment.status | stored_payment.captured_amount | stored_payment.refunded_amount | stored_payment.created_at | stored_payment.captured_at | caller.key_kind | caller.merchant_id |
      | m_1         | pay_aaaaaaaaaaaaaaaaaaaaaaaa | pay_aaaaaaaaaaaaaaaaaaaaaaaa | m_1                        | 5000                  | EUR                     | card                  | partially_refunded    | 5000                           | 1000                           | 2026-11-20T10:00:00Z      | 2026-11-21T10:00:00Z       | <kind>          | m_1                |
    Then the output is "payment":
      | status             | captured_amount | refunded_amount |
      | partially_refunded | 5000            | 1000            |

    Examples:
      | kind      |
      | secret    |
      | read_only |

  Scenario Outline: A read is refused
    When I run "get_payment" with:
      | merchant_id | payment_id                  | stored_payment.payment_id   | stored_payment.merchant_id | stored_payment.amount | stored_payment.currency | stored_payment.method | stored_payment.status | stored_payment.captured_amount | stored_payment.refunded_amount | stored_payment.created_at | caller.key_kind | caller.merchant_id |
      | m_1         | pay_aaaaaaaaaaaaaaaaaaaaaaaa | pay_aaaaaaaaaaaaaaaaaaaaaaaa | <owner>                    | 5000                  | EUR                     | card                  | authorized            | 0                              | 0                              | 2026-11-20T10:00:00Z      | <kind>          | <caller_merchant>  |
    Then the output is "<output>"

    Examples:
      | output       | owner | kind      | caller_merchant |
      | not_found    | m_2   | read_only | m_1             |
      | not_found    | m_1   | secret    | m_2             |
      | forbidden    | m_1   | clock     |                 |
      | unauthorized | m_1   | none      |                 |

  Scenario Outline: A read that breaks a rule is rejected
    When I run "get_payment" with:
      | merchant_id | payment_id   | stored_payment.payment_id   | stored_payment.merchant_id | stored_payment.amount | stored_payment.currency | stored_payment.method | stored_payment.status | stored_payment.captured_amount | stored_payment.refunded_amount | stored_payment.created_at | caller.key_kind | caller.merchant_id |
      | m_1         | <payment_id> | pay_aaaaaaaaaaaaaaaaaaaaaaaa | m_1                        | 5000                  | EUR                     | card                  | authorized            | 0                              | 0                              | 2026-11-20T10:00:00Z      | <kind>          | m_1                |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule              | definition     | payment_id                  | kind      |
      | names_the_payment | payment_lookup | pay_bbbbbbbbbbbbbbbbbbbbbbbb | read_only |
      | required          | caller         | pay_aaaaaaaaaaaaaaaaaaaaaaaa |           |

  Scenario: A read with no stored payment is rejected
    When I run "get_payment" with:
      | merchant_id | payment_id                  | caller.key_kind | caller.merchant_id |
      | m_1         | pay_aaaaaaaaaaaaaaaaaaaaaaaa | read_only       | m_1                |
    Then the input is rejected by "required" of "payment_lookup"
