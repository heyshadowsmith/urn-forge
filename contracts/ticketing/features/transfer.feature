@urn-forge:strict
Feature: Transfer a ticket

  @urn:corpus:ticketing:transfer:operation:transfer_ticket
  Scenario: A ticket is offered to a recipient for 72 hours
    When I run the operation with:
      | ticket_code      | recipient_email   |
      | ABCDEFGH23456789 | friend@example.com |
    Then the output is:
      | transfer_id                          | ticket_code      | recipient_email    | offered_at           | accept_until         |
      | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d | ABCDEFGH23456789 | friend@example.com | 2026-12-01T19:00:00Z | 2026-12-04T19:00:00Z |

  @urn:corpus:ticketing:transfer:operation:transfer_ticket
  Scenario Outline: A ticket code or an email that is not valid is rejected at the boundary
    When I run the operation with:
      | ticket_code   | recipient_email   |
      | <ticket_code> | <recipient_email> |
    Then the input is rejected on "<field>"

    Examples:
      | field           | ticket_code      | recipient_email    |
      | ticket_code     | ABCDEFGHI3456789 | friend@example.com |
      | ticket_code     | ABCDEFGH2345678  | friend@example.com |
      | recipient_email | ABCDEFGH23456789 | not-an-email       |

  @urn:corpus:ticketing:transfer:operation:accept_transfer
  Scenario: An accepted transfer voids the old code and gives a new code for the same seat
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
    When I run the operation with:
      | transfer_id |
      | transfer-1  |
    Then the input is rejected on "transfer_id"

  @urn:corpus:ticketing:transfer:operation:cancel_transfer
  Scenario: A cancelled transfer leaves the ticket ISSUED
    When I run the operation with:
      | transfer_id                          |
      | 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d |
    Then the output is:
      | ticket_code      | ticket_status |
      | ABCDEFGH23456789 | ISSUED        |
    And the operation emits no event

  @urn:corpus:ticketing:transfer:operation:cancel_transfer
  Scenario: A transfer identifier that is not a UUID is rejected at the boundary when cancelling
    When I run the operation with:
      | transfer_id |
      | transfer-1  |
    Then the input is rejected on "transfer_id"
