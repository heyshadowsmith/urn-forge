@urn-forge:strict
Feature: Transfer a ticket

  @urn:corpus:ticketing:transfer:operation:transfer_ticket
  Scenario: An ISSUED ticket is offered to a recipient for 72 hours
    Given the time is "2026-12-01T19:00:00Z"
    And the current ticket is:
      | ticket_code      | event_id                             | place_kind | section | row | seat_number | ticket_status    | price                                 | starts_at            |
      | ABCDEFGH23456789 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | seated     | A1      | C   | 12          | ISSUED           | { amount_minor: 5000, currency: EUR } | 2026-12-12T20:00:00Z |
    When I run the operation with:
      | ticket_code      | recipient_email   |
      | ABCDEFGH23456789 | friend@example.com |
    Then the output is:
      | transfer_id                          | ticket_code      | recipient_email    | offered_at           | accept_until         |
      | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d | ABCDEFGH23456789 | friend@example.com | 2026-12-01T19:00:00Z | 2026-12-04T19:00:00Z |

  @urn:corpus:ticketing:transfer:operation:transfer_ticket
  Scenario Outline: A ticket code or an email that is not valid is rejected at the boundary
    Given the time is "2026-12-01T19:00:00Z"
    And the current ticket is:
      | ticket_code      | event_id                             | place_kind | section | row | seat_number | ticket_status    | price                                 | starts_at            |
      | ABCDEFGH23456789 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | seated     | A1      | C   | 12          | ISSUED           | { amount_minor: 5000, currency: EUR } | 2026-12-12T20:00:00Z |
    When I run the operation with:
      | ticket_code   | recipient_email   |
      | <ticket_code> | <recipient_email> |
    Then the input is rejected on "<field>"

    Examples:
      | field           | ticket_code      | recipient_email    |
      | ticket_code     | ABCDEFGHI3456789 | friend@example.com |
      | ticket_code     | ABCDEFGH2345678  | friend@example.com |
      | recipient_email | ABCDEFGH23456789 | not-an-email       |

  @urn:corpus:ticketing:transfer:operation:transfer_ticket
  Scenario Outline: Only an ISSUED ticket can be transferred; USED, REFUNDED and VOID are final
    Given the time is "2026-12-01T19:00:00Z"
    And the current ticket is:
      | ticket_code      | event_id                             | place_kind | section | row | seat_number | ticket_status    | price                                 | starts_at            |
      | ABCDEFGH23456789 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | seated     | A1      | C   | 12          | <ticket_status>          | { amount_minor: 5000, currency: EUR } | 2026-12-12T20:00:00Z |
    When I run the operation with:
      | ticket_code      | recipient_email    |
      | ABCDEFGH23456789 | friend@example.com |
    Then the operation fails with "urn:corpus:ticketing:ticket:error:invalid_ticket_state":
      | ticket_code      | ticket_status |
      | ABCDEFGH23456789 | <ticket_status>       |
    And the operation emits no event

    Examples:
      | ticket_status    |
      | TRANSFER_PENDING |
      | USED             |
      | REFUNDED         |
      | VOID             |

  @urn:corpus:ticketing:transfer:operation:transfer_ticket
  Scenario: A transfer a millisecond before 2 hours before the start of the event is accepted
    Given the time is "2026-12-12T17:59:59.999Z"
    And the current ticket is:
      | ticket_code      | event_id                             | place_kind | section | row | seat_number | ticket_status    | price                                 | starts_at            |
      | ABCDEFGH23456789 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | seated     | A1      | C   | 12          | ISSUED           | { amount_minor: 5000, currency: EUR } | 2026-12-12T20:00:00Z |
    When I run the operation with:
      | ticket_code      | recipient_email    |
      | ABCDEFGH23456789 | friend@example.com |
    Then the output is:
      | ticket_code      | recipient_email    |
      | ABCDEFGH23456789 | friend@example.com |

  @urn:corpus:ticketing:transfer:operation:transfer_ticket
  Scenario: A transfer at 2 hours before the start of the event is refused
    Given the time is "2026-12-12T18:00:00Z"
    And the current ticket is:
      | ticket_code      | event_id                             | place_kind | section | row | seat_number | ticket_status    | price                                 | starts_at            |
      | ABCDEFGH23456789 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | seated     | A1      | C   | 12          | ISSUED           | { amount_minor: 5000, currency: EUR } | 2026-12-12T20:00:00Z |
    When I run the operation with:
      | ticket_code      | recipient_email    |
      | ABCDEFGH23456789 | friend@example.com |
    Then the operation fails with "urn:corpus:ticketing:transfer:error:transfer_window_closed":
      | ticket_code      | starts_at            |
      | ABCDEFGH23456789 | 2026-12-12T20:00:00Z |
    And the operation emits no event

  @urn:corpus:ticketing:transfer:operation:transfer_ticket
  Scenario: A transfer after the start of the event is refused
    Given the time is "2026-12-12T21:00:00Z"
    And the current ticket is:
      | ticket_code      | event_id                             | place_kind | section | row | seat_number | ticket_status    | price                                 | starts_at            |
      | ABCDEFGH23456789 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | seated     | A1      | C   | 12          | ISSUED           | { amount_minor: 5000, currency: EUR } | 2026-12-12T20:00:00Z |
    When I run the operation with:
      | ticket_code      | recipient_email    |
      | ABCDEFGH23456789 | friend@example.com |
    Then the operation fails with "urn:corpus:ticketing:transfer:error:transfer_window_closed":
      | ticket_code      | starts_at            |
      | ABCDEFGH23456789 | 2026-12-12T20:00:00Z |
    And the operation emits no event

  @urn:corpus:ticketing:transfer:operation:accept_transfer
  Scenario: An accepted transfer voids the old code and gives a new code for the same seat
    Given the time is "2026-12-01T19:00:00Z"
    And the current transfer is:
      | transfer_id                          | ticket_code      | recipient_email    | offered_at           | accept_until         | starts_at            |
      | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d | ABCDEFGH23456789 | friend@example.com | 2026-12-01T19:00:00Z | 2026-12-04T19:00:00Z | 2026-12-12T20:00:00Z |
    When I run the operation with:
      | transfer_id                          |
      | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d |
    Then the output is:
      | ticket_code      | section | row | seat_number | ticket_status |
      | NEWXCDE234567892 | A1      | C   | 12          | ISSUED        |
    And the operation emits "urn:corpus:ticketing:ticket:event:ticket_transferred":
      | message_id                           | event_id                             | ticket_code      | void_ticket_code | occurred_at          |
      | 00000000-0000-4000-8000-000000000001 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | NEWXCDE234567892 | ABCDEFGH23456789 | 2026-12-01T19:00:00Z |

  @urn:corpus:ticketing:transfer:operation:accept_transfer
  Scenario: A transfer identifier that is not a UUID is rejected at the boundary when accepting
    Given the time is "2026-12-01T19:00:00Z"
    And the current transfer is:
      | transfer_id                          | ticket_code      | recipient_email    | offered_at           | accept_until         | starts_at            |
      | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d | ABCDEFGH23456789 | friend@example.com | 2026-12-01T19:00:00Z | 2026-12-04T19:00:00Z | 2026-12-12T20:00:00Z |
    When I run the operation with:
      | transfer_id |
      | transfer-1  |
    Then the input is rejected on "transfer_id"

  @urn:corpus:ticketing:transfer:operation:accept_transfer
  Scenario: A transfer accepted a millisecond before 2 hours before the start of the event becomes the recipient's ticket
    Given the time is "2026-12-12T17:59:59.999Z"
    And the current transfer is:
      | transfer_id                          | ticket_code      | recipient_email    | offered_at           | accept_until         | starts_at            |
      | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d | ABCDEFGH23456789 | friend@example.com | 2026-12-01T19:00:00Z | 2026-12-04T19:00:00Z | 2026-12-12T20:00:00Z |
    When I run the operation with:
      | transfer_id                          |
      | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d |
    Then the output is:
      | ticket_code      | ticket_status |
      | NEWXCDE234567892 | ISSUED        |

  @urn:corpus:ticketing:transfer:operation:accept_transfer
  Scenario: A transfer accepted at 2 hours before the start of the event is refused
    Given the time is "2026-12-12T18:00:00Z"
    And the current transfer is:
      | transfer_id                          | ticket_code      | recipient_email    | offered_at           | accept_until         | starts_at            |
      | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d | ABCDEFGH23456789 | friend@example.com | 2026-12-01T19:00:00Z | 2026-12-04T19:00:00Z | 2026-12-12T20:00:00Z |
    When I run the operation with:
      | transfer_id                          |
      | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d |
    Then the operation fails with "urn:corpus:ticketing:transfer:error:transfer_window_closed":
      | ticket_code      | starts_at            |
      | ABCDEFGH23456789 | 2026-12-12T20:00:00Z |
    And the operation emits no event

  @urn:corpus:ticketing:transfer:operation:accept_transfer
  Scenario: A transfer accepted after the start of the event is refused
    Given the time is "2026-12-12T21:00:00Z"
    And the current transfer is:
      | transfer_id                          | ticket_code      | recipient_email    | offered_at           | accept_until         | starts_at            |
      | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d | ABCDEFGH23456789 | friend@example.com | 2026-12-01T19:00:00Z | 2026-12-04T19:00:00Z | 2026-12-12T20:00:00Z |
    When I run the operation with:
      | transfer_id                          |
      | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d |
    Then the operation fails with "urn:corpus:ticketing:transfer:error:transfer_window_closed":
      | ticket_code      | starts_at            |
      | ABCDEFGH23456789 | 2026-12-12T20:00:00Z |
    And the operation emits no event

  @urn:corpus:ticketing:transfer:operation:accept_transfer
  Scenario: An unknown transfer cannot be accepted
    Given the time is "2026-12-01T19:00:00Z"
    And there is no current transfer
    When I run the operation with:
      | transfer_id                          |
      | 00000000-0000-4000-8000-000000000404 |
    Then the operation fails with "urn:corpus:ticketing:transfer:error:transfer_not_found":
      | transfer_id                          |
      | 00000000-0000-4000-8000-000000000404 |
    And the operation emits no event

  @urn:corpus:ticketing:transfer:operation:cancel_transfer
  Scenario: A cancelled transfer moves the ticket from TRANSFER_PENDING back to ISSUED
    Given the current ticket is:
      | ticket_code      | event_id                             | place_kind | section | row | seat_number | ticket_status    | price                                 | starts_at            |
      | ABCDEFGH23456789 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | seated     | A1      | C   | 12          | TRANSFER_PENDING | { amount_minor: 5000, currency: EUR } | 2026-12-12T20:00:00Z |
    When I run the operation with:
      | transfer_id                          |
      | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d |
    Then the output is:
      | ticket_code      | ticket_status |
      | ABCDEFGH23456789 | ISSUED        |
    And the operation emits no event

  @urn:corpus:ticketing:transfer:operation:cancel_transfer
  Scenario: A transfer identifier that is not a UUID is rejected at the boundary when cancelling
    Given the current ticket is:
      | ticket_code      | event_id                             | place_kind | section | row | seat_number | ticket_status    | price                                 | starts_at            |
      | ABCDEFGH23456789 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | seated     | A1      | C   | 12          | TRANSFER_PENDING | { amount_minor: 5000, currency: EUR } | 2026-12-12T20:00:00Z |
    When I run the operation with:
      | transfer_id |
      | transfer-1  |
    Then the input is rejected on "transfer_id"

  @urn:corpus:ticketing:transfer:operation:cancel_transfer
  Scenario Outline: Only a TRANSFER_PENDING ticket can go back to ISSUED
    Given the current ticket is:
      | ticket_code      | event_id                             | place_kind | section | row | seat_number | ticket_status    | price                                 | starts_at            |
      | ABCDEFGH23456789 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | seated     | A1      | C   | 12          | <ticket_status>          | { amount_minor: 5000, currency: EUR } | 2026-12-12T20:00:00Z |
    When I run the operation with:
      | transfer_id                          |
      | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d |
    Then the operation fails with "urn:corpus:ticketing:ticket:error:invalid_ticket_state":
      | ticket_code      | ticket_status |
      | ABCDEFGH23456789 | <ticket_status>       |

    Examples:
      | ticket_status |
      | ISSUED   |
      | USED     |
      | REFUNDED |
      | VOID     |
