@urn-forge:strict
@urn:corpus:inventory:reservation:operation:release_reservation
Feature: Release a reservation

  Scenario Outline: A released reservation gives its stock back
    When I run the operation with:
      | idempotency_key   | reservation_id                       |
      | <idempotency_key> | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d |
    Then the output is:
      | reservation_id                       | state    |
      | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | RELEASED |
    And the operation emits "urn:corpus:inventory:reservation:event:reservation_released":
      | event_id                             | sequence | reservation_id                       | quantity_changed | level                                                                               | occurred_at              |
      | 7d3f1c2a-5b4e-4a6d-9c8b-1e2f3a4b5c6d | 1        | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | 10               | { sku: WIDGET-1, location: AMS-B-0142, on_hand: 500, reserved: 90, available: 410 } | 2026-11-22T10:00:00.000Z |

    Examples:
      | idempotency_key  |
      | rel-0001         |
      | =repeat(64, "x") |

  Scenario Outline: An idempotency key shorter than 8 or longer than 64 characters is rejected
    When I run the operation with:
      | idempotency_key   | reservation_id                       |
      | <idempotency_key> | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d |
    Then the input is rejected on "idempotency_key"

    Examples:
      | idempotency_key  |
      | rel-001          |
      | =repeat(65, "x") |

  Scenario: A reservation id that is not a UUID is rejected
    When I run the operation with:
      | idempotency_key | reservation_id |
      | rel-0002        | RES-1          |
    Then the input is rejected on "reservation_id"

  Scenario: An unknown reservation is refused
    When I run the operation with:
      | idempotency_key | reservation_id                       |
      | rel-0003        | 00000000-0000-4000-8000-000000000000 |
    Then the operation fails with "urn:corpus:inventory:reservation:error:reservation_not_found":
      | reservation_id                       |
      | 00000000-0000-4000-8000-000000000000 |
    And the operation emits no event

  Scenario: A shipped reservation cannot be released
    When I run the operation with:
      | idempotency_key | reservation_id                       |
      | rel-0004        | 11111111-1111-4111-8111-111111111111 |
    Then the operation fails with "urn:corpus:inventory:reservation:error:invalid_state":
      | reservation_id                       | state   |
      | 11111111-1111-4111-8111-111111111111 | SHIPPED |
    And the operation emits no event

  Scenario: An idempotency key used before with a different body is refused
    When I run the operation with:
      | idempotency_key | reservation_id                       |
      | conflict-key    | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d |
    Then the operation fails with "urn:corpus:inventory:request:error:idempotency_conflict":
      | idempotency_key |
      | conflict-key    |
