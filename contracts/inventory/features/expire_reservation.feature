@urn-forge:strict
@urn:corpus:inventory:reservation:operation:expire_reservation
Feature: Expire a reservation whose expiry time has come

  # The shell's clock calls this for each active reservation whose expiry time has come; the
  # scenarios below run as the clock. The reservation was made at 10:00 with no time-to-live, so
  # it expires at 10:30.
  Background:
    Given the caller is:
      | role  |
      | clock |

  Scenario Outline: An active reservation expires at its expiry time or later, and each line gives its stock back
    Given the time is "<time>"
    And the current reservation is:
      | result   | reservation_id                       | order_id | state  | lines                                                                                                          | expires_at               |
      | RESERVED | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | ORD-1    | ACTIVE | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 10 }, { sku: GADGET-2, location: ROT-A-0001, quantity: 3 }] | 2026-11-22T10:30:00.000Z |
    When I run the operation with:
      | idempotency_key   | reservation_id                       |
      | <idempotency_key> | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d |
    Then the output is:
      | reservation_id                       | state   |
      | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | EXPIRED |
    And the operation emits "urn:corpus:inventory:reservation:event:reservation_expired":
      | event_id                             | reservation_id                       | sku      | location   | quantity_changed | level                                                                               |
      | 7d3f1c2a-5b4e-4a6d-9c8b-000000000001 | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | WIDGET-1 | AMS-B-0142 | 10               | { sku: WIDGET-1, location: AMS-B-0142, on_hand: 500, reserved: 90, available: 410 } |
    And the operation emits "urn:corpus:inventory:reservation:event:reservation_expired":
      | event_id                             | reservation_id                       | sku      | location   | quantity_changed | level                                                                               |
      | 7d3f1c2a-5b4e-4a6d-9c8b-000000000002 | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | GADGET-2 | ROT-A-0001 | 3                | { sku: GADGET-2, location: ROT-A-0001, on_hand: 500, reserved: 97, available: 403 } |

    Examples:
      | time                     | idempotency_key  |
      | 2026-11-22T10:30:00.000Z | exp-0001         |
      | 2026-11-29T10:00:00.000Z | =repeat(64, "e") |

  Scenario Outline: An active reservation before its expiry time is not due
    Given the time is "<time>"
    And the current reservation is:
      | result   | reservation_id                       | order_id | state  | lines                                                   | expires_at               |
      | RESERVED | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | ORD-1    | ACTIVE | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 10 }] | 2026-11-22T10:30:00.000Z |
    When I run the operation with:
      | idempotency_key | reservation_id                       |
      | exp-0002        | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d |
    Then the operation is not due

    Examples:
      | time                     |
      | 2026-11-22T10:29:59.999Z |
      | 2026-11-22T10:00:00.000Z |

  Scenario Outline: A partly shipped, shipped, released or expired reservation does not expire
    Given the time is "2026-11-22T11:00:00.000Z"
    And the current reservation is:
      | result   | reservation_id                       | order_id | state   | lines                                                   | expires_at               |
      | RESERVED | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | ORD-1    | <state> | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 10 }] | 2026-11-22T10:30:00.000Z |
    When I run the operation with:
      | idempotency_key | reservation_id                       |
      | exp-0003        | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d |
    Then the operation fails with "urn:corpus:inventory:reservation:error:invalid_state":
      | reservation_id                       | state   |
      | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | <state> |
    And the operation emits no event

    Examples:
      | state             |
      | PARTIALLY_SHIPPED |
      | SHIPPED           |
      | RELEASED          |
      | EXPIRED           |

  Scenario: An unknown reservation is refused
    Given the time is "2026-11-22T11:00:00.000Z"
    And there is no current reservation
    When I run the operation with:
      | idempotency_key | reservation_id                       |
      | exp-0004        | 00000000-0000-4000-8000-000000000000 |
    Then the operation fails with "urn:corpus:inventory:reservation:error:reservation_not_found":
      | reservation_id                       |
      | 00000000-0000-4000-8000-000000000000 |
    And the operation emits no event

  Scenario Outline: An idempotency key shorter than 8 or longer than 64 characters is rejected
    Given the time is "2026-11-22T11:00:00.000Z"
    And the current reservation is:
      | result   | reservation_id                       | order_id | state  | lines                                                   | expires_at               |
      | RESERVED | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | ORD-1    | ACTIVE | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 10 }] | 2026-11-22T10:30:00.000Z |
    When I run the operation with:
      | idempotency_key   | reservation_id                       |
      | <idempotency_key> | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d |
    Then the input is rejected on "idempotency_key"

    Examples:
      | idempotency_key  |
      | exp-001          |
      | =repeat(65, "e") |

  Scenario: A reservation id that is not a UUID is rejected
    Given the time is "2026-11-22T11:00:00.000Z"
    And the current reservation is:
      | result   | reservation_id                       | order_id | state  | lines                                                   | expires_at               |
      | RESERVED | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | ORD-1    | ACTIVE | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 10 }] | 2026-11-22T10:30:00.000Z |
    When I run the operation with:
      | idempotency_key | reservation_id |
      | exp-0005        | RES-1          |
    Then the input is rejected on "reservation_id"

  Scenario: An idempotency key used before with a different body is refused
    Given the time is "2026-11-22T11:00:00.000Z"
    And the current reservation is:
      | result   | reservation_id                       | order_id | state  | lines                                                   | expires_at               |
      | RESERVED | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | ORD-1    | ACTIVE | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 10 }] | 2026-11-22T10:30:00.000Z |
    When I run the operation with:
      | idempotency_key | reservation_id                       |
      | conflict-key    | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d |
    Then the operation fails with "urn:corpus:inventory:request:error:idempotency_conflict":
      | idempotency_key |
      | conflict-key    |
    And the operation emits no event

  Scenario Outline: Any caller other than the clock is refused, even when the reservation is due
    Given the time is "2026-11-22T11:00:00.000Z"
    And the caller is:
      | role   |
      | <role> |
    And the current reservation is:
      | result   | reservation_id                       | order_id | state  | lines                                                   | expires_at               |
      | RESERVED | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | ORD-1    | ACTIVE | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 10 }] | 2026-11-22T10:30:00.000Z |
    When I run the operation with:
      | idempotency_key | reservation_id                       |
      | exp-0101        | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d |
    Then the operation fails with "urn:corpus:inventory:access:error:forbidden":
      | role   |
      | <role> |
    And the operation emits no event

    Examples:
      | role                 |
      | order_system         |
      | purchasing_system    |
      | warehouse_staff      |
      | warehouse_supervisor |

  Scenario Outline: A refused caller does not learn the state of the reservation or whether it is due
    Given the time is "2026-11-22T10:00:00.000Z"
    And the caller is:
      | role   |
      | <role> |
    And the current reservation is:
      | result   | reservation_id                       | order_id | state   | lines                                                   | expires_at               |
      | RESERVED | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | ORD-1    | <state> | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 10 }] | 2026-11-22T10:30:00.000Z |
    When I run the operation with:
      | idempotency_key | reservation_id                       |
      | exp-0102        | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d |
    Then the operation fails with "urn:corpus:inventory:access:error:forbidden":
      | role   |
      | <role> |
    And the operation emits no event

    Examples:
      | role         | state   |
      | order_system | ACTIVE  |
      | order_system | SHIPPED |
