Feature: Expire a hold after its expiry time; the shell's clock calls it
  A hold expires after its expiry time: at the expiry time itself it can still be checked out.

  Scenario: An ACTIVE hold after its expiry time is EXPIRED, with HoldExpired at the time of the call
    When I run "expire_hold" with:
      | hold_id                              | called_at                | stored_hold                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | 2026-12-01T19:10:00.001Z | {"hold_id": "3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "hold_status": "ACTIVE", "held_lines": [{"place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "quantity": 1, "price": {"amount_minor": 5000, "currency": "USD"}}, {"place_kind": "standing", "section": "FLOOR", "quantity": 2, "price": {"amount_minor": 6000, "currency": "USD"}}], "total": {"amount_minor": 11000, "currency": "USD"}, "created_at": "2026-12-01T19:00:00Z", "expires_at": "2026-12-01T19:10:00Z"} |
    Then the output is "expired_hold":
      | hold_id                              | hold_status | hold_expired                                                                                                                                                                                             |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | EXPIRED     | {"message_id": "00000000-0000-4000-8000-000000000001", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "hold_id": "3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b", "occurred_at": "2026-12-01T19:10:00.001Z"} |

  Scenario Outline: A hold at or before its expiry time is not due
    When I run "expire_hold" with:
      | hold_id                              | called_at   | stored_hold                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | <called_at> | {"hold_id": "3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "hold_status": "ACTIVE", "held_lines": [{"place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "quantity": 1, "price": {"amount_minor": 5000, "currency": "USD"}}, {"place_kind": "standing", "section": "FLOOR", "quantity": 2, "price": {"amount_minor": 6000, "currency": "USD"}}], "total": {"amount_minor": 11000, "currency": "USD"}, "created_at": "2026-12-01T19:00:00Z", "expires_at": "2026-12-01T19:10:00Z"} |
    Then the output is "hold_not_due":
      | hold_id                              | expires_at           |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | 2026-12-01T19:10:00Z |

    Examples:
      | called_at            |
      | 2026-12-01T19:10:00Z |
      | 2026-12-01T19:05:00Z |

  Scenario: An unknown hold is refused with HOLD_NOT_FOUND
    When I run "expire_hold" with:
      | hold_id                              | called_at                |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | 2026-12-01T19:10:00.001Z |
    Then the output is "hold_not_found":
      | hold_id                              |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b |

  Scenario Outline: A hold that is no longer ACTIVE is refused with HOLD_NOT_ACTIVE
    When I run "expire_hold" with:
      | hold_id                              | called_at                | stored_hold   |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | 2026-12-01T19:10:00.001Z | <stored_hold> |
    Then the output is "hold_not_active":
      | hold_id                              | hold_status |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | <status>    |

    Examples:
      | status    | stored_hold                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
      | CONVERTED | {"hold_id": "3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "hold_status": "CONVERTED", "held_lines": [{"place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "quantity": 1, "price": {"amount_minor": 5000, "currency": "USD"}}, {"place_kind": "standing", "section": "FLOOR", "quantity": 2, "price": {"amount_minor": 6000, "currency": "USD"}}], "total": {"amount_minor": 11000, "currency": "USD"}, "created_at": "2026-12-01T19:00:00Z", "expires_at": "2026-12-01T19:10:00Z"} |
      | RELEASED  | {"hold_id": "3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "hold_status": "RELEASED", "held_lines": [{"place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "quantity": 1, "price": {"amount_minor": 5000, "currency": "USD"}}, {"place_kind": "standing", "section": "FLOOR", "quantity": 2, "price": {"amount_minor": 6000, "currency": "USD"}}], "total": {"amount_minor": 11000, "currency": "USD"}, "created_at": "2026-12-01T19:00:00Z", "expires_at": "2026-12-01T19:10:00Z"}  |
      | EXPIRED   | {"hold_id": "3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "hold_status": "EXPIRED", "held_lines": [{"place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "quantity": 1, "price": {"amount_minor": 5000, "currency": "USD"}}, {"place_kind": "standing", "section": "FLOOR", "quantity": 2, "price": {"amount_minor": 6000, "currency": "USD"}}], "total": {"amount_minor": 11000, "currency": "USD"}, "created_at": "2026-12-01T19:00:00Z", "expires_at": "2026-12-01T19:10:00Z"}   |

  Scenario: A stored hold that is not the hold of the request is rejected
    When I run "expire_hold" with:
      | hold_id                              | called_at                | stored_hold                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
      | 4c9f8b21-3d5e-4f70-8b2c-3d4e5f6a7b8c | 2026-12-01T19:10:00.001Z | {"hold_id": "3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "hold_status": "ACTIVE", "held_lines": [{"place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "quantity": 1, "price": {"amount_minor": 5000, "currency": "USD"}}, {"place_kind": "standing", "section": "FLOOR", "quantity": 2, "price": {"amount_minor": 6000, "currency": "USD"}}], "total": {"amount_minor": 11000, "currency": "USD"}, "created_at": "2026-12-01T19:00:00Z", "expires_at": "2026-12-01T19:10:00Z"} |
    Then the input is rejected by "names_the_hold" of "expiry_request"
