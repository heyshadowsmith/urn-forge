@urn-forge:strict
@urn:corpus:ticketing:refund:operation:request_refund
Feature: Refund tickets

  Scenario Outline: Refunded tickets are listed with the amount
    Given the time is "2026-12-01T19:00:00Z"
    And the current order is:
      | order_id                             | event_id                             | starts_at            | tickets                                                                                                                                                                                                                                                                                                                                                                                                                       | fees                                 | total                                 |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | 2026-12-12T20:00:00Z | [{ ticket_code: ABCDEFGH23456789, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: seated, section: A1, row: C, seat_number: 12, ticket_status: ISSUED, price: { amount_minor: 5000, currency: EUR }, starts_at: 2026-12-12T20:00:00Z }, { ticket_code: ZYXWVUTS98765432, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: standing, section: FLOOR, ticket_status: ISSUED, price: { amount_minor: 3000, currency: EUR }, starts_at: 2026-12-12T20:00:00Z }] | { amount_minor: 500, currency: EUR } | { amount_minor: 8500, currency: EUR } |
    When I run the operation with:
      | idempotency_key   | order_id                             | ticket_codes   |
      | <idempotency_key> | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | <ticket_codes> |
    Then the output is:
      | order_id                             | ticket_codes   | amount   |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | <ticket_codes> | <amount> |
    And the operation emits "urn:corpus:ticketing:ticket:event:ticket_refunded":
      | event_id                             | ticket_code      |
      | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | ABCDEFGH23456789 |

    Examples:
      | idempotency_key  | ticket_codes                         | amount                                 |
      | =repeat(8, "k")  | [ABCDEFGH23456789]                   | { amount_minor: 5000, currency: EUR }  |
      | =repeat(64, "k") | [ABCDEFGH23456789, ZYXWVUTS98765432] | { amount_minor: 10000, currency: EUR } |

  Scenario: A refund is in the currency of its order
    Given the time is "2026-12-01T19:00:00Z"
    And the current order is:
      | order_id                             | event_id                             | starts_at            | tickets                                                                                                                                                                                                                                                                                                                                                                                                                       | fees                                 | total                                 |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | 2026-12-12T20:00:00Z | [{ ticket_code: ABCDEFGH23456789, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: seated, section: A1, row: C, seat_number: 12, ticket_status: ISSUED, price: { amount_minor: 5000, currency: GBP }, starts_at: 2026-12-12T20:00:00Z }, { ticket_code: ZYXWVUTS98765432, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: standing, section: FLOOR, ticket_status: ISSUED, price: { amount_minor: 3000, currency: GBP }, starts_at: 2026-12-12T20:00:00Z }] | { amount_minor: 500, currency: GBP } | { amount_minor: 8500, currency: GBP } |
    When I run the operation with:
      | idempotency_key | order_id                             | ticket_codes       |
      | refund-gbp-0001 | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789] |
    Then the output is:
      | order_id                             | ticket_codes       | amount                                |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789] | { amount_minor: 5000, currency: GBP } |

  Scenario Outline: A request outside the limits of a field is rejected at the boundary
    Given the time is "2026-12-01T19:00:00Z"
    And the current order is:
      | order_id                             | event_id                             | starts_at            | tickets                                                                                                                                                                                                                                                                                                                                                                                                                       | fees                                 | total                                 |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | 2026-12-12T20:00:00Z | [{ ticket_code: ABCDEFGH23456789, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: seated, section: A1, row: C, seat_number: 12, ticket_status: ISSUED, price: { amount_minor: 5000, currency: EUR }, starts_at: 2026-12-12T20:00:00Z }, { ticket_code: ZYXWVUTS98765432, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: standing, section: FLOOR, ticket_status: ISSUED, price: { amount_minor: 3000, currency: EUR }, starts_at: 2026-12-12T20:00:00Z }] | { amount_minor: 500, currency: EUR } | { amount_minor: 8500, currency: EUR } |
    When I run the operation with:
      | idempotency_key   | order_id   | ticket_codes   |
      | <idempotency_key> | <order_id> | <ticket_codes> |
    Then the input is rejected on "<field>"

    Examples:
      | field           | idempotency_key  | order_id                             | ticket_codes                         |
      | idempotency_key | =repeat(7, "k")  | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789]                   |
      | idempotency_key | =repeat(65, "k") | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789]                   |
      | order_id        | refund-0001      | order-1                              | [ABCDEFGH23456789]                   |
      | ticket_codes    | refund-0001      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | []                                   |
      | ticket_codes    | refund-0001      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789, ABCDEFGH23456789] |
      | ticket_codes    | refund-0001      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH2345678O]                   |

  Scenario: A used ticket cannot be refunded
    Given the time is "2026-12-01T19:00:00Z"
    And the current order is:
      | order_id                             | event_id                             | starts_at            | tickets                                                                                                                                                                                                                                                                                                                                                                                                                       | fees                                 | total                                 |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | 2026-12-12T20:00:00Z | [{ ticket_code: ABCDEFGH23456789, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: seated, section: A1, row: C, seat_number: 12, ticket_status: ISSUED, price: { amount_minor: 5000, currency: EUR }, starts_at: 2026-12-12T20:00:00Z }, { ticket_code: ZYXWVUTS98765432, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: standing, section: FLOOR, ticket_status: ISSUED, price: { amount_minor: 3000, currency: EUR }, starts_at: 2026-12-12T20:00:00Z }] | { amount_minor: 500, currency: EUR } | { amount_minor: 8500, currency: EUR } |
    When I run the operation with:
      | idempotency_key | order_id                             | ticket_codes                         |
      | refund-0001     | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789, USEDUSEDUSEDUSED] |
    Then the operation fails with "urn:corpus:ticketing:refund:error:ticket_not_refundable":
      | ticket_code      |
      | USEDUSEDUSEDUSED |
    And the operation emits no event

  Scenario: A refund weeks before the start of the event is accepted
    Given the time is "2026-11-22T18:00:00Z"
    And the current order is:
      | order_id                             | event_id                             | starts_at            | tickets                                                                                                                                                                                                                                                                                                                                                                                                                       | fees                                 | total                                 |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | 2026-12-12T20:00:00Z | [{ ticket_code: ABCDEFGH23456789, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: seated, section: A1, row: C, seat_number: 12, ticket_status: ISSUED, price: { amount_minor: 5000, currency: EUR }, starts_at: 2026-12-12T20:00:00Z }, { ticket_code: ZYXWVUTS98765432, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: standing, section: FLOOR, ticket_status: ISSUED, price: { amount_minor: 3000, currency: EUR }, starts_at: 2026-12-12T20:00:00Z }] | { amount_minor: 500, currency: EUR } | { amount_minor: 8500, currency: EUR } |
    When I run the operation with:
      | idempotency_key | order_id                             | ticket_codes       |
      | refund-0001     | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789] |
    Then the output is:
      | order_id                             | ticket_codes       |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789] |

  Scenario: A refund a millisecond before 48 hours before the start of the event is accepted
    Given the time is "2026-12-10T19:59:59.999Z"
    And the current order is:
      | order_id                             | event_id                             | starts_at            | tickets                                                                                                                                                                                                                                                                                                                                                                                                                       | fees                                 | total                                 |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | 2026-12-12T20:00:00Z | [{ ticket_code: ABCDEFGH23456789, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: seated, section: A1, row: C, seat_number: 12, ticket_status: ISSUED, price: { amount_minor: 5000, currency: EUR }, starts_at: 2026-12-12T20:00:00Z }, { ticket_code: ZYXWVUTS98765432, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: standing, section: FLOOR, ticket_status: ISSUED, price: { amount_minor: 3000, currency: EUR }, starts_at: 2026-12-12T20:00:00Z }] | { amount_minor: 500, currency: EUR } | { amount_minor: 8500, currency: EUR } |
    When I run the operation with:
      | idempotency_key | order_id                             | ticket_codes       |
      | refund-0001     | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789] |
    Then the output is:
      | order_id                             | ticket_codes       |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789] |

  Scenario: A refund at 48 hours before the start of the event is refused
    Given the time is "2026-12-10T20:00:00Z"
    And the current order is:
      | order_id                             | event_id                             | starts_at            | tickets                                                                                                                                                                                                                                                                                                                                                                                                                       | fees                                 | total                                 |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | 2026-12-12T20:00:00Z | [{ ticket_code: ABCDEFGH23456789, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: seated, section: A1, row: C, seat_number: 12, ticket_status: ISSUED, price: { amount_minor: 5000, currency: EUR }, starts_at: 2026-12-12T20:00:00Z }, { ticket_code: ZYXWVUTS98765432, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: standing, section: FLOOR, ticket_status: ISSUED, price: { amount_minor: 3000, currency: EUR }, starts_at: 2026-12-12T20:00:00Z }] | { amount_minor: 500, currency: EUR } | { amount_minor: 8500, currency: EUR } |
    When I run the operation with:
      | idempotency_key | order_id                             | ticket_codes       |
      | refund-0001     | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789] |
    Then the operation fails with "urn:corpus:ticketing:refund:error:refund_window_closed":
      | order_id                             | starts_at            |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | 2026-12-12T20:00:00Z |
    And the operation emits no event

  Scenario: A refund after the start of the event is refused
    Given the time is "2026-12-12T21:00:00Z"
    And the current order is:
      | order_id                             | event_id                             | starts_at            | tickets                                                                                                                                                                                                                                                                                                                                                                                                                       | fees                                 | total                                 |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | 2026-12-12T20:00:00Z | [{ ticket_code: ABCDEFGH23456789, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: seated, section: A1, row: C, seat_number: 12, ticket_status: ISSUED, price: { amount_minor: 5000, currency: EUR }, starts_at: 2026-12-12T20:00:00Z }, { ticket_code: ZYXWVUTS98765432, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: standing, section: FLOOR, ticket_status: ISSUED, price: { amount_minor: 3000, currency: EUR }, starts_at: 2026-12-12T20:00:00Z }] | { amount_minor: 500, currency: EUR } | { amount_minor: 8500, currency: EUR } |
    When I run the operation with:
      | idempotency_key | order_id                             | ticket_codes       |
      | refund-0001     | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789] |
    Then the operation fails with "urn:corpus:ticketing:refund:error:refund_window_closed":
      | order_id                             | starts_at            |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | 2026-12-12T20:00:00Z |
    And the operation emits no event

  Scenario: An unknown order is refused
    Given the time is "2026-12-01T19:00:00Z"
    And there is no current order
    When I run the operation with:
      | idempotency_key | order_id                             | ticket_codes       |
      | refund-0001     | 00000000-0000-4000-8000-000000000404 | [ABCDEFGH23456789] |
    Then the operation fails with "urn:corpus:ticketing:order:error:order_not_found":
      | order_id                             |
      | 00000000-0000-4000-8000-000000000404 |
    And the operation emits no event

  Scenario: A repeat of a refund with the same key within 24 hours returns the first refund and refunds nothing more
    Given the time is "2026-11-22T18:00:00Z"
    And the current order is:
      | order_id                             | event_id                             | starts_at            | tickets                                                                                                                                                                                                                                                                                                                                                                                                                       | fees                                 | total                                 |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | 2026-12-12T20:00:00Z | [{ ticket_code: ABCDEFGH23456789, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: seated, section: A1, row: C, seat_number: 12, ticket_status: ISSUED, price: { amount_minor: 5000, currency: EUR }, starts_at: 2026-12-12T20:00:00Z }, { ticket_code: ZYXWVUTS98765432, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: standing, section: FLOOR, ticket_status: ISSUED, price: { amount_minor: 3000, currency: EUR }, starts_at: 2026-12-12T20:00:00Z }] | { amount_minor: 500, currency: EUR } | { amount_minor: 8500, currency: EUR } |
    When I run the operation with:
      | idempotency_key | order_id                             | ticket_codes       |
      | refund-0001     | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789] |
    Then the operation emits "urn:corpus:ticketing:ticket:event:ticket_refunded"
    Given the time is "2026-11-23T17:59:59.999Z"
    When I run the operation again with:
      | idempotency_key | order_id                             | ticket_codes                         |
      | refund-0001     | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789, ZYXWVUTS98765432] |
    Then the answer is the first answer
    And the operation emits no event

  Scenario: 24 hours after the first refund the key is free, and the repeat runs again
    Given the time is "2026-11-22T18:00:00Z"
    And the current order is:
      | order_id                             | event_id                             | starts_at            | tickets                                                                                                                                                                                                                                                                                                                                                                                                                       | fees                                 | total                                 |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | 2026-12-12T20:00:00Z | [{ ticket_code: ABCDEFGH23456789, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: seated, section: A1, row: C, seat_number: 12, ticket_status: ISSUED, price: { amount_minor: 5000, currency: EUR }, starts_at: 2026-12-12T20:00:00Z }, { ticket_code: ZYXWVUTS98765432, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: standing, section: FLOOR, ticket_status: ISSUED, price: { amount_minor: 3000, currency: EUR }, starts_at: 2026-12-12T20:00:00Z }] | { amount_minor: 500, currency: EUR } | { amount_minor: 8500, currency: EUR } |
    When I run the operation with:
      | idempotency_key | order_id                             | ticket_codes       |
      | refund-0001     | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789] |
    Given the time is "2026-11-23T18:00:00Z"
    When I run the operation again with:
      | idempotency_key | order_id                             | ticket_codes       |
      | refund-0001     | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789] |
    Then the operation emits "urn:corpus:ticketing:ticket:event:ticket_refunded"
