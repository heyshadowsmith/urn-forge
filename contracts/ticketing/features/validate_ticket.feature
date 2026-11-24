Feature: Validate a ticket at the entry of an event
  Only box-office staff assigned to the event validate its tickets. An ISSUED ticket is admitted, with TicketUsed.

  Scenario: An ISSUED ticket of the event is admitted, with TicketUsed at the time of the call
    When I run "validate_ticket" with:
      | ticket_code      | event_id                             | caller                                                                                                            | called_at            | stored_ticket                                                                                                                                                                                                                                                     |
      | ABCDEFGH23456789 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | {"caller_id": "gate-7", "caller_role": "box_office", "assigned_events": ["6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f"]} | 2026-12-12T19:30:00Z | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "ISSUED", "price": {"amount_minor": 5000, "currency": "USD"}} |
    Then the output is "entry_result":
      | ticket_code      | event_id                             | verdict | used_ticket                                                  | ticket_used                                                                                                                                                                          |
      | ABCDEFGH23456789 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | ADMIT   | {"ticket_code": "ABCDEFGH23456789", "ticket_status": "USED"} | {"message_id": "00000000-0000-4000-8000-000000000001", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "ticket_code": "ABCDEFGH23456789", "occurred_at": "2026-12-12T19:30:00Z"} |

  Scenario Outline: A ticket that is not ISSUED, of another event, or unknown is not admitted
    When I run "validate_ticket" with:
      | ticket_code      | event_id                             | caller                                                                                                            | called_at            | stored_ticket |
      | ABCDEFGH23456789 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | {"caller_id": "gate-7", "caller_role": "box_office", "assigned_events": ["6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f"]} | 2026-12-12T19:30:00Z | <ticket>      |
    Then the output is "entry_result":
      | ticket_code      | event_id                             | verdict   |
      | ABCDEFGH23456789 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | <verdict> |

    Examples:
      | verdict      | ticket                                                                                                                                                                                                                                                                      |
      | ALREADY_USED | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "USED", "price": {"amount_minor": 5000, "currency": "USD"}}             |
      | NOT_VALID    | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "REFUNDED", "price": {"amount_minor": 5000, "currency": "USD"}}         |
      | NOT_VALID    | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "VOID", "price": {"amount_minor": 5000, "currency": "USD"}}             |
      | NOT_VALID    | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "TRANSFER_PENDING", "price": {"amount_minor": 5000, "currency": "USD"}} |
      | WRONG_EVENT  | {"ticket_code": "ABCDEFGH23456789", "event_id": "5e0b1c2d-3a4b-4c5d-8e6f-9a0b1c2d3e4f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "ISSUED", "price": {"amount_minor": 5000, "currency": "USD"}}           |
      | WRONG_EVENT  | {"ticket_code": "ABCDEFGH23456789", "event_id": "5e0b1c2d-3a4b-4c5d-8e6f-9a0b1c2d3e4f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "USED", "price": {"amount_minor": 5000, "currency": "USD"}}             |

  Scenario: An unknown ticket is NOT_VALID
    When I run "validate_ticket" with:
      | ticket_code      | event_id                             | caller                                                                                                            | called_at            |
      | ABCDEFGH23456789 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | {"caller_id": "gate-7", "caller_role": "box_office", "assigned_events": ["6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f"]} | 2026-12-12T19:30:00Z |
    Then the output is "entry_result":
      | ticket_code      | event_id                             | verdict   |
      | ABCDEFGH23456789 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | NOT_VALID |

  Scenario Outline: A caller who is not box-office staff assigned to the event is refused with FORBIDDEN
    When I run "validate_ticket" with:
      | ticket_code      | event_id                             | caller   | called_at            | stored_ticket                                                                                                                                                                                                                                                     |
      | ABCDEFGH23456789 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | <caller> | 2026-12-12T19:30:00Z | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "ISSUED", "price": {"amount_minor": 5000, "currency": "USD"}} |
    Then the output is "forbidden":
      | caller_id   |
      | <caller_id> |

    Examples:
      | caller_id | caller                                                                                                            |
      | gate-9    | {"caller_id": "gate-9", "caller_role": "box_office", "assigned_events": ["5e0b1c2d-3a4b-4c5d-8e6f-9a0b1c2d3e4f"]} |
      | ada       | {"caller_id": "ada", "caller_role": "buyer"}                                                                      |
      | org-1     | {"caller_id": "org-1", "caller_role": "organizer", "assigned_events": ["6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f"]}   |

  Scenario: A stored ticket that is not the ticket of the scan is rejected
    When I run "validate_ticket" with:
      | ticket_code      | event_id                             | caller                                                                                                            | called_at            | stored_ticket                                                                                                                                                                                                                                                     |
      | ZYXWVUTS98765432 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | {"caller_id": "gate-7", "caller_role": "box_office", "assigned_events": ["6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f"]} | 2026-12-12T19:30:00Z | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "ISSUED", "price": {"amount_minor": 5000, "currency": "USD"}} |
    Then the input is rejected by "names_the_ticket" of "entry_scan"

  Scenario Outline: A scan by a caller that breaks a rule is rejected
    When I run "validate_ticket" with:
      | ticket_code      | event_id                             | caller   | called_at            | stored_ticket                                                                                                                                                                                                                                                     |
      | ABCDEFGH23456789 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | <caller> | 2026-12-12T19:30:00Z | {"ticket_code": "ABCDEFGH23456789", "event_id": "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f", "buyer_id": "ada", "place_kind": "seated", "section": "A1", "row": "C", "seat_number": 12, "ticket_status": "ISSUED", "price": {"amount_minor": 5000, "currency": "USD"}} |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule      | definition  | caller                                                                                                       |
      | enum      | caller_role | {"caller_id": "gate-7", "caller_role": "admin", "assigned_events": ["6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f"]} |
      | minLength | caller_id   | {"caller_id": "", "caller_role": "box_office", "assigned_events": ["6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f"]}  |
      | required  | caller      | {"caller_id": "gate-7"}                                                                                      |
