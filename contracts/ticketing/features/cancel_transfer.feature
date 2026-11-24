Feature: Cancel a transfer
  The ticket of a cancelled transfer is ISSUED again.

  Scenario: The ticket of a cancelled transfer is ISSUED again
    When I run "cancel_transfer" with:
      | transfer_id                          | stored_transfer                                                                                                                                                                                               | stored_ticket                                                                                                                                                                                                                                                               |
      | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d | {"transfer_id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", "ticket_code": "ABCDEFGH23456789", "recipient_email": "cy@example.com", "offered_at": "2026-12-01T19:00:00Z", "accept_until": "2026-12-04T19:00:00Z"} | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "TRANSFER_PENDING", "price": {"amount_minor": 5000, "currency": "USD"}} |
    Then the output is "ticket_state":
      | ticket_code      | ticket_status |
      | ABCDEFGH23456789 | ISSUED        |

  Scenario: An unknown transfer is refused with TRANSFER_NOT_FOUND
    When I run "cancel_transfer" with:
      | transfer_id                          |
      | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d |
    Then the output is "transfer_not_found":
      | transfer_id                          |
      | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d |

  Scenario: A transfer whose ticket is not TRANSFER_PENDING is refused with INVALID_TICKET_STATE
    When I run "cancel_transfer" with:
      | transfer_id                          | stored_transfer                                                                                                                                                                                               | stored_ticket                                                                                                                                                                                                                                                   |
      | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d | {"transfer_id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", "ticket_code": "ABCDEFGH23456789", "recipient_email": "cy@example.com", "offered_at": "2026-12-01T19:00:00Z", "accept_until": "2026-12-04T19:00:00Z"} | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "USED", "price": {"amount_minor": 5000, "currency": "USD"}} |
    Then the output is "invalid_ticket_state":
      | ticket_code      | ticket_status |
      | ABCDEFGH23456789 | USED          |

  Scenario Outline: A request whose stored records do not fit it is rejected
    When I run "cancel_transfer" with:
      | transfer_id   | stored_transfer                                                                                                                                                                                               | stored_ticket |
      | <transfer_id> | {"transfer_id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", "ticket_code": "ABCDEFGH23456789", "recipient_email": "cy@example.com", "offered_at": "2026-12-01T19:00:00Z", "accept_until": "2026-12-04T19:00:00Z"} | <ticket>      |
    Then the input is rejected by "<rule>" of "transfer_ref"

    Examples:
      | rule                   | transfer_id                          | ticket                                                                                                                                                                                                                                                                      |
      | names_the_transfer     | aa9c8d7e-6f50-4b4c-9d3e-2f1a0b9c8d7e | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "TRANSFER_PENDING", "price": {"amount_minor": 5000, "currency": "USD"}} |
      | ticket_of_the_transfer | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d | {"ticket_code": "ZYXWVUTS98765432", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "TRANSFER_PENDING", "price": {"amount_minor": 5000, "currency": "USD"}} |

  Scenario: A stored transfer without its ticket is rejected
    When I run "cancel_transfer" with:
      | transfer_id                          | stored_transfer                                                                                                                                                                                               |
      | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d | {"transfer_id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", "ticket_code": "ABCDEFGH23456789", "recipient_email": "cy@example.com", "offered_at": "2026-12-01T19:00:00Z", "accept_until": "2026-12-04T19:00:00Z"} |
    Then the input is rejected by "ticket_of_the_transfer" of "transfer_ref"
