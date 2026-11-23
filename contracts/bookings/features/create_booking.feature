@urn:corpus:bookings:booking:operation:create_booking
Feature: Book a table

  # The shell gives the time of each call; a scenario that needs another one says so.
  Background:
    Given the time is "2026-11-22T10:00:00Z"

  Scenario Outline: A valid request is confirmed, with its reference, time zone, duration and any deposit
    Given the caller is:
      | role  |
      | guest |
    When I run the operation with:
      | restaurant_id                        | starts_at   | local_date | local_time   | party_size   | contact   | idempotency_key   | special_requests   | dietary_tags   | deposit_token   |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | <starts_at> | 2026-12-24 | <local_time> | <party_size> | <contact> | <idempotency_key> | <special_requests> | <dietary_tags> | <deposit_token> |
    Then the output is:
      | reference | restaurant_id                        | status    | starts_at   | local_date | local_time   | time_zone    | party_size   | duration_minutes | deposit_amount   | deposit_per_guest   | currency   |
      | NEWBK234  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | <starts_at> | 2026-12-24 | <local_time> | Europe/Paris | <party_size> | 120              | <deposit_amount> | <deposit_per_guest> | <currency> |
    And the operation emits "urn:corpus:bookings:booking:event:booking_created":
      | event_id                             | reference | restaurant_id                        | state     | party_size   | local_date | local_time   | time_zone    | occurred_at          | guest_id                             |
      | 16fd2706-8baf-433b-82eb-8c7fed5c9b0e | NEWBK234  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | <party_size> | 2026-12-24 | <local_time> | Europe/Paris | 2026-11-22T10:00:00Z | a8098c1a-f86e-41da-bd5c-00c04fd430c8 |

    Examples:
      | local_time | starts_at            | party_size | contact                                                      | idempotency_key       | special_requests     | dietary_tags                                                                                                          | deposit_token | deposit_amount | deposit_per_guest | currency |
      | 19:30      | 2026-12-24T18:30:00Z | 1          | { name: A, email: ada@example.com }                          | 0123456789abcdef      |                      |                                                                                                                       |               |                |                   |          |
      | 00:00      | 2026-12-23T23:00:00Z | 6          | { name: =repeat(100, "a"), phone: "+123456789012345" }       | =repeat(64, "k")      | =repeat(500, "x")    | []                                                                                                                    |               |                |                   |          |
      | 23:15      | 2026-12-24T22:15:00Z | 7          | { name: Ada Lovelace, email: ada@example.com, phone: "+44" } | client-key-0000000007 | Window table, please | [vegetarian, vegan, gluten_free, nut_allergy, halal, kosher, dairy_free, shellfish_allergy, egg_allergy, soy_allergy] | tok_visa_4242 | 140.00         | 20.00             | EUR      |
      | 12:45      | 2026-12-24T11:45:00Z | 12         | { name: Ada Lovelace, phone: "+447911123456" }               | client-key-0000000012 |                      | [pescatarian]                                                                                                         | tok_visa_4242 | 240.00         | 20.00             | EUR      |

  Scenario Outline: A party size outside 1 to 20 is rejected
    Given the caller is:
      | role  |
      | guest |
    When I run the operation with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size   | contact                               | idempotency_key  |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | <party_size> | { name: Ada, email: ada@example.com } | 0123456789abcdef |
    Then the input is rejected on "party_size"

    Examples:
      | party_size |
      | 0          |
      | 21         |

  Scenario Outline: A party of 13 to 20 is refused online, to book by phone
    Given the caller is:
      | role  |
      | guest |
    When I run the operation with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size   | contact                               | idempotency_key  | deposit_token |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | <party_size> | { name: Ada, email: ada@example.com } | 0123456789abcdef | tok_visa_4242 |
    Then the operation fails with "urn:corpus:bookings:booking:error:party_too_large_for_online":
      | party_size   |
      | <party_size> |
    And the operation emits no event

    Examples:
      | party_size |
      | 13         |
      | 20         |

  Scenario: A party of 7 with no deposit token is refused
    Given the caller is:
      | role  |
      | guest |
    When I run the operation with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size | contact                               | idempotency_key  |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | 7          | { name: Ada, email: ada@example.com } | 0123456789abcdef |
    Then the operation fails with "urn:corpus:bookings:booking:error:deposit_required":
      | party_size |
      | 7          |
    And the operation emits no event

  Scenario: A declined deposit payment is refused
    Given the caller is:
      | role  |
      | guest |
    When I run the operation with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size | contact                               | idempotency_key  | deposit_token |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | 8          | { name: Ada, email: ada@example.com } | 0123456789abcdef | declined      |
    Then the operation fails with "urn:corpus:bookings:booking:error:payment_declined"
    And the operation emits no event

  Scenario: A repeat with the same key and request returns the first answer and books nothing more
    Given the caller is:
      | role  |
      | guest |
    And the time is "2026-11-22T10:00:00Z"
    When I run the operation with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size | contact                               | idempotency_key       | deposit_token |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | 8          | { name: Ada, email: ada@example.com } | client-key-0000000008 | tok_visa_4242 |
    And I run the operation again with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size | contact                               | idempotency_key       | deposit_token |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | 8          | { name: Ada, email: ada@example.com } | client-key-0000000008 | tok_visa_4242 |
    Then the answer is the first answer
    And the output is:
      | reference | restaurant_id                        | status    | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | deposit_per_guest | currency |
      | NEWBK234  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 8          | 120              | 160.00         | 20.00             | EUR      |
    And the operation emits no event

  Scenario: A repeat with the same key just before 24 hours still returns the first answer
    Given the caller is:
      | role  |
      | guest |
    And the time is "2026-11-22T10:00:00Z"
    When I run the operation with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size | contact                               | idempotency_key       | deposit_token |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | 8          | { name: Ada, email: ada@example.com } | client-key-0000000008 | tok_visa_4242 |
    And the time is "2026-11-23T09:59:59Z"
    And I run the operation again with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size | contact                               | idempotency_key       | deposit_token |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | 8          | { name: Ada, email: ada@example.com } | client-key-0000000008 | tok_visa_4242 |
    Then the answer is the first answer
    And the operation emits no event

  Scenario: After 24 hours the key is free, so the same request books again
    Given the caller is:
      | role  |
      | guest |
    And the time is "2026-11-22T10:00:00Z"
    When I run the operation with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size | contact                               | idempotency_key       | deposit_token |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | 8          | { name: Ada, email: ada@example.com } | client-key-0000000008 | tok_visa_4242 |
    And the time is "2026-11-23T10:00:00Z"
    And I run the operation again with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size | contact                               | idempotency_key       | deposit_token |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | 8          | { name: Ada, email: ada@example.com } | client-key-0000000008 | tok_visa_4242 |
    Then the operation emits "urn:corpus:bookings:booking:event:booking_created":
      | event_id                             | reference | restaurant_id                        | state     | party_size | local_date | local_time | time_zone    | occurred_at          | guest_id                             |
      | 16fd2706-8baf-433b-82eb-8c7fed5c9b0e | NEWBK234  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 8          | 2026-12-24 | 19:30      | Europe/Paris | 2026-11-23T10:00:00Z | a8098c1a-f86e-41da-bd5c-00c04fd430c8 |

  Scenario: An idempotency key used before with a different request is refused
    Given the caller is:
      | role  |
      | guest |
    And the time is "2026-11-22T10:00:00Z"
    When I run the operation with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size | contact                               | idempotency_key       | deposit_token |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | 8          | { name: Ada, email: ada@example.com } | client-key-0000000008 | tok_visa_4242 |
    And I run the operation again with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size | contact                               | idempotency_key       | deposit_token |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T19:00:00Z | 2026-12-24 | 20:00      | 8          | { name: Ada, email: ada@example.com } | client-key-0000000008 | tok_visa_4242 |
    Then the operation fails with "urn:corpus:bookings:booking:error:invalid_request":
      | idempotency_key       |
      | client-key-0000000008 |
    And the operation emits no event

  Scenario: A refusal is not kept, so a repeat of a refused request runs again
    Given the caller is:
      | role  |
      | guest |
    When I run the operation with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size | contact                               | idempotency_key       | deposit_token |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | 8          | { name: Ada, email: ada@example.com } | client-key-0000000008 | declined      |
    And I run the operation again with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size | contact                               | idempotency_key       | deposit_token |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | 8          | { name: Ada, email: ada@example.com } | client-key-0000000008 | tok_visa_4242 |
    Then the operation emits "urn:corpus:bookings:booking:event:booking_created":
      | event_id                             | reference | restaurant_id                        | state     | party_size | local_date | local_time | time_zone    | occurred_at          | guest_id                             |
      | 16fd2706-8baf-433b-82eb-8c7fed5c9b0e | NEWBK234  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 8          | 2026-12-24 | 19:30      | Europe/Paris | 2026-11-22T10:00:00Z | a8098c1a-f86e-41da-bd5c-00c04fd430c8 |

  # The window reads starts_at (UTC): 19:30 in Paris on 24 December is 18:30Z. From 90 days to 2 hours before
  # it, both edges included: 2026-09-25T18:30:00Z to 2026-12-24T16:30:00Z.
  Scenario Outline: A booking from 90 days to 2 hours before its start is made
    Given the caller is:
      | role  |
      | guest |
    And the time is "<now>"
    When I run the operation with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size | contact                               | idempotency_key  |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | 2          | { name: Ada, email: ada@example.com } | 0123456789abcdef |
    Then the output is:
      | reference | status    | starts_at            | local_date | local_time | time_zone    |
      | NEWBK234  | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris |

    Examples:
      | now                      |
      | 2026-09-25T18:30:00Z     |
      | 2026-09-25T18:30:00.001Z |
      | 2026-11-22T10:00:00Z     |
      | 2026-12-24T16:29:59.999Z |
      | 2026-12-24T16:30:00Z     |

  Scenario Outline: A booking more than 90 days or less than 2 hours before its start is refused
    Given the caller is:
      | role  |
      | guest |
    And the time is "<now>"
    When I run the operation with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size | contact                               | idempotency_key  |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | 2          | { name: Ada, email: ada@example.com } | 0123456789abcdef |
    Then the operation fails with "urn:corpus:bookings:booking:error:outside_booking_window":
      | starts_at            | local_date | local_time |
      | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      |
    And the operation emits no event

    Examples:
      | now                      |
      | 2026-09-25T18:29:59.999Z |
      | 2026-12-24T16:30:00.001Z |
      | 2026-12-24T18:30:00Z     |
      | 2026-12-25T10:00:00Z     |

  Scenario: A full time is refused, with up to 5 other start times on the same day for the same party, from exactly 2 hours before to exactly 2 hours after
    Given the caller is:
      | role  |
      | guest |
    When I run the operation with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size | contact                               | idempotency_key  |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T19:00:00Z | 2026-12-24 | 20:00      | 4          | { name: Ada, email: ada@example.com } | 0123456789abcdef |
    Then the operation fails with "urn:corpus:bookings:booking:error:no_availability":
      | local_date | local_time | time_zone    | party_size | alternatives |
      | 2026-12-24 | 20:00      | Europe/Paris | 4          | [{ starts_at: "2026-12-24T17:00:00Z", local_date: 2026-12-24, local_time: 18:00, party_size: 4 }, { starts_at: "2026-12-24T18:00:00Z", local_date: 2026-12-24, local_time: 19:00, party_size: 4 }, { starts_at: "2026-12-24T18:45:00Z", local_date: 2026-12-24, local_time: 19:45, party_size: 4 }, { starts_at: "2026-12-24T19:15:00Z", local_date: 2026-12-24, local_time: 20:15, party_size: 4 }, { starts_at: "2026-12-24T21:00:00Z", local_date: 2026-12-24, local_time: 22:00, party_size: 4 }] |
    And the operation emits no event

  Scenario: A full time late in the evening is offered only earlier start times on the same day
    Given the caller is:
      | role  |
      | guest |
    When I run the operation with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size | contact                               | idempotency_key  |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T22:45:00Z | 2026-12-24 | 23:45      | 2          | { name: Ada, email: ada@example.com } | 0123456789abcdef |
    Then the operation fails with "urn:corpus:bookings:booking:error:no_availability":
      | local_date | local_time | time_zone    | party_size | alternatives |
      | 2026-12-24 | 23:45      | Europe/Paris | 2          | [{ starts_at: "2026-12-24T20:45:00Z", local_date: 2026-12-24, local_time: 21:45, party_size: 2 }, { starts_at: "2026-12-24T21:45:00Z", local_date: 2026-12-24, local_time: 22:45, party_size: 2 }, { starts_at: "2026-12-24T22:30:00Z", local_date: 2026-12-24, local_time: 23:30, party_size: 2 }] |
    And the operation emits no event

  Scenario: A contact with neither an email address nor a phone number is rejected
    Given the caller is:
      | role  |
      | guest |
    When I run the operation with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size | contact       | idempotency_key  |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | 2          | { name: Ada } | 0123456789abcdef |
    Then the input is rejected by "urn:corpus:bookings:guest:invariant:email_or_phone"

  Scenario Outline: A contact with a name, an email address or a phone number that is not valid is rejected
    Given the caller is:
      | role  |
      | guest |
    When I run the operation with:
      | restaurant_id                        | starts_at            | local_date | local_time | party_size | contact   | idempotency_key  |
      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | 2          | <contact> | 0123456789abcdef |
    Then the input is rejected on "contact"

    Examples:
      | contact                                                 |
      | { name: "", email: ada@example.com }                    |
      | { name: =repeat(101, "a"), email: ada@example.com }     |
      | { name: Ada, email: not-an-email }                      |
      | { name: Ada, phone: "0044791112" }                      |
      | { name: Ada, phone: "+1234567890123456" }               |

  Scenario Outline: A request with a field that is not valid is rejected on that field
    Given the caller is:
      | role  |
      | guest |
    When I run the operation with:
      | restaurant_id   | starts_at   | local_date | local_time   | party_size | contact                               | idempotency_key   | special_requests   | dietary_tags   |
      | <restaurant_id> | <starts_at> | 2026-12-24 | <local_time> | 2          | { name: Ada, email: ada@example.com } | <idempotency_key> | <special_requests> | <dietary_tags> |
    Then the input is rejected on "<field>"

    Examples:
      | field            | restaurant_id                        | starts_at                 | local_time | idempotency_key  | special_requests  | dietary_tags                                                                                                                       |
      | restaurant_id    | restaurant-1                         | 2026-12-24T18:30:00Z      | 19:30      | 0123456789abcdef |                   |                                                                                                                                    |
      | local_time       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z      | 19:20      | 0123456789abcdef |                   |                                                                                                                                    |
      | idempotency_key  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z      | 19:30      | =repeat(15, "k") |                   |                                                                                                                                    |
      | idempotency_key  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z      | 19:30      | =repeat(65, "k") |                   |                                                                                                                                    |
      | special_requests | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z      | 19:30      | 0123456789abcdef | =repeat(501, "x") |                                                                                                                                    |
      | dietary_tags     | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z      | 19:30      | 0123456789abcdef |                   | [vegetarian, vegan, gluten_free, nut_allergy, halal, kosher, dairy_free, shellfish_allergy, egg_allergy, soy_allergy, pescatarian] |
      | dietary_tags     | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z      | 19:30      | 0123456789abcdef |                   | [vegan, vegan]                                                                                                                     |
      | dietary_tags     | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z      | 19:30      | 0123456789abcdef |                   | [paleo]                                                                                                                            |
      | starts_at        | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T19:30:00+01:00 | 19:30      | 0123456789abcdef |                   |                                                                                                                                    |
      | starts_at        | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24                | 19:30      | 0123456789abcdef |                   |                                                                                                                                    |

  Scenario Outline: A request that leaves out a required part is rejected on that part
    Given the caller is:
      | role  |
      | guest |
    When I run the operation with:
      | restaurant_id   | starts_at   | local_date   | local_time   | party_size   | contact   | idempotency_key   |
      | <restaurant_id> | <starts_at> | <local_date> | <local_time> | <party_size> | <contact> | <idempotency_key> |
    Then the input is rejected on "<field>"

    Examples:
      | field           | restaurant_id                        | starts_at            | local_date | local_time | party_size | contact                               | idempotency_key  |
      | restaurant_id   |                                      | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | 2          | { name: Ada, email: ada@example.com } | 0123456789abcdef |
      | local_date      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z |            | 19:30      | 2          | { name: Ada, email: ada@example.com } | 0123456789abcdef |
      | local_time      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 |            | 2          | { name: Ada, email: ada@example.com } | 0123456789abcdef |
      | party_size      | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      |            | { name: Ada, email: ada@example.com } | 0123456789abcdef |
      | contact         | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | 2          |                                       | 0123456789abcdef |
      | idempotency_key | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | 2          | { name: Ada, email: ada@example.com } |                  |
      | starts_at       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |                      | 2026-12-24 | 19:30      | 2          | { name: Ada, email: ada@example.com } | 0123456789abcdef |
