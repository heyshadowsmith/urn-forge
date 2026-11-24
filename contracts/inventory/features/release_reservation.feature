Feature: Release a reservation
  The order system gives the stock of an active or partly shipped reservation back. The shell loads
  the reservation and the stored level of each of its lines.

  Scenario: An active reservation gives back every line
    When I run "release_reservation" with:
      | caller.role  | now                      | idempotency_key | reservation_id                       | stored_reservation                                                                                                                                                                                                                                                                                                           | stored_levels                                                                                                                                                                                     |
      | order_system | 2026-11-22T10:00:00.000Z | release-0001    | 3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13 | {"reservation_id": "3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13", "order_id": "ORD-1", "state": "ACTIVE", "reservation_lines": [{"sku": "WIDGET-1", "location": "AMS-B-0142", "quantity": 10, "shipped": 0}, {"sku": "GADGET-2", "location": "AMS-B-0143", "quantity": 5, "shipped": 0}], "expires_at": "2026-11-22T10:30:00.000Z"} | [{"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400}, {"sku": "GADGET-2", "location": "AMS-B-0143", "on_hand": 50, "reserved": 40, "available": 10}] |
    Then the output is "reservation_changed":
      | levels                                                                                                                                                                                           |
      | [{"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 90, "available": 410}, {"sku": "GADGET-2", "location": "AMS-B-0143", "on_hand": 50, "reserved": 35, "available": 15}] |

  Scenario: A partly shipped reservation gives back the units it still holds
    When I run "release_reservation" with:
      | caller.role  | now                      | idempotency_key | reservation_id                       | stored_reservation                                                                                                                                                                                                                                                                                                                      | stored_levels                                                                                                                                                                                     |
      | order_system | 2026-11-22T10:00:00.000Z | release-0001    | 3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13 | {"reservation_id": "3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13", "order_id": "ORD-1", "state": "PARTIALLY_SHIPPED", "reservation_lines": [{"sku": "WIDGET-1", "location": "AMS-B-0142", "quantity": 10, "shipped": 4}, {"sku": "GADGET-2", "location": "AMS-B-0143", "quantity": 5, "shipped": 5}], "expires_at": "2026-11-22T10:30:00.000Z"} | [{"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400}, {"sku": "GADGET-2", "location": "AMS-B-0143", "on_hand": 50, "reserved": 40, "available": 10}] |
    Then the output is "reservation_changed":
      | levels                                                                                            |
      | [{"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 94, "available": 406}] |

  Scenario: An unknown reservation is not found
    When I run "release_reservation" with:
      | caller.role  | now                      | idempotency_key | reservation_id                       | stored_levels                                                                                                                                                                                     |
      | order_system | 2026-11-22T10:00:00.000Z | release-0001    | 3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13 | [{"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400}, {"sku": "GADGET-2", "location": "AMS-B-0143", "on_hand": 50, "reserved": 40, "available": 10}] |
    Then the output is "reservation_not_found":
      | error_code            | reservation_id                       |
      | RESERVATION_NOT_FOUND | 3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13 |

  Scenario Outline: A shipped, released or expired reservation cannot be released
    When I run "release_reservation" with:
      | caller.role  | now                      | idempotency_key | reservation_id                       | stored_reservation   | stored_levels                                                                                                                                                                                     |
      | order_system | 2026-11-22T10:00:00.000Z | release-0001    | 3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13 | <stored_reservation> | [{"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400}, {"sku": "GADGET-2", "location": "AMS-B-0143", "on_hand": 50, "reserved": 40, "available": 10}] |
    Then the output is "invalid_state":
      | error_code    | state   |
      | INVALID_STATE | <state> |

    Examples:
      | state    | stored_reservation                                                                                                                                                                                                                                 |
      | SHIPPED  | {"reservation_id": "3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13", "order_id": "ORD-1", "state": "SHIPPED", "reservation_lines": [{"sku": "WIDGET-1", "location": "AMS-B-0142", "quantity": 10, "shipped": 10}], "expires_at": "2026-11-22T10:30:00.000Z"} |
      | RELEASED | {"reservation_id": "3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13", "order_id": "ORD-1", "state": "RELEASED", "reservation_lines": [{"sku": "WIDGET-1", "location": "AMS-B-0142", "quantity": 10, "shipped": 0}], "expires_at": "2026-11-22T10:30:00.000Z"} |
      | EXPIRED  | {"reservation_id": "3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13", "order_id": "ORD-1", "state": "EXPIRED", "reservation_lines": [{"sku": "WIDGET-1", "location": "AMS-B-0142", "quantity": 10, "shipped": 0}], "expires_at": "2026-11-22T10:30:00.000Z"}  |

  Scenario Outline: Another caller may not release a reservation
    When I run "release_reservation" with:
      | caller.role | now                      | idempotency_key | reservation_id                       | stored_reservation                                                                                                                                                                                                                                                                                                           | stored_levels                                                                                                                                                                                     |
      | <role>      | 2026-11-22T10:00:00.000Z | release-0001    | 3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13 | {"reservation_id": "3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13", "order_id": "ORD-1", "state": "ACTIVE", "reservation_lines": [{"sku": "WIDGET-1", "location": "AMS-B-0142", "quantity": 10, "shipped": 0}, {"sku": "GADGET-2", "location": "AMS-B-0143", "quantity": 5, "shipped": 0}], "expires_at": "2026-11-22T10:30:00.000Z"} | [{"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400}, {"sku": "GADGET-2", "location": "AMS-B-0143", "on_hand": 50, "reserved": 40, "available": 10}] |
    Then the output is "forbidden":
      | error_code | role   |
      | FORBIDDEN  | <role> |

    Examples:
      | role            |
      | warehouse_staff |
      | clock           |

  Scenario Outline: A release request that breaks a rule is rejected
    When I run "release_reservation" with:
      | caller.role  | now                      | idempotency_key   | reservation_id   | stored_reservation   | stored_levels                                                                                                                                                                                     |
      | order_system | 2026-11-22T10:00:00.000Z | <idempotency_key> | <reservation_id> | <stored_reservation> | [{"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400}, {"sku": "GADGET-2", "location": "AMS-B-0143", "on_hand": 50, "reserved": 40, "available": 10}] |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                  | definition      | idempotency_key                                                   | reservation_id                       | stored_reservation                                                                                                                                                                                                                                                                                                           |
      | names_the_reservation | release_request | release-0001                                                      | 9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f | {"reservation_id": "3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13", "order_id": "ORD-1", "state": "ACTIVE", "reservation_lines": [{"sku": "WIDGET-1", "location": "AMS-B-0142", "quantity": 10, "shipped": 0}, {"sku": "GADGET-2", "location": "AMS-B-0143", "quantity": 5, "shipped": 0}], "expires_at": "2026-11-22T10:30:00.000Z"} |
      | pattern               | reservation_id  | release-0001                                                      | R-1                                  |                                                                                                                                                                                                                                                                                                                              |
      | minLength             | idempotency_key | short                                                             | 3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13 |                                                                                                                                                                                                                                                                                                                              |
      | maxLength             | idempotency_key | kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk | 3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13 |                                                                                                                                                                                                                                                                                                                              |
      | required              | release_request |                                                                   | 3f2b8c1e-9a4d-4c7e-8b1f-2d6e5a9c0b13 |                                                                                                                                                                                                                                                                                                                              |
