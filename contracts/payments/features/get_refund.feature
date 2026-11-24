Feature: Read a refund

  Scenario Outline: A key of the merchant reads its refund as it is stored
    When I run "get_refund" with:
      | merchant_id | refund_id                  | stored_refund                                                                                                                                                                                                                                        | caller.key_kind | caller.merchant_id |
      | m_1         | re_cccccccccccccccccccccccc | {"refund_id": "re_cccccccccccccccccccccccc", "payment_id": "pay_aaaaaaaaaaaaaaaaaaaaaaaa", "merchant_id": "m_1", "amount": 1000, "currency": "EUR", "captured_amount": 5000, "refunded_total": 1000, "created_at": "2026-11-22T10:00:00Z"} | <kind>          | m_1                |
    Then the output is "refund":
      | refund_id                  | amount | refunded_total |
      | re_cccccccccccccccccccccccc | 1000   | 1000           |

    Examples:
      | kind      |
      | secret    |
      | read_only |

  Scenario Outline: A read is refused
    When I run "get_refund" with:
      | merchant_id | refund_id                  | stored_refund                                                                                                                                                                                                                                          | caller.key_kind | caller.merchant_id |
      | m_1         | re_cccccccccccccccccccccccc | {"refund_id": "re_cccccccccccccccccccccccc", "payment_id": "pay_aaaaaaaaaaaaaaaaaaaaaaaa", "merchant_id": "<owner>", "amount": 1000, "currency": "EUR", "captured_amount": 5000, "refunded_total": 1000, "created_at": "2026-11-22T10:00:00Z"} | <kind>          | <caller_merchant>  |
    Then the output is "<output>"

    Examples:
      | output       | owner | kind      | caller_merchant |
      | not_found    | m_2   | read_only | m_1             |
      | not_found    | m_1   | secret    | m_2             |
      | forbidden    | m_1   | bank      |                 |
      | unauthorized | m_1   | none      |                 |

  Scenario Outline: A read that breaks a rule is rejected
    When I run "get_refund" with:
      | merchant_id | refund_id   | stored_refund                                                                                                                                                                                                                                        | caller.key_kind | caller.merchant_id |
      | m_1         | <refund_id> | {"refund_id": "re_cccccccccccccccccccccccc", "payment_id": "pay_aaaaaaaaaaaaaaaaaaaaaaaa", "merchant_id": "m_1", "amount": 1000, "currency": "EUR", "captured_amount": 5000, "refunded_total": <total>, "created_at": "2026-11-22T10:00:00Z"} | read_only       | m_1                |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                    | definition    | refund_id                  | total |
      | names_the_refund        | refund_lookup | re_dddddddddddddddddddddddd | 1000  |
      | pattern                 | refund_id     | re_1                       | 1000  |
      | refunds_within_captured | refund        | re_cccccccccccccccccccccccc | 6000  |

  Scenario: A read with no stored refund is rejected
    When I run "get_refund" with:
      | merchant_id | refund_id                  | caller.key_kind | caller.merchant_id |
      | m_1         | re_cccccccccccccccccccccccc | read_only       | m_1                |
    Then the input is rejected by "required" of "refund_lookup"
