@urn-forge:strict
@urn:corpus:ticketing:hold:operation:create_hold
Feature: Hold seats and standing places during checkout

  Scenario: A hold of one seat and two standing places gives the price of each line, the total and the expiry
    Given the time is "2026-12-01T19:00:00Z"
    When I run the operation with:
      | idempotency_key | event_id                             | lines                                                                                                                   |
      | hold-key-0001   | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: seated, section: A1, row: C, seat_number: 12 }, { place_kind: standing, section: FLOOR, quantity: 2 }] |
    Then the output is:
      | hold_id                              | hold_status | lines                                                                                                                                                                                                     | total                                  | created_at           | expires_at           |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | ACTIVE      | [{ place_kind: seated, section: A1, row: C, seat_number: 12, price: { amount_minor: 5000, currency: EUR } }, { place_kind: standing, section: FLOOR, quantity: 2, price: { amount_minor: 6000, currency: EUR } }] | { amount_minor: 11000, currency: EUR } | 2026-12-01T19:00:00Z | 2026-12-01T19:10:00Z |
    And the operation emits "urn:corpus:ticketing:hold:event:hold_created":
      | message_id                           | event_id                             | hold_id                              | occurred_at          |
      | 00000000-0000-4000-8000-000000000001 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | 2026-12-01T19:00:00Z |

  Scenario Outline: The hold is created at the time of the call and expires exactly 10 minutes later
    Given the time is "<now>"
    When I run the operation with:
      | idempotency_key | event_id                             | lines                                                          |
      | hold-key-0001   | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: seated, section: A1, row: C, seat_number: 12 }] |
    Then the output is:
      | hold_id                              | created_at | expires_at   |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | <now>      | <expires_at> |
    And the operation emits "urn:corpus:ticketing:hold:event:hold_created":
      | message_id                           | event_id                             | hold_id                              | occurred_at |
      | 00000000-0000-4000-8000-000000000001 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | <now>       |

    Examples:
      | now                      | expires_at               |
      | 2026-12-01T19:55:00Z     | 2026-12-01T20:05:00Z     |
      | 2026-12-31T23:54:59.999Z | 2027-01-01T00:04:59.999Z |

  Scenario Outline: Values at the edges of their limits are accepted
    Given the time is "2026-12-01T19:00:00Z"
    When I run the operation with:
      | idempotency_key   | event_id                             | lines   |
      | <idempotency_key> | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | <lines> |
    Then the output is:
      | hold_status |
      | ACTIVE      |

    Examples:
      | idempotency_key  | lines                                                                         |
      | =repeat(8, "k")  | [{ place_kind: seated, section: A, row: A, seat_number: 1 }]                  |
      | =repeat(64, "k") | [{ place_kind: seated, section: ZZ9999, row: ZZ, seat_number: 150 }]          |
      | hold-key-0002    | [{ place_kind: standing, section: FLOOR, quantity: 1 }]                       |
      | hold-key-0003    | [{ place_kind: standing, section: FLOOR, quantity: 10 }]                      |
      | hold-key-0004    | =repeat(10, { place_kind: standing, section: FLOOR, quantity: 1 })            |
      | hold-key-0005    | [{ place_kind: seated, section: A1, row: C, seat_number: 12 }, { place_kind: seated, section: A1, row: D, seat_number: 12 }] |

  Scenario Outline: A request outside the limits of a field is rejected at the boundary
    Given the time is "2026-12-01T19:00:00Z"
    When I run the operation with:
      | idempotency_key   | event_id   | lines   |
      | <idempotency_key> | <event_id> | <lines> |
    Then the input is rejected on "<field>"

    Examples:
      | field           | idempotency_key  | event_id                             | lines                                                                    |
      | idempotency_key | =repeat(7, "k")  | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: seated, section: A1, row: C, seat_number: 12 }]           |
      | idempotency_key | =repeat(65, "k") | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: seated, section: A1, row: C, seat_number: 12 }]           |
      | event_id        | hold-key-0001    | concert-1                            | [{ place_kind: seated, section: A1, row: C, seat_number: 12 }]           |
      | lines           | hold-key-0001    | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | []                                                                       |
      | lines           | hold-key-0001    | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | =repeat(11, { place_kind: standing, section: FLOOR, quantity: 1 })       |
      | lines           | hold-key-0001    | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: boxed, section: A1, row: C, seat_number: 12 }]            |
      | lines           | hold-key-0001    | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: seated, section: a1, row: C, seat_number: 12 }]           |
      | lines           | hold-key-0001    | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: seated, section: A1, row: C3, seat_number: 12 }]          |
      | lines           | hold-key-0001    | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: seated, section: A1, row: C, seat_number: 0 }]            |
      | lines           | hold-key-0001    | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: seated, section: A1, row: C, seat_number: 151 }]          |
      | lines           | hold-key-0001    | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: standing, section: FLOOR, quantity: 0 }]                  |
      | lines           | hold-key-0001    | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: standing, section: FLOOR, quantity: 11 }]                 |
      | lines           | hold-key-0001    | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: seated, section: A1, row: C, seat_number: 12 }, { place_kind: seated, section: A1, row: C, seat_number: 12 }] |

  Scenario Outline: A seated line that does not name exactly one seat is rejected
    Given the time is "2026-12-01T19:00:00Z"
    When I run the operation with:
      | idempotency_key | event_id                             | lines   |
      | hold-key-0001   | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | <lines> |
    Then the input is rejected by "urn:corpus:ticketing:hold:invariant:seated_line_names_one_seat"

    Examples:
      | lines                                                                     |
      | [{ place_kind: seated, section: A1, row: C }]                             |
      | [{ place_kind: seated, section: A1, seat_number: 12 }]                    |
      | [{ place_kind: seated, section: A1, row: C, seat_number: 12, quantity: 2 }] |

  Scenario Outline: A standing line with a row or a seat number, or without a quantity, is rejected
    Given the time is "2026-12-01T19:00:00Z"
    When I run the operation with:
      | idempotency_key | event_id                             | lines   |
      | hold-key-0001   | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | <lines> |
    Then the input is rejected by "urn:corpus:ticketing:hold:invariant:standing_line_names_quantity"

    Examples:
      | lines                                                                  |
      | [{ place_kind: standing, section: FLOOR }]                             |
      | [{ place_kind: standing, section: FLOOR, quantity: 2, row: C }]        |
      | [{ place_kind: standing, section: FLOOR, quantity: 2, seat_number: 4 }] |

  Scenario: Seats that cannot be held are all listed, and nothing is held
    Given the time is "2026-12-01T19:00:00Z"
    When I run the operation with:
      | idempotency_key | event_id                             | lines                                                                                                                                                    |
      | hold-key-0001   | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: seated, section: A1, row: Q, seat_number: 3 }, { place_kind: seated, section: A1, row: C, seat_number: 12 }, { place_kind: seated, section: B, row: Q, seat_number: 4 }] |
    Then the operation fails with "urn:corpus:ticketing:hold:error:seat_unavailable":
      | seats                                                                              |
      | [{ section: A1, row: Q, seat_number: 3 }, { section: B, row: Q, seat_number: 4 }] |
    And the operation emits no event

  Scenario: A standing section without enough capacity is named, and nothing is held
    Given the time is "2026-12-01T19:00:00Z"
    When I run the operation with:
      | idempotency_key | event_id                             | lines                                                  |
      | hold-key-0001   | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: standing, section: SOLD, quantity: 2 }] |
    Then the operation fails with "urn:corpus:ticketing:hold:error:section_sold_out":
      | section |
      | SOLD    |
    And the operation emits no event

  Scenario: More than 10 tickets in one hold is refused
    Given the time is "2026-12-01T19:00:00Z"
    When I run the operation with:
      | idempotency_key | event_id                             | lines                                                                                                          |
      | hold-key-0001   | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: standing, section: FLOOR, quantity: 6 }, { place_kind: standing, section: FLOOR, quantity: 5 }] |
    Then the operation fails with "urn:corpus:ticketing:hold:error:limit_exceeded"
    And the operation emits no event

  Scenario: An event that is not on sale is refused
    Given the time is "2026-12-01T19:00:00Z"
    When I run the operation with:
      | idempotency_key | event_id                             | lines                                                          |
      | hold-key-0001   | 00000000-0000-4000-8000-0000000000c1 | [{ place_kind: seated, section: A1, row: C, seat_number: 12 }] |
    Then the operation fails with "urn:corpus:ticketing:hold:error:sales_closed":
      | event_id                             |
      | 00000000-0000-4000-8000-0000000000c1 |
    And the operation emits no event

  Scenario: A repeat with the same key within 24 hours returns the first hold and holds nothing more
    Given the time is "2026-12-01T19:00:00Z"
    When I run the operation with:
      | idempotency_key | event_id                             | lines                                                          |
      | hold-key-0001   | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: seated, section: A1, row: C, seat_number: 12 }] |
    Then the operation emits "urn:corpus:ticketing:hold:event:hold_created"
    Given the time is "2026-12-02T18:59:59.999Z"
    When I run the operation again with:
      | idempotency_key | event_id                             | lines                                                          |
      | hold-key-0001   | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: seated, section: A1, row: C, seat_number: 12 }] |
    Then the answer is the first answer
    And the operation emits no event

  Scenario: A repeat with the same key and another body still returns the first hold
    Given the time is "2026-12-01T19:00:00Z"
    When I run the operation with:
      | idempotency_key | event_id                             | lines                                                          |
      | hold-key-0001   | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: seated, section: A1, row: C, seat_number: 12 }] |
    And I run the operation again with:
      | idempotency_key | event_id                             | lines                                              |
      | hold-key-0001   | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: standing, section: FLOOR, quantity: 2 }] |
    Then the answer is the first answer
    And the operation emits no event

  Scenario: 24 hours after the first call the key is free, and the repeat holds again
    Given the time is "2026-12-01T19:00:00Z"
    When I run the operation with:
      | idempotency_key | event_id                             | lines                                                          |
      | hold-key-0001   | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: seated, section: A1, row: C, seat_number: 12 }] |
    Given the time is "2026-12-02T19:00:00Z"
    When I run the operation again with:
      | idempotency_key | event_id                             | lines                                                          |
      | hold-key-0001   | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | [{ place_kind: seated, section: A1, row: C, seat_number: 12 }] |
    Then the output is:
      | created_at           | expires_at           |
      | 2026-12-02T19:00:00Z | 2026-12-02T19:10:00Z |
    And the operation emits "urn:corpus:ticketing:hold:event:hold_created"
