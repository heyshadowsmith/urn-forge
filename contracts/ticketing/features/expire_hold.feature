@urn-forge:strict
@urn:corpus:ticketing:hold:operation:expire_hold
Feature: Expire a hold after its expiry time

  The shell's clock calls expire_hold for each ACTIVE hold after its expiry time, which
  selectHoldExpireHoldDue finds. At the expiry time itself the hold can still be checked out,
  so it is not due yet.

  Scenario: An ACTIVE hold a millisecond after its expiry time expires and HoldExpired is published
    Given the time is "2026-12-01T19:10:00.001Z"
    And the current hold is:
      | hold_id                              | event_id                             | hold_status | lines                                                                                       | total                                 | created_at           | expires_at           |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | ACTIVE      | [{ place_kind: seated, section: A1, row: C, seat_number: 12, price: { amount_minor: 5000, currency: EUR } }] | { amount_minor: 5000, currency: EUR } | 2026-12-01T19:00:00Z | 2026-12-01T19:10:00Z |
    When I run the operation with:
      | hold_id                              |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b |
    Then the output is:
      | hold_id                              | hold_status |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | EXPIRED     |
    And the operation emits "urn:corpus:ticketing:hold:event:hold_expired":
      | message_id                           | event_id                             | hold_id                              | occurred_at              |
      | 00000000-0000-4000-8000-000000000001 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | 2026-12-01T19:10:00.001Z |

  Scenario: A hold whose clock ran late expires at the time of the call
    Given the time is "2026-12-02T08:00:00Z"
    And the current hold is:
      | hold_id                              | event_id                             | hold_status | lines                                                                                       | total                                 | created_at           | expires_at           |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | ACTIVE      | [{ place_kind: standing, section: FLOOR, quantity: 2, price: { amount_minor: 6000, currency: EUR } }] | { amount_minor: 6000, currency: EUR } | 2026-12-01T19:00:00Z | 2026-12-01T19:10:00Z |
    When I run the operation with:
      | hold_id                              |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b |
    Then the output is:
      | hold_status |
      | EXPIRED     |
    And the operation emits "urn:corpus:ticketing:hold:event:hold_expired":
      | message_id                           | event_id                             | hold_id                              | occurred_at          |
      | 00000000-0000-4000-8000-000000000001 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | 2026-12-02T08:00:00Z |

  Scenario Outline: A hold at or before its expiry time is not due
    Given the time is "<now>"
    And the current hold is:
      | hold_id                              | event_id                             | hold_status | lines                                                                                       | total                                 | created_at           | expires_at           |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | ACTIVE      | [{ place_kind: seated, section: A1, row: C, seat_number: 12, price: { amount_minor: 5000, currency: EUR } }] | { amount_minor: 5000, currency: EUR } | 2026-12-01T19:00:00Z | 2026-12-01T19:10:00Z |
    When I run the operation with:
      | hold_id                              |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b |
    Then the operation is not due

    Examples:
      | now                      |
      | 2026-12-01T19:10:00Z     |
      | 2026-12-01T19:09:59.999Z |
      | 2026-12-01T19:00:00Z     |

  Scenario Outline: A hold that left ACTIVE first is not expired again
    Given the time is "2026-12-01T19:30:00Z"
    And the current hold is:
      | hold_id                              | event_id                             | hold_status   | lines                                                                                       | total                                 | created_at           | expires_at           |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | <hold_status> | [{ place_kind: seated, section: A1, row: C, seat_number: 12, price: { amount_minor: 5000, currency: EUR } }] | { amount_minor: 5000, currency: EUR } | 2026-12-01T19:00:00Z | 2026-12-01T19:10:00Z |
    When I run the operation with:
      | hold_id                              |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b |
    Then the operation fails with "urn:corpus:ticketing:hold:error:hold_not_active":
      | hold_id                              | hold_status   |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | <hold_status> |
    And the operation emits no event

    Examples:
      | hold_status |
      | CONVERTED   |
      | RELEASED    |
      | EXPIRED     |

  Scenario: A hold that no longer exists cannot be expired
    Given the time is "2026-12-01T19:30:00Z"
    And there is no current hold
    When I run the operation with:
      | hold_id                              |
      | 00000000-0000-4000-8000-000000000404 |
    Then the operation fails with "urn:corpus:ticketing:hold:error:hold_not_found":
      | hold_id                              |
      | 00000000-0000-4000-8000-000000000404 |
    And the operation emits no event

  Scenario: A hold identifier that is not a UUID is rejected at the boundary
    Given the time is "2026-12-01T19:30:00Z"
    And there is no current hold
    When I run the operation with:
      | hold_id |
      | hold-1  |
    Then the input is rejected on "hold_id"
