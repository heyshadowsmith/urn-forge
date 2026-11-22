@urn-forge:strict
@urn:corpus:inventory:reservation:operation:ship_reservation
Feature: Ship a reservation

  Scenario Outline: An active or partly shipped reservation shipped without lines ships in full
    Given the current reservation is:
      | result   | reservation_id                       | order_id | state   | lines                                                   | expires_at               |
      | RESERVED | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | ORD-1    | <state> | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 10 }] | 2026-11-22T10:30:00.000Z |
    When I run the operation with:
      | idempotency_key | reservation_id                       |
      | shp-0001        | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d |
    Then the output is:
      | reservation_id                       | state   |
      | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | SHIPPED |
    And the operation emits "urn:corpus:inventory:reservation:event:stock_shipped":
      | event_id                             | reservation_id                       | quantity_changed | level                                                                               | occurred_at              |
      | 7d3f1c2a-5b4e-4a6d-9c8b-000000000001 | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | -10              | { sku: WIDGET-1, location: AMS-B-0142, on_hand: 490, reserved: 90, available: 400 } | 2026-11-22T10:00:00.000Z |

    Examples:
      | state             |
      | ACTIVE            |
      | PARTIALLY_SHIPPED |

  Scenario Outline: A stated quantity per line ships that much of each line
    Given the current reservation is:
      | result   | reservation_id                       | order_id | state  | lines                                                   | expires_at               |
      | RESERVED | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | ORD-1    | ACTIVE | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 10 }] | 2026-11-22T10:30:00.000Z |
    When I run the operation with:
      | idempotency_key   | reservation_id                       | lines   |
      | <idempotency_key> | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | <lines> |
    Then the output is:
      | state   |
      | <state> |
    And the operation emits "urn:corpus:inventory:reservation:event:stock_shipped"

    Examples:
      | idempotency_key  | lines                                                                          | state             |
      | shp-0002         | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 1 }]                         | PARTIALLY_SHIPPED |
      | =repeat(64, "s") | [{ sku: A1B, location: AMS-B-0142, quantity: 10 }]                             | SHIPPED           |
      | shp-0003         | [{ sku: ABCDEFGHIJKLMNOPQRSTUVWXYZ-12345, location: AMS-B-0142, quantity: 4 }] | PARTIALLY_SHIPPED |
      | shp-0004         | =repeat(100, { sku: WIDGET-1, location: AMS-B-0142, quantity: 1 })             | PARTIALLY_SHIPPED |

  Scenario: A quantity over what is still reserved on the line is refused
    Given the current reservation is:
      | result   | reservation_id                       | order_id | state  | lines                                                   | expires_at               |
      | RESERVED | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | ORD-1    | ACTIVE | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 10 }] | 2026-11-22T10:30:00.000Z |
    When I run the operation with:
      | idempotency_key | reservation_id                       | lines                                                       |
      | shp-0005        | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 100000 }] |
    Then the operation fails with "urn:corpus:inventory:request:error:invalid_request"
    And the operation emits no event

  Scenario Outline: Lines that are empty, more than 100, or break their rules are rejected
    Given the current reservation is:
      | result   | reservation_id                       | order_id | state  | lines                                                   | expires_at               |
      | RESERVED | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | ORD-1    | ACTIVE | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 10 }] | 2026-11-22T10:30:00.000Z |
    When I run the operation with:
      | idempotency_key | reservation_id                       | lines   |
      | shp-0006        | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | <lines> |
    Then the input is rejected on "lines"

    Examples:
      | lines                                                              |
      | []                                                                 |
      | =repeat(101, { sku: WIDGET-1, location: AMS-B-0142, quantity: 1 }) |
      | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 0 }]             |
      | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 100001 }]        |
      | [{ sku: AB, location: AMS-B-0142, quantity: 1 }]                   |
      | [{ sku: =repeat(33, "A"), location: AMS-B-0142, quantity: 1 }]     |
      | [{ sku: WIDGET--, location: AMS-B-0142, quantity: 1 }]             |
      | [{ sku: WIDGET-1, location: AMS-B-01420, quantity: 1 }]            |

  Scenario Outline: An idempotency key shorter than 8 or longer than 64 characters is rejected
    Given the current reservation is:
      | result   | reservation_id                       | order_id | state  | lines                                                   | expires_at               |
      | RESERVED | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | ORD-1    | ACTIVE | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 10 }] | 2026-11-22T10:30:00.000Z |
    When I run the operation with:
      | idempotency_key   | reservation_id                       |
      | <idempotency_key> | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d |
    Then the input is rejected on "idempotency_key"

    Examples:
      | idempotency_key  |
      | shp-001          |
      | =repeat(65, "s") |

  Scenario: A reservation id that is not a UUID is rejected
    Given the current reservation is:
      | result   | reservation_id                       | order_id | state  | lines                                                   | expires_at               |
      | RESERVED | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | ORD-1    | ACTIVE | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 10 }] | 2026-11-22T10:30:00.000Z |
    When I run the operation with:
      | idempotency_key | reservation_id |
      | shp-0007        | RES-1          |
    Then the input is rejected on "reservation_id"

  Scenario: An unknown reservation is refused
    Given there is no current reservation
    When I run the operation with:
      | idempotency_key | reservation_id                       |
      | shp-0008        | 00000000-0000-4000-8000-000000000000 |
    Then the operation fails with "urn:corpus:inventory:reservation:error:reservation_not_found":
      | reservation_id                       |
      | 00000000-0000-4000-8000-000000000000 |

  Scenario Outline: A shipped, released or expired reservation cannot ship
    Given the current reservation is:
      | result   | reservation_id                       | order_id | state   | lines                                                   | expires_at               |
      | RESERVED | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | ORD-1    | <state> | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 10 }] | 2026-11-22T10:30:00.000Z |
    When I run the operation with:
      | idempotency_key | reservation_id                       |
      | shp-0009        | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d |
    Then the operation fails with "urn:corpus:inventory:reservation:error:invalid_state":
      | reservation_id                       | state   |
      | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | <state> |
    And the operation emits no event

    Examples:
      | state    |
      | SHIPPED  |
      | RELEASED |
      | EXPIRED  |

  Scenario: An idempotency key used before with a different body is refused
    Given the current reservation is:
      | result   | reservation_id                       | order_id | state  | lines                                                   | expires_at               |
      | RESERVED | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d | ORD-1    | ACTIVE | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 10 }] | 2026-11-22T10:30:00.000Z |
    When I run the operation with:
      | idempotency_key | reservation_id                       |
      | conflict-key    | 5a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d |
    Then the operation fails with "urn:corpus:inventory:request:error:idempotency_conflict":
      | idempotency_key |
      | conflict-key    |
