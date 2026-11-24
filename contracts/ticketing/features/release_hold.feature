Feature: Release a hold
  An ACTIVE hold is RELEASED, so that its seats are no longer held by it.

  Scenario: An ACTIVE hold is RELEASED
    When I run "release_hold" with:
      | hold_id                              | stored_hold                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | {"hold_id": "3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "hold_status": "ACTIVE", "held_lines": [{"place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "quantity": 1, "price": {"amount_minor": 5000, "currency": "USD"}}, {"place_kind": "standing", "section": "FLOOR", "quantity": 2, "price": {"amount_minor": 6000, "currency": "USD"}}], "total": {"amount_minor": 11000, "currency": "USD"}, "created_at": "2026-12-01T19:00:00Z", "expires_at": "2026-12-01T19:10:00Z"} |
    Then the output is "hold_state":
      | hold_id                              | hold_status |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | RELEASED    |

  Scenario: An unknown hold is refused with HOLD_NOT_FOUND
    When I run "release_hold" with:
      | hold_id                              |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b |
    Then the output is "hold_not_found":
      | hold_id                              |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b |

  Scenario Outline: A hold that is no longer ACTIVE is refused with HOLD_NOT_ACTIVE
    When I run "release_hold" with:
      | hold_id                              | stored_hold   |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | <stored_hold> |
    Then the output is "hold_not_active":
      | hold_id                              | hold_status |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | <status>    |

    Examples:
      | status    | stored_hold                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
      | CONVERTED | {"hold_id": "3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "hold_status": "CONVERTED", "held_lines": [{"place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "quantity": 1, "price": {"amount_minor": 5000, "currency": "USD"}}, {"place_kind": "standing", "section": "FLOOR", "quantity": 2, "price": {"amount_minor": 6000, "currency": "USD"}}], "total": {"amount_minor": 11000, "currency": "USD"}, "created_at": "2026-12-01T19:00:00Z", "expires_at": "2026-12-01T19:10:00Z"} |
      | EXPIRED   | {"hold_id": "3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "hold_status": "EXPIRED", "held_lines": [{"place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "quantity": 1, "price": {"amount_minor": 5000, "currency": "USD"}}, {"place_kind": "standing", "section": "FLOOR", "quantity": 2, "price": {"amount_minor": 6000, "currency": "USD"}}], "total": {"amount_minor": 11000, "currency": "USD"}, "created_at": "2026-12-01T19:00:00Z", "expires_at": "2026-12-01T19:10:00Z"}   |

  Scenario: A stored hold that is not the hold of the request is rejected
    When I run "release_hold" with:
      | hold_id                              | stored_hold                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
      | 4c9f8b21-3d5e-4f70-8b2c-3d4e5f6a7b8c | {"hold_id": "3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "hold_status": "ACTIVE", "held_lines": [{"place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "quantity": 1, "price": {"amount_minor": 5000, "currency": "USD"}}, {"place_kind": "standing", "section": "FLOOR", "quantity": 2, "price": {"amount_minor": 6000, "currency": "USD"}}], "total": {"amount_minor": 11000, "currency": "USD"}, "created_at": "2026-12-01T19:00:00Z", "expires_at": "2026-12-01T19:10:00Z"} |
    Then the input is rejected by "names_the_hold" of "hold_ref"
