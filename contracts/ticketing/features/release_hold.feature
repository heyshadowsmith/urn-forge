@urn-forge:strict
@urn:corpus:ticketing:hold:operation:release_hold
Feature: Release a hold

  Scenario: A released hold leaves ACTIVE
    Given the current hold is:
      | hold_id                              | event_id                             | hold_status | lines                                                                                                                                                                                                             | total                                 | created_at           | expires_at           |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | ACTIVE      | [{ place_kind: seated, section: A1, row: C, seat_number: 12, price: { amount_minor: 5000, currency: EUR } }, { place_kind: standing, section: FLOOR, quantity: 1, price: { amount_minor: 3000, currency: EUR } }] | { amount_minor: 8000, currency: EUR } | 2026-12-01T18:58:00Z | 2026-12-01T19:08:00Z |
    When I run the operation with:
      | hold_id                              |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b |
    Then the output is:
      | hold_id                              | hold_status |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | RELEASED    |

  Scenario Outline: A hold that is no longer ACTIVE cannot be released
    Given the current hold is:
      | hold_id                              | event_id                             | hold_status | lines                                                                                                                                                                                                             | total                                 | created_at           | expires_at           |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | <hold_status>     | [{ place_kind: seated, section: A1, row: C, seat_number: 12, price: { amount_minor: 5000, currency: EUR } }, { place_kind: standing, section: FLOOR, quantity: 1, price: { amount_minor: 3000, currency: EUR } }] | { amount_minor: 8000, currency: EUR } | 2026-12-01T18:50:00Z | 2026-12-01T19:00:00Z |
    When I run the operation with:
      | hold_id                              |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b |
    Then the operation fails with "urn:corpus:ticketing:hold:error:hold_not_active":
      | hold_id                              | hold_status |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | <hold_status>     |

    Examples:
      | hold_status |
      | CONVERTED |
      | RELEASED  |
      | EXPIRED   |

  Scenario: A hold identifier that is not a UUID is rejected at the boundary
    Given the current hold is:
      | hold_id                              | event_id                             | hold_status | lines                                                                                                                                                                                                             | total                                 | created_at           | expires_at           |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | ACTIVE      | [{ place_kind: seated, section: A1, row: C, seat_number: 12, price: { amount_minor: 5000, currency: EUR } }, { place_kind: standing, section: FLOOR, quantity: 1, price: { amount_minor: 3000, currency: EUR } }] | { amount_minor: 8000, currency: EUR } | 2026-12-01T18:58:00Z | 2026-12-01T19:08:00Z |
    When I run the operation with:
      | hold_id |
      | hold-1  |
    Then the input is rejected on "hold_id"

  Scenario: An unknown hold is refused
    Given there is no current hold
    When I run the operation with:
      | hold_id                              |
      | 00000000-0000-4000-8000-000000000404 |
    Then the operation fails with "urn:corpus:ticketing:hold:error:hold_not_found":
      | hold_id                              |
      | 00000000-0000-4000-8000-000000000404 |
