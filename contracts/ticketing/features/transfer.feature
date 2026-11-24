Feature: Transfer a ticket to a recipient
  The buyer of an ISSUED ticket offers it to a recipient until 2 hours before the event starts. The recipient
  accepts it within 72 hours of the offer, and gets a new ticket code for the same place; the old code is VOID.

  Scenario: An ISSUED ticket is offered for 72 hours, and is TRANSFER_PENDING
    When I run "transfer_ticket" with:
      | ticket_code      | recipient_email | caller                                       | called_at            | stored_ticket                                                                                                                                                                                                                                                     | show                                                                                                                                            |
      | ABCDEFGH23456789 | cy@example.com  | {"caller_id": "ada", "caller_role": "buyer"} | 2026-12-01T19:00:00Z | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "ISSUED", "price": {"amount_minor": 5000, "currency": "USD"}} | {"event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "organizer_id": "org-1", "starts_at": "2026-12-12T20:00:00Z", "time_zone": "Europe/Paris"} |
    Then the output is "offered_transfer":
      | transfer                                                                                                                                                                                                      | pending_ticket                                                           |
      | {"transfer_id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", "ticket_code": "ABCDEFGH23456789", "recipient_email": "cy@example.com", "offered_at": "2026-12-01T19:00:00Z", "accept_until": "2026-12-04T19:00:00Z"} | {"ticket_code": "ABCDEFGH23456789", "ticket_status": "TRANSFER_PENDING"} |

  Scenario: A transfer just before 2 hours before the start is offered
    When I run "transfer_ticket" with:
      | ticket_code      | recipient_email | caller                                       | called_at                | stored_ticket                                                                                                                                                                                                                                                     | show                                                                                                                                            |
      | ABCDEFGH23456789 | cy@example.com  | {"caller_id": "ada", "caller_role": "buyer"} | 2026-12-12T17:59:59.999Z | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "ISSUED", "price": {"amount_minor": 5000, "currency": "USD"}} | {"event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "organizer_id": "org-1", "starts_at": "2026-12-12T20:00:00Z", "time_zone": "Europe/Paris"} |
    Then the output is "offered_transfer"

  Scenario: A transfer 2 hours before the start is refused with TRANSFER_WINDOW_CLOSED
    When I run "transfer_ticket" with:
      | ticket_code      | recipient_email | caller                                       | called_at            | stored_ticket                                                                                                                                                                                                                                                     | show                                                                                                                                            |
      | ABCDEFGH23456789 | cy@example.com  | {"caller_id": "ada", "caller_role": "buyer"} | 2026-12-12T18:00:00Z | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "ISSUED", "price": {"amount_minor": 5000, "currency": "USD"}} | {"event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "organizer_id": "org-1", "starts_at": "2026-12-12T20:00:00Z", "time_zone": "Europe/Paris"} |
    Then the output is "transfer_window_closed":
      | ticket_code      | starts_at            |
      | ABCDEFGH23456789 | 2026-12-12T20:00:00Z |

  Scenario: An unknown ticket is refused with TICKET_NOT_FOUND
    When I run "transfer_ticket" with:
      | ticket_code      | recipient_email | caller                                       | called_at            |
      | ABCDEFGH23456789 | cy@example.com  | {"caller_id": "ada", "caller_role": "buyer"} | 2026-12-01T19:00:00Z |
    Then the output is "ticket_not_found":
      | ticket_code      |
      | ABCDEFGH23456789 |

  Scenario: Another buyer than the owner of the ticket is refused with FORBIDDEN
    When I run "transfer_ticket" with:
      | ticket_code      | recipient_email | caller                                       | called_at            | stored_ticket                                                                                                                                                                                                                                                     | show                                                                                                                                            |
      | ABCDEFGH23456789 | cy@example.com  | {"caller_id": "bob", "caller_role": "buyer"} | 2026-12-01T19:00:00Z | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "ISSUED", "price": {"amount_minor": 5000, "currency": "USD"}} | {"event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "organizer_id": "org-1", "starts_at": "2026-12-12T20:00:00Z", "time_zone": "Europe/Paris"} |
    Then the output is "forbidden":
      | caller_id |
      | bob       |

  Scenario Outline: A ticket that is not ISSUED is refused with INVALID_TICKET_STATE
    When I run "transfer_ticket" with:
      | ticket_code      | recipient_email | caller                                       | called_at            | stored_ticket | show                                                                                                                                            |
      | ABCDEFGH23456789 | cy@example.com  | {"caller_id": "ada", "caller_role": "buyer"} | 2026-12-01T19:00:00Z | <ticket>      | {"event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "organizer_id": "org-1", "starts_at": "2026-12-12T20:00:00Z", "time_zone": "Europe/Paris"} |
    Then the output is "invalid_ticket_state":
      | ticket_code      | ticket_status |
      | ABCDEFGH23456789 | <status>      |

    Examples:
      | status           | ticket                                                                                                                                                                                                                                                                      |
      | TRANSFER_PENDING | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "TRANSFER_PENDING", "price": {"amount_minor": 5000, "currency": "USD"}} |
      | USED             | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "USED", "price": {"amount_minor": 5000, "currency": "USD"}}             |
      | REFUNDED         | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "REFUNDED", "price": {"amount_minor": 5000, "currency": "USD"}}         |
      | VOID             | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "VOID", "price": {"amount_minor": 5000, "currency": "USD"}}             |

  Scenario Outline: A transfer request that breaks a rule is rejected
    When I run "transfer_ticket" with:
      | ticket_code | recipient_email | caller                                       | called_at            | stored_ticket                                                                                                                                                                                                                                                     | show   |
      | <code>      | <email>         | {"caller_id": "ada", "caller_role": "buyer"} | 2026-12-01T19:00:00Z | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "ISSUED", "price": {"amount_minor": 5000, "currency": "USD"}} | <show> |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule               | definition       | code             | email          | show                                                                                                                                            |
      | names_the_ticket   | transfer_request | ZYXWVUTS98765432 | cy@example.com | {"event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "organizer_id": "org-1", "starts_at": "2026-12-12T20:00:00Z", "time_zone": "Europe/Paris"} |
      | show_of_the_ticket | transfer_request | ABCDEFGH23456789 | cy@example.com | {"event_id": "5e0b1c2d-3a4b-4c5d-8e6f-9a0b1c2d3e4f", "organizer_id": "org-1", "starts_at": "2026-12-12T20:00:00Z", "time_zone": "Europe/Paris"} |
      | pattern            | email            | ABCDEFGH23456789 | cy             | {"event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "organizer_id": "org-1", "starts_at": "2026-12-12T20:00:00Z", "time_zone": "Europe/Paris"} |
      | pattern            | ticket_code      | ABCDEFGHIJKLMNOP | cy@example.com | {"event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "organizer_id": "org-1", "starts_at": "2026-12-12T20:00:00Z", "time_zone": "Europe/Paris"} |

  Scenario: A stored ticket without its event is rejected
    When I run "transfer_ticket" with:
      | ticket_code      | recipient_email | caller                                       | called_at            | stored_ticket                                                                                                                                                                                                                                                     |
      | ABCDEFGH23456789 | cy@example.com  | {"caller_id": "ada", "caller_role": "buyer"} | 2026-12-01T19:00:00Z | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "ISSUED", "price": {"amount_minor": 5000, "currency": "USD"}} |
    Then the input is rejected by "show_of_the_ticket" of "transfer_request"
