Feature: Expire a reservation
  The shell's clock expires an active reservation whose expiry time has come, and its stock becomes
  available again. The shell loads the reservation and the stored level of each of its lines.

  Scenario Outline: An active reservation expires at its expiry time or later
    When I run "expire_reservation" with:
      | caller.role | now   | idempotency_key | reservation_id                       | stored_reservation                                                                                                                                                                                                                                                                                                           | stored_levels                                                                                                                                                                                     |
      | clock       | <now> | expire-0001     | 3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13 | {"reservation_id": "3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13", "order_id": "ORD-1", "state": "ACTIVE", "reservation_lines": [{"sku": "WIDGET-1", "location": "AMS-B-0142", "quantity": 10, "shipped": 0}, {"sku": "GADGET-2", "location": "AMS-B-0143", "quantity": 5, "shipped": 0}], "expires_at": "2026-11-22T10:30:00.000Z"} | [{"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400}, {"sku": "GADGET-2", "location": "AMS-B-0143", "on_hand": 50, "reserved": 40, "available": 10}] |
    Then the output is "reservation_changed":
      | levels                                                                                                                                                                                           |
      | [{"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 90, "available": 410}, {"sku": "GADGET-2", "location": "AMS-B-0143", "on_hand": 50, "reserved": 35, "available": 15}] |

    Examples:
      | now                      |
      | 2026-11-22T10:30:00.000Z |
      | 2026-11-23T08:00:00.000Z |

  Scenario: A reservation is not expired before its expiry time
    When I run "expire_reservation" with:
      | caller.role | now                      | idempotency_key | reservation_id                       | stored_reservation                                                                                                                                                                                                                                                                                                           | stored_levels                                                                                                                                                                                     |
      | clock       | 2026-11-22T10:29:59.999Z | expire-0001     | 3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13 | {"reservation_id": "3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13", "order_id": "ORD-1", "state": "ACTIVE", "reservation_lines": [{"sku": "WIDGET-1", "location": "AMS-B-0142", "quantity": 10, "shipped": 0}, {"sku": "GADGET-2", "location": "AMS-B-0143", "quantity": 5, "shipped": 0}], "expires_at": "2026-11-22T10:30:00.000Z"} | [{"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400}, {"sku": "GADGET-2", "location": "AMS-B-0143", "on_hand": 50, "reserved": 40, "available": 10}] |
    Then the output is "invalid_request":
      | error_code      |
      | INVALID_REQUEST |

  Scenario: An unknown reservation is not found
    When I run "expire_reservation" with:
      | caller.role | now                      | idempotency_key | reservation_id                       | stored_levels                                                                                                                                                                                     |
      | clock       | 2026-11-22T10:30:00.000Z | expire-0001     | 3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13 | [{"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400}, {"sku": "GADGET-2", "location": "AMS-B-0143", "on_hand": 50, "reserved": 40, "available": 10}] |
    Then the output is "reservation_not_found":
      | error_code            | reservation_id                       |
      | RESERVATION_NOT_FOUND | 3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13 |

  Scenario Outline: Only an active reservation expires
    When I run "expire_reservation" with:
      | caller.role | now                      | idempotency_key | reservation_id                       | stored_reservation   | stored_levels                                                                                                                                                                                     |
      | clock       | 2026-11-22T10:30:00.000Z | expire-0001     | 3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13 | <stored_reservation> | [{"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400}, {"sku": "GADGET-2", "location": "AMS-B-0143", "on_hand": 50, "reserved": 40, "available": 10}] |
    Then the output is "invalid_state":
      | error_code    | state   |
      | INVALID_STATE | <state> |

    Examples:
      | state             | stored_reservation                                                                                                                                                                                                                                                                                                                      |
      | PARTIALLY_SHIPPED | {"reservation_id": "3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13", "order_id": "ORD-1", "state": "PARTIALLY_SHIPPED", "reservation_lines": [{"sku": "WIDGET-1", "location": "AMS-B-0142", "quantity": 10, "shipped": 4}, {"sku": "GADGET-2", "location": "AMS-B-0143", "quantity": 5, "shipped": 5}], "expires_at": "2026-11-22T10:30:00.000Z"} |
      | SHIPPED           | {"reservation_id": "3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13", "order_id": "ORD-1", "state": "SHIPPED", "reservation_lines": [{"sku": "WIDGET-1", "location": "AMS-B-0142", "quantity": 10, "shipped": 10}], "expires_at": "2026-11-22T10:30:00.000Z"}                                                                                      |
      | RELEASED          | {"reservation_id": "3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13", "order_id": "ORD-1", "state": "RELEASED", "reservation_lines": [{"sku": "WIDGET-1", "location": "AMS-B-0142", "quantity": 10, "shipped": 0}], "expires_at": "2026-11-22T10:30:00.000Z"}                                                                                      |
      | EXPIRED           | {"reservation_id": "3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13", "order_id": "ORD-1", "state": "EXPIRED", "reservation_lines": [{"sku": "WIDGET-1", "location": "AMS-B-0142", "quantity": 10, "shipped": 0}], "expires_at": "2026-11-22T10:30:00.000Z"}                                                                                       |

  Scenario Outline: Only the shell's clock expires a reservation
    When I run "expire_reservation" with:
      | caller.role | now                      | idempotency_key | reservation_id                       | stored_reservation                                                                                                                                                                                                                                                                                                           | stored_levels                                                                                                                                                                                     |
      | <role>      | 2026-11-22T10:30:00.000Z | expire-0001     | 3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13 | {"reservation_id": "3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13", "order_id": "ORD-1", "state": "ACTIVE", "reservation_lines": [{"sku": "WIDGET-1", "location": "AMS-B-0142", "quantity": 10, "shipped": 0}, {"sku": "GADGET-2", "location": "AMS-B-0143", "quantity": 5, "shipped": 0}], "expires_at": "2026-11-22T10:30:00.000Z"} | [{"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400}, {"sku": "GADGET-2", "location": "AMS-B-0143", "on_hand": 50, "reserved": 40, "available": 10}] |
    Then the output is "forbidden":
      | error_code | role   |
      | FORBIDDEN  | <role> |

    Examples:
      | role                 |
      | order_system         |
      | warehouse_supervisor |

  Scenario Outline: An expire request that breaks a rule is rejected
    When I run "expire_reservation" with:
      | caller.role | now   | idempotency_key | reservation_id   | stored_reservation   | stored_levels                                                                                                                                                                                     |
      | clock       | <now> | expire-0001     | <reservation_id> | <stored_reservation> | [{"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400}, {"sku": "GADGET-2", "location": "AMS-B-0143", "on_hand": 50, "reserved": 40, "available": 10}] |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                  | definition     | now                      | reservation_id                       | stored_reservation                                                                                                                                                                                                                                                                                                           |
      | names_the_reservation | expire_request | 2026-11-22T10:30:00.000Z | 9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f | {"reservation_id": "3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13", "order_id": "ORD-1", "state": "ACTIVE", "reservation_lines": [{"sku": "WIDGET-1", "location": "AMS-B-0142", "quantity": 10, "shipped": 0}, {"sku": "GADGET-2", "location": "AMS-B-0143", "quantity": 5, "shipped": 0}], "expires_at": "2026-11-22T10:30:00.000Z"} |
      | format                | utc_time       | 22/11/2026 10:30         | 3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13 |                                                                                                                                                                                                                                                                                                                              |
      | pattern               | utc_time       | 2026-11-22T10:30:00Z     | 3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13 |                                                                                                                                                                                                                                                                                                                              |
      | required              | expire_request |                          | 3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13 |                                                                                                                                                                                                                                                                                                                              |
