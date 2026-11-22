@urn:corpus:bookings:booking:operation:create_booking
Feature: Book a table

  Scenario Outline: A valid request is confirmed, with its reference, time zone, duration and any deposit
    When I run the operation with:
      | restaurant_id                        | local_date | local_time   | party_size   | contact   | idempotency_key   | special_requests   | dietary_tags   | deposit_token   |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24 | <local_time> | <party_size> | <contact> | <idempotency_key> | <special_requests> | <dietary_tags> | <deposit_token> |
    Then the output is:
      | reference | restaurant_id                        | status    | local_date | local_time   | time_zone    | party_size   | duration_minutes | deposit_amount   | deposit_per_guest   | currency   |
      | NEWBK234  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24 | <local_time> | Europe/Paris | <party_size> | 120              | <deposit_amount> | <deposit_per_guest> | <currency> |
    And the operation emits "urn:corpus:bookings:booking:event:booking_created":
      | reference | restaurant_id                        | state     | party_size   | local_date | local_time   | time_zone    | occurred_at          | guest_id                             |
      | NEWBK234  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | <party_size> | 2026-12-24 | <local_time> | Europe/Paris | 2026-11-22T10:00:00Z | a8098c1a-f86e-41da-bd5c-00c04fd430c8 |

    Examples:
      | local_time | party_size | contact                                                       | idempotency_key        | special_requests     | dietary_tags                                                                                                         | deposit_token | deposit_amount | deposit_per_guest | currency |
      | 19:30      | 1          | { name: A, email: ada@example.com }                           | 0123456789abcdef       |                      |                                                                                                                      |               |                |                   |          |
      | 00:00      | 6          | { name: =repeat(100, "a"), phone: "+123456789012345" }        | =repeat(64, "k")       | =repeat(500, "x")    | []                                                                                                                   |               |                |                   |          |
      | 23:15      | 7          | { name: Ada Lovelace, email: ada@example.com, phone: "+44" }  | client-key-0000000007  | Window table, please | [vegetarian, vegan, gluten_free, nut_allergy, halal, kosher, dairy_free, shellfish_allergy, egg_allergy, soy_allergy] | tok_visa_4242 | 140.00         | 20.00             | EUR      |
      | 12:45      | 12         | { name: Ada Lovelace, phone: "+447911123456" }                | client-key-0000000012  |                      | [pescatarian]                                                                                                        | tok_visa_4242 | 240.00         | 20.00             | EUR      |

  Scenario Outline: A party size outside 1 to 20 is rejected
    When I run the operation with:
      | restaurant_id                        | local_date | local_time | party_size   | contact                               | idempotency_key  |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24 | 19:30      | <party_size> | { name: Ada, email: ada@example.com } | 0123456789abcdef |
    Then the input is rejected on "party_size"

    Examples:
      | party_size |
      | 0          |
      | 21         |

  Scenario Outline: A party of 13 to 20 is refused online, to book by phone
    When I run the operation with:
      | restaurant_id                        | local_date | local_time | party_size   | contact                               | idempotency_key  | deposit_token |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24 | 19:30      | <party_size> | { name: Ada, email: ada@example.com } | 0123456789abcdef | tok_visa_4242 |
    Then the operation fails with "urn:corpus:bookings:booking:error:party_too_large_for_online":
      | party_size   |
      | <party_size> |
    And the operation emits no event

    Examples:
      | party_size |
      | 13         |
      | 20         |

  Scenario: A party of 7 with no deposit token is refused
    When I run the operation with:
      | restaurant_id                        | local_date | local_time | party_size | contact                               | idempotency_key  |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24 | 19:30      | 7          | { name: Ada, email: ada@example.com } | 0123456789abcdef |
    Then the operation fails with "urn:corpus:bookings:booking:error:deposit_required":
      | party_size |
      | 7          |
    And the operation emits no event

  Scenario: A declined deposit payment is refused
    When I run the operation with:
      | restaurant_id                        | local_date | local_time | party_size | contact                               | idempotency_key  | deposit_token |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24 | 19:30      | 8          | { name: Ada, email: ada@example.com } | 0123456789abcdef | declined      |
    Then the operation fails with "urn:corpus:bookings:booking:error:payment_declined"
    And the operation emits no event

  Scenario: An idempotency key used before with a different request is refused
    When I run the operation with:
      | restaurant_id                        | local_date | local_time | party_size | contact                               | idempotency_key   |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24 | 19:30      | 2          | { name: Ada, email: ada@example.com } | reused-key-000001 |
    Then the operation fails with "urn:corpus:bookings:booking:error:invalid_request":
      | idempotency_key   |
      | reused-key-000001 |
    And the operation emits no event

  Scenario: A start time outside the booking window is refused
    When I run the operation with:
      | restaurant_id                        | local_date | local_time | party_size | contact                               | idempotency_key  |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-21 | 19:30      | 2          | { name: Ada, email: ada@example.com } | 0123456789abcdef |
    Then the operation fails with "urn:corpus:bookings:booking:error:outside_booking_window":
      | local_date | local_time | time_zone    |
      | 2026-11-21 | 19:30      | Europe/Paris |
    And the operation emits no event

  Scenario: A full time is refused, with other start times on the same day
    When I run the operation with:
      | restaurant_id                        | local_date | local_time | party_size | contact                               | idempotency_key  |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24 | 23:45      | 2          | { name: Ada, email: ada@example.com } | 0123456789abcdef |
    Then the operation fails with "urn:corpus:bookings:booking:error:no_availability":
      | local_date | local_time | time_zone    | party_size | alternatives   |
      | 2026-12-24 | 23:45      | Europe/Paris | 2          | [22:00, 22:15] |
    And the operation emits no event

  Scenario: A contact with neither an email address nor a phone number is rejected
    When I run the operation with:
      | restaurant_id                        | local_date | local_time | party_size | contact       | idempotency_key  |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24 | 19:30      | 2          | { name: Ada } | 0123456789abcdef |
    Then the input is rejected by "urn:corpus:bookings:guest:invariant:email_or_phone"

  Scenario Outline: A contact with a name, an email address or a phone number that is not valid is rejected
    When I run the operation with:
      | restaurant_id                        | local_date | local_time | party_size | contact   | idempotency_key  |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24 | 19:30      | 2          | <contact> | 0123456789abcdef |
    Then the input is rejected on "contact"

    Examples:
      | contact                                                 |
      | { name: "", email: ada@example.com }                    |
      | { name: =repeat(101, "a"), email: ada@example.com }     |
      | { name: Ada, email: not-an-email }                      |
      | { name: Ada, phone: "0044791112" }                      |
      | { name: Ada, phone: "+1234567890123456" }               |

  Scenario Outline: A request with a field that is not valid is rejected on that field
    When I run the operation with:
      | restaurant_id   | local_date | local_time   | party_size | contact                               | idempotency_key   | special_requests   | dietary_tags   |
      | <restaurant_id> | 2026-12-24 | <local_time> | 2          | { name: Ada, email: ada@example.com } | <idempotency_key> | <special_requests> | <dietary_tags> |
    Then the input is rejected on "<field>"

    Examples:
      | field            | restaurant_id                        | local_time | idempotency_key   | special_requests  | dietary_tags                                                                                                                       |
      | restaurant_id    | restaurant-1                         | 19:30      | 0123456789abcdef  |                   |                                                                                                                                    |
      | local_time       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 19:20      | 0123456789abcdef  |                   |                                                                                                                                    |
      | idempotency_key  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 19:30      | =repeat(15, "k")  |                   |                                                                                                                                    |
      | idempotency_key  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 19:30      | =repeat(65, "k")  |                   |                                                                                                                                    |
      | special_requests | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 19:30      | 0123456789abcdef  | =repeat(501, "x") |                                                                                                                                    |
      | dietary_tags     | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 19:30      | 0123456789abcdef  |                   | [vegetarian, vegan, gluten_free, nut_allergy, halal, kosher, dairy_free, shellfish_allergy, egg_allergy, soy_allergy, pescatarian] |
      | dietary_tags     | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 19:30      | 0123456789abcdef  |                   | [vegan, vegan]                                                                                                                     |
      | dietary_tags     | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 19:30      | 0123456789abcdef  |                   | [paleo]                                                                                                                            |

  Scenario Outline: A request that leaves out a required part is rejected on that part
    When I run the operation with:
      | restaurant_id   | local_date   | local_time   | party_size   | contact   | idempotency_key   |
      | <restaurant_id> | <local_date> | <local_time> | <party_size> | <contact> | <idempotency_key> |
    Then the input is rejected on "<field>"

    Examples:
      | field           | restaurant_id                        | local_date | local_time | party_size | contact                               | idempotency_key  |
      | restaurant_id   |                                      | 2026-12-24 | 19:30      | 2          | { name: Ada, email: ada@example.com } | 0123456789abcdef |
      | local_date      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |            | 19:30      | 2          | { name: Ada, email: ada@example.com } | 0123456789abcdef |
      | local_time      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24 |            | 2          | { name: Ada, email: ada@example.com } | 0123456789abcdef |
      | party_size      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24 | 19:30      |            | { name: Ada, email: ada@example.com } | 0123456789abcdef |
      | contact         | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24 | 19:30      | 2          |                                       | 0123456789abcdef |
      | idempotency_key | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24 | 19:30      | 2          | { name: Ada, email: ada@example.com } |                  |
