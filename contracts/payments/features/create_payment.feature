@urn-forge:strict
@urn:corpus:payments:payment:operation:create_payment
Feature: Create a payment

  Scenario: A card payment is authorized, and the answer shows only a summary of the card
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    When I run the operation with:
      | merchant_id | amount | currency | method | idempotency_key | card                                                                                 |
      | mer_1       | 5000   | EUR      | card   | order-41        | { card_number: 378282246310005, exp_month: 12, exp_year: 2030, security_code: 1234 } |
    Then the output is:
      | payment_id                   | merchant_id | amount | currency | method | status     | card                                                   | created_at           |
      | pay_new000000000000000000000 | mer_1       | 5000   | EUR      | card   | authorized | { brand: amex, last4: 0005, exp_month: 12, exp_year: 2030 } | 2026-11-22T10:00:00Z |
    And the operation emits "urn:corpus:payments:payment:event:authorized":
      | event_id                             | payment_id                   | merchant_id | amount | currency | previous_status | new_status | occurred_at          |
      | 00000000-0000-4000-8000-000000000001 | pay_new000000000000000000000 | mer_1       | 5000   | EUR      |                 | authorized | 2026-11-22T10:00:00Z |
    And the operation emits no "urn:corpus:payments:payment:event:pending"

  Scenario Outline: A card payment with each value at the edge of its limits is authorized
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    When I run the operation with:
      | merchant_id | amount   | currency   | method | idempotency_key   | description   | metadata   | line_items   | card   |
      | mer_1       | <amount> | <currency> | card   | <idempotency_key> | <description> | <metadata> | <line_items> | <card> |
    Then the output is:
      | payment_id                   | merchant_id | amount   | currency   | method | status     |
      | pay_new000000000000000000000 | mer_1       | <amount> | <currency> | card   | authorized |
    And the operation emits "urn:corpus:payments:payment:event:authorized":
      | payment_id                   | amount   | currency   | new_status | occurred_at          |
      | pay_new000000000000000000000 | <amount> | <currency> | authorized | 2026-11-22T10:00:00Z |

    Examples:
      | amount   | currency | idempotency_key     | description         | metadata | line_items                                                             | card |
      | 1        | USD      | k                   |                     |          |                                                                        | { card_number: 4242424242424242, exp_month: 1, exp_year: 1000, security_code: 123 } |
      | 99999999 | GBP      | =repeat(64, "k")    | =repeat(255, "d")   | [{ key: k1, value: v }, { key: k2, value: v }, { key: k3, value: v }, { key: k4, value: v }, { key: k5, value: v }, { key: k6, value: v }, { key: k7, value: v }, { key: k8, value: v }, { key: k9, value: v }, { key: k10, value: v }, { key: k11, value: v }, { key: k12, value: v }, { key: k13, value: v }, { key: k14, value: v }, { key: k15, value: v }, { key: k16, value: v }, { key: k17, value: v }, { key: k18, value: v }, { key: k19, value: v }, { key: k20, value: v }] |                                                                        | { card_number: 4242424242424242, exp_month: 12, exp_year: 9999, security_code: 123 } |
      | 5000     | EUR      | order 42 / Zoë      | Two tickets         | []       | [{ quantity: 1, unit_amount: 5000 }]                                   | { card_number: 4242424242424242, exp_month: 6, exp_year: 2030, security_code: 123 } |
      | 5000     | CHF      | order-43            |                     |          | =repeat(100, { quantity: 1, unit_amount: 50 })                         | { card_number: 4242424242424242, exp_month: 6, exp_year: 2030, security_code: 123 } |
      | 5000     | EUR      | order-44            |                     |          | [{ quantity: 1, unit_amount: 0 }, { quantity: 2, unit_amount: 2500 }] | { card_number: 4242424242424242, exp_month: 6, exp_year: 2030, security_code: 123 } |
      | 5000     | AUD      | order-60            |                     |          |                                                                       | { card_number: 4242424242424242, exp_month: 6, exp_year: 2030, security_code: 123 } |
      | 5000     | CAD      | order-61            |                     |          |                                                                       | { card_number: 4242424242424242, exp_month: 6, exp_year: 2030, security_code: 123 } |
      | 5000     | DKK      | order-62            |                     |          |                                                                       | { card_number: 4242424242424242, exp_month: 6, exp_year: 2030, security_code: 123 } |
      | 5000     | NOK      | order-63            |                     |          |                                                                       | { card_number: 4242424242424242, exp_month: 6, exp_year: 2030, security_code: 123 } |
      | 5000     | SEK      | order-64            |                     |          |                                                                       | { card_number: 4242424242424242, exp_month: 6, exp_year: 2030, security_code: 123 } |

  Scenario: A bank transfer payment is pending
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    When I run the operation with:
      | merchant_id | amount | currency | method        | idempotency_key | iban                   |
      | mer_1       | 5000   | EUR      | bank_transfer | order-45        | DE89370400440532013000 |
    Then the output is:
      | payment_id                   | amount | currency | method        | status  | card |
      | pay_new000000000000000000000 | 5000   | EUR      | bank_transfer | pending |      |
    And the operation emits "urn:corpus:payments:payment:event:pending":
      | payment_id                   | merchant_id | amount | currency | previous_status | new_status | occurred_at          |
      | pay_new000000000000000000000 | mer_1       | 5000   | EUR      |                 | pending    | 2026-11-22T10:00:00Z |
    And the operation emits no "urn:corpus:payments:payment:event:authorized"

  Scenario Outline: A request with a value out of its limits is rejected on that value
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    When I run the operation with:
      | merchant_id | amount   | currency   | method   | idempotency_key   | description   | metadata   | line_items   | card   |
      | mer_1       | <amount> | <currency> | <method> | <idempotency_key> | <description> | <metadata> | <line_items> | <card> |
    Then the input is rejected on "<field>"

    Examples:
      | field           | amount    | currency | method | idempotency_key  | description       | metadata                                             | line_items                                     | card                                                                                    |
      | amount          | 0         | EUR      | card   | k                |                   |                                                      |                                                | { card_number: 4242424242424242, exp_month: 1, exp_year: 2030, security_code: 123 }    |
      | amount          | 100000000 | EUR      | card   | k                |                   |                                                      |                                                | { card_number: 4242424242424242, exp_month: 1, exp_year: 2030, security_code: 123 }    |
      | currency        | 5000      | eur      | card   | k                |                   |                                                      |                                                | { card_number: 4242424242424242, exp_month: 1, exp_year: 2030, security_code: 123 }    |
      | currency        | 5000      | XYZ      | card   | k                |                   |                                                      |                                                | { card_number: 4242424242424242, exp_month: 1, exp_year: 2030, security_code: 123 }    |
      | currency        | 5000      | XXX      | card   | k                |                   |                                                      |                                                | { card_number: 4242424242424242, exp_month: 1, exp_year: 2030, security_code: 123 }    |
      | method          | 5000      | EUR      | cash   | k                |                   |                                                      |                                                |                                                                                         |
      | idempotency_key | 5000      | EUR      | card   | ""               |                   |                                                      |                                                | { card_number: 4242424242424242, exp_month: 1, exp_year: 2030, security_code: 123 }    |
      | idempotency_key | 5000      | EUR      | card   | =repeat(65, "k") |                   |                                                      |                                                | { card_number: 4242424242424242, exp_month: 1, exp_year: 2030, security_code: 123 }    |
      | idempotency_key | 5000      | EUR      | card   | ="a\u0007b"      |                   |                                                      |                                                | { card_number: 4242424242424242, exp_month: 1, exp_year: 2030, security_code: 123 }    |
      | description     | 5000      | EUR      | card   | k                | =repeat(256, "d") |                                                      |                                                | { card_number: 4242424242424242, exp_month: 1, exp_year: 2030, security_code: 123 }    |
      | metadata        | 5000      | EUR      | card   | k                |                   | [{ key: k1, value: v }, { key: k2, value: v }, { key: k3, value: v }, { key: k4, value: v }, { key: k5, value: v }, { key: k6, value: v }, { key: k7, value: v }, { key: k8, value: v }, { key: k9, value: v }, { key: k10, value: v }, { key: k11, value: v }, { key: k12, value: v }, { key: k13, value: v }, { key: k14, value: v }, { key: k15, value: v }, { key: k16, value: v }, { key: k17, value: v }, { key: k18, value: v }, { key: k19, value: v }, { key: k20, value: v }, { key: k21, value: v }] |                                                | { card_number: 4242424242424242, exp_month: 1, exp_year: 2030, security_code: 123 }    |
      | metadata        | 5000      | EUR      | card   | k                |                   | [{ key: k1, value: a }, { key: k1, value: b }]       |                                                | { card_number: 4242424242424242, exp_month: 1, exp_year: 2030, security_code: 123 }    |
      | line_items      | 5000      | EUR      | card   | k                |                   |                                                      | []                                             | { card_number: 4242424242424242, exp_month: 1, exp_year: 2030, security_code: 123 }    |
      | line_items      | 5000      | EUR      | card   | k                |                   |                                                      | =repeat(101, { quantity: 1, unit_amount: 50 }) | { card_number: 4242424242424242, exp_month: 1, exp_year: 2030, security_code: 123 }    |
      | line_items      | 5000      | EUR      | card   | k                |                   |                                                      | [{ quantity: 0, unit_amount: 5000 }]           | { card_number: 4242424242424242, exp_month: 1, exp_year: 2030, security_code: 123 }    |
      | line_items      | 5000      | EUR      | card   | k                |                   |                                                      | [{ quantity: 1, unit_amount: -1 }]             | { card_number: 4242424242424242, exp_month: 1, exp_year: 2030, security_code: 123 }    |
      | card            | 5000      | EUR      | card   | k                |                   |                                                      |                                                | { card_number: 4242, exp_month: 1, exp_year: 2030, security_code: 123 }                 |
      | card            | 5000      | EUR      | card   | k                |                   |                                                      |                                                | { card_number: 4242424242424242, exp_month: 0, exp_year: 2030, security_code: 123 }    |
      | card            | 5000      | EUR      | card   | k                |                   |                                                      |                                                | { card_number: 4242424242424242, exp_month: 13, exp_year: 2030, security_code: 123 }   |
      | card            | 5000      | EUR      | card   | k                |                   |                                                      |                                                | { card_number: 4242424242424242, exp_month: 1, exp_year: 999, security_code: 123 }     |
      | card            | 5000      | EUR      | card   | k                |                   |                                                      |                                                | { card_number: 4242424242424242, exp_month: 1, exp_year: 10000, security_code: 123 }   |
      | card            | 5000      | EUR      | card   | k                |                   |                                                      |                                                | { card_number: 4242424242424242, exp_month: 1, exp_year: 2030, security_code: 12 }     |

  Scenario: An IBAN that does not have its form is rejected
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    When I run the operation with:
      | merchant_id | amount | currency | method        | idempotency_key | iban                   |
      | mer_1       | 5000   | EUR      | bank_transfer | order-46        | de89370400440532013000 |
    Then the input is rejected on "iban"

  Scenario: A card payment without card details is rejected
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    When I run the operation with:
      | merchant_id | amount | currency | method | idempotency_key |
      | mer_1       | 5000   | EUR      | card   | order-47        |
    Then the input is rejected by "urn:corpus:payments:payment:invariant:card_payment_has_card"

  Scenario Outline: A bank transfer payment without an IBAN, or with card details, is rejected
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    When I run the operation with:
      | merchant_id | amount | currency | method        | idempotency_key | iban   | card   |
      | mer_1       | 5000   | EUR      | bank_transfer | order-48        | <iban> | <card> |
    Then the input is rejected by "urn:corpus:payments:payment:invariant:bank_transfer_has_iban_and_no_card"

    Examples:
      | iban                   | card                                                                                 |
      |                        |                                                                                      |
      | DE89370400440532013000 | { card_number: 4242424242424242, exp_month: 1, exp_year: 2030, security_code: 123 } |

  Scenario Outline: The bank of the card refuses the payment
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    When I run the operation with:
      | merchant_id | amount | currency | method | idempotency_key | card   |
      | mer_1       | 5000   | EUR      | card   | order-49        | <card> |
    Then the operation fails with "<error>"
    And the operation emits no event

    Examples:
      | card | error                                                    |
      | { card_number: 4000000000000002, exp_month: 1, exp_year: 2030, security_code: 123 } | urn:corpus:payments:payment:error:card_declined      |
      | { card_number: 4000000000009995, exp_month: 1, exp_year: 2030, security_code: 123 } | urn:corpus:payments:payment:error:insufficient_funds |
      | { card_number: 4000000000000069, exp_month: 1, exp_year: 2030, security_code: 123 } | urn:corpus:payments:payment:error:expired_card       |
      | { card_number: 4100000000000019, exp_month: 1, exp_year: 2030, security_code: 123 } | urn:corpus:payments:payment:error:fraud_suspected    |

  Scenario: A currency that the merchant cannot take is refused
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    When I run the operation with:
      | merchant_id | amount | currency | method        | idempotency_key | iban                   |
      | mer_1       | 5000   | JPY      | bank_transfer | order-50        | DE89370400440532013000 |
    Then the operation fails with "urn:corpus:payments:payment:error:unsupported_currency":
      | currency |
      | JPY      |

  Scenario Outline: Line items that do not add up to the amount are refused as an invalid request
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    When I run the operation with:
      | merchant_id | amount | currency | method        | idempotency_key | iban                   | line_items   |
      | mer_1       | 5000   | EUR      | bank_transfer | order-51        | DE89370400440532013000 | <line_items> |
    Then the operation fails with "urn:corpus:payments:payment:error:invalid_request"
    And the operation emits no event

    Examples:
      | line_items                                                              |
      | [{ quantity: 2, unit_amount: 2000 }, { quantity: 1, unit_amount: 999 }]  |
      | [{ quantity: 2, unit_amount: 2000 }, { quantity: 1, unit_amount: 1001 }] |
      | [{ quantity: 1, unit_amount: 5000 }, { quantity: 3, unit_amount: 0 }, { quantity: 1, unit_amount: 1 }] |

  Scenario: A repeat with the same key and the same body within 24 hours gets the first answer, and creates no second payment
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    When I run the operation with:
      | merchant_id | amount | currency | method        | idempotency_key | iban                   |
      | mer_1       | 5000   | EUR      | bank_transfer | order-60        | DE89370400440532013000 |
    And the time is "2026-11-23T09:59:59.999Z"
    And I run the operation again with:
      | merchant_id | amount | currency | method        | idempotency_key | iban                   |
      | mer_1       | 5000   | EUR      | bank_transfer | order-60        | DE89370400440532013000 |
    Then the answer is the first answer
    And the operation emits no event

  Scenario: A repeat with the same key and the same body after 24 hours creates a new payment
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    When I run the operation with:
      | merchant_id | amount | currency | method        | idempotency_key | iban                   |
      | mer_1       | 5000   | EUR      | bank_transfer | order-61        | DE89370400440532013000 |
    And the time is "2026-11-23T10:00:00Z"
    And I run the operation again with:
      | merchant_id | amount | currency | method        | idempotency_key | iban                   |
      | mer_1       | 5000   | EUR      | bank_transfer | order-61        | DE89370400440532013000 |
    Then the operation emits "urn:corpus:payments:payment:event:pending":
      | payment_id                   | merchant_id | new_status | occurred_at          |
      | pay_new000000000000000000000 | mer_1       | pending    | 2026-11-23T10:00:00Z |

  Scenario: The same key from another merchant is that merchant's own, and creates its payment
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    When I run the operation with:
      | merchant_id | amount | currency | method        | idempotency_key | iban                   |
      | mer_1       | 5000   | EUR      | bank_transfer | order-62        | DE89370400440532013000 |
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_2       |
    And I run the operation again with:
      | merchant_id | amount | currency | method        | idempotency_key | iban                   |
      | mer_2       | 5000   | EUR      | bank_transfer | order-62        | DE89370400440532013000 |
    Then the operation emits "urn:corpus:payments:payment:event:pending":
      | payment_id                   | merchant_id | new_status | occurred_at          |
      | pay_new000000000000000000000 | mer_2       | pending    | 2026-11-22T10:00:00Z |

  Scenario: A repeat with a read-only key of the same merchant does not get the first answer: it is refused as not found
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    When I run the operation with:
      | merchant_id | amount | currency | method        | idempotency_key | iban                   |
      | mer_1       | 5000   | EUR      | bank_transfer | order-63        | DE89370400440532013000 |
    And the caller is:
      | key_kind  | merchant_id |
      | read_only | mer_1       |
    And I run the operation again with:
      | merchant_id | amount | currency | method        | idempotency_key | iban                   |
      | mer_1       | 5000   | EUR      | bank_transfer | order-63        | DE89370400440532013000 |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"
    And the operation emits no event

  Scenario: An idempotency key that an earlier, different request used is refused
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind | merchant_id |
      | secret   | mer_1       |
    When I run the operation with:
      | merchant_id | amount | currency | method        | idempotency_key | iban                   |
      | mer_1       | 5000   | EUR      | bank_transfer | used-key        | DE89370400440532013000 |
    And the time is "2026-11-23T09:59:59.999Z"
    And I run the operation again with:
      | merchant_id | amount | currency | method        | idempotency_key | iban                   |
      | mer_1       | 5001   | EUR      | bank_transfer | used-key        | DE89370400440532013000 |
    Then the operation fails with "urn:corpus:payments:payment:error:idempotency_conflict":
      | idempotency_key |
      | used-key        |
    And the operation emits no event

  Scenario Outline: A request that names a merchant other than the key's, known or unknown, or a read-only key is refused as not found
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind   | merchant_id |
      | <key_kind> | mer_1       |
    When I run the operation with:
      | merchant_id   | amount | currency | method        | idempotency_key | iban                   |
      | <merchant_id> | 5000   | EUR      | bank_transfer | order-52        | DE89370400440532013000 |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"
    And the operation emits no event

    Examples:
      | key_kind  | merchant_id |
      | secret    | mer_unknown |
      | secret    | mer_2       |
      | read_only | mer_1       |

  Scenario: The clock, which belongs to no merchant, is refused as not found
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | key_kind |
      | clock    |
    When I run the operation with:
      | merchant_id | amount | currency | method        | idempotency_key | iban                   |
      | mer_1       | 5000   | EUR      | bank_transfer | order-52        | DE89370400440532013000 |
    Then the operation fails with "urn:corpus:payments:payment:error:not_found"
    And the operation emits no event
