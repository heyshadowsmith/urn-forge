@urn-forge:strict
@urn:corpus:inventory:receipt:operation:receive_goods
Feature: Receive goods for a purchase order

  # Only warehouse staff and the purchasing system may receive goods; the scenarios below run as warehouse staff.
  Background:
    Given the caller is:
      | role            |
      | warehouse_staff |

  Scenario: Receiving 1 of WIDGET-1 reports the new on-hand count of the line
    When I run the operation with:
      | idempotency_key | purchase_order_id | lines                                                  |
      | rcv-0001        | PO-1              | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 1 }] |
    Then the output is:
      | purchase_order_id | lines                                                                                  |
      | PO-1              | [{ sku: WIDGET-1, location: AMS-B-0142, on_hand: 501, reserved: 100, available: 401 }] |
    And the operation emits "urn:corpus:inventory:stock:event:stock_received":
      | event_id                             | quantity_changed | level                                                                                | occurred_at              |
      | 7d3f1c2a-5b4e-4a6d-9c8b-000000000001 | 1                | { sku: WIDGET-1, location: AMS-B-0142, on_hand: 501, reserved: 100, available: 401 } | 2026-11-22T10:00:00.000Z |

  Scenario: Receiving 100000 of A1B reports the new on-hand count of the line
    When I run the operation with:
      | idempotency_key  | purchase_order_id | lines                                                  |
      | =repeat(64, "k") | P                 | [{ sku: A1B, location: AMS-B-0142, quantity: 100000 }] |
    Then the output is:
      | purchase_order_id | lines                                                                                   |
      | P                 | [{ sku: A1B, location: AMS-B-0142, on_hand: 100500, reserved: 100, available: 100400 }] |
    And the operation emits "urn:corpus:inventory:stock:event:stock_received":
      | event_id                             | quantity_changed | level                                                                                 | occurred_at              |
      | 7d3f1c2a-5b4e-4a6d-9c8b-000000000001 | 100000           | { sku: A1B, location: AMS-B-0142, on_hand: 100500, reserved: 100, available: 100400 } | 2026-11-22T10:00:00.000Z |

  Scenario: Receiving 25 of a 32-character SKU reports the new on-hand count of the line
    When I run the operation with:
      | idempotency_key | purchase_order_id | lines                                                                           |
      | rcv-0003        | PO-3              | [{ sku: ABCDEFGHIJKLMNOPQRSTUVWXYZ-12345, location: AMS-B-0142, quantity: 25 }] |
    Then the output is:
      | purchase_order_id | lines                                                                                                          |
      | PO-3              | [{ sku: ABCDEFGHIJKLMNOPQRSTUVWXYZ-12345, location: AMS-B-0142, on_hand: 525, reserved: 100, available: 425 }] |
    And the operation emits "urn:corpus:inventory:stock:event:stock_received":
      | event_id                             | quantity_changed | level                                                                                                        | occurred_at              |
      | 7d3f1c2a-5b4e-4a6d-9c8b-000000000001 | 25               | { sku: ABCDEFGHIJKLMNOPQRSTUVWXYZ-12345, location: AMS-B-0142, on_hand: 525, reserved: 100, available: 425 } | 2026-11-22T10:00:00.000Z |

  Scenario: A receipt of 200 lines is accepted
    When I run the operation with:
      | idempotency_key | purchase_order_id | lines                                                              |
      | rcv-0200        | PO-200            | =repeat(200, { sku: WIDGET-1, location: AMS-B-0142, quantity: 2 }) |
    Then the output is:
      | purchase_order_id |
      | PO-200            |
    And the operation emits "urn:corpus:inventory:stock:event:stock_received"

  Scenario Outline: A receipt with no lines or more than 200 lines, or with a line that breaks its rules, is rejected
    When I run the operation with:
      | idempotency_key | purchase_order_id | lines   |
      | rcv-0009        | PO-9              | <lines> |
    Then the input is rejected on "lines"

    Examples:
      | lines                                                              |
      | []                                                                 |
      | =repeat(201, { sku: WIDGET-1, location: AMS-B-0142, quantity: 2 }) |
      | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 0 }]             |
      | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 100001 }]        |
      | [{ sku: AB, location: AMS-B-0142, quantity: 1 }]                   |
      | [{ sku: =repeat(33, "A"), location: AMS-B-0142, quantity: 1 }]     |
      | [{ sku: WIDGET-, location: AMS-B-0142, quantity: 1 }]              |
      | [{ sku: WIDGET-1, location: AMS-B-142, quantity: 1 }]              |

  Scenario Outline: An idempotency key shorter than 8 or longer than 64 characters is rejected
    When I run the operation with:
      | idempotency_key   | purchase_order_id | lines                                                  |
      | <idempotency_key> | PO-1              | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 1 }] |
    Then the input is rejected on "idempotency_key"

    Examples:
      | idempotency_key  |
      | rcv-001          |
      | =repeat(65, "k") |

  Scenario: A receipt without a purchase order is rejected
    When I run the operation with:
      | idempotency_key | purchase_order_id | lines                                                  |
      | rcv-0001        | ""                | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 1 }] |
    Then the input is rejected on "purchase_order_id"

  Scenario: A receipt for an unknown SKU is refused and changes no stock
    When I run the operation with:
      | idempotency_key | purchase_order_id | lines                                                                                                           |
      | rcv-0001        | PO-1              | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 1 }, { sku: NO-SUCH-SKU, location: AMS-B-0142, quantity: 1 }] |
    Then the operation fails with "urn:corpus:inventory:stock:error:unknown_sku":
      | sku         |
      | NO-SUCH-SKU |
    And the operation emits no event

  Scenario: A receipt for an unknown location is refused
    When I run the operation with:
      | idempotency_key | purchase_order_id | lines                                                  |
      | rcv-0001        | PO-1              | [{ sku: WIDGET-1, location: ZZZ-Z-9999, quantity: 1 }] |
    Then the operation fails with "urn:corpus:inventory:stock:error:unknown_location":
      | location   |
      | ZZZ-Z-9999 |

  Scenario: An idempotency key used before with a different body is refused
    When I run the operation with:
      | idempotency_key | purchase_order_id | lines                                                  |
      | conflict-key    | PO-1              | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 1 }] |
    Then the operation fails with "urn:corpus:inventory:request:error:idempotency_conflict":
      | idempotency_key |
      | conflict-key    |
    And the operation emits no event

  Scenario: The purchasing system may receive goods
    Given the caller is:
      | role              |
      | purchasing_system |
    When I run the operation with:
      | idempotency_key | purchase_order_id | lines                                                  |
      | rcv-0101        | PO-1              | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 1 }] |
    Then the output is:
      | purchase_order_id | lines                                                                                  |
      | PO-1              | [{ sku: WIDGET-1, location: AMS-B-0142, on_hand: 501, reserved: 100, available: 401 }] |

  Scenario Outline: Any caller other than warehouse staff and the purchasing system is refused
    Given the caller is:
      | role                 |
      | <role>               |
    When I run the operation with:
      | idempotency_key | purchase_order_id | lines                                                  |
      | rcv-0102        | PO-1              | [{ sku: WIDGET-1, location: AMS-B-0142, quantity: 1 }] |
    Then the operation fails with "urn:corpus:inventory:access:error:forbidden":
      | role   |
      | <role> |
    And the operation emits no event

    Examples:
      | role                 |
      | order_system         |
      | warehouse_supervisor |
      | clock                |
