@urn-forge:strict
@urn:corpus:ticketing:entry:operation:validate_ticket
Feature: Validate a ticket at the entry

  Scenario: An issued ticket is admitted and becomes used
    Given the time is "2026-12-01T19:00:00Z"
    When I run the operation with:
      | ticket_code      | event_id                             |
      | ABCDEFGH23456789 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f |
    Then the output is:
      | verdict |
      | ADMIT   |
    And the operation emits "urn:corpus:ticketing:ticket:event:ticket_used":
      | message_id                           | event_id                             | ticket_code      | occurred_at          |
      | 00000000-0000-4000-8000-000000000001 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | ABCDEFGH23456789 | 2026-12-01T19:00:00Z |

  Scenario Outline: A ticket that cannot enter gets another answer, and nothing is used
    Given the time is "2026-12-01T19:00:00Z"
    When I run the operation with:
      | ticket_code   | event_id   |
      | <ticket_code> | <event_id> |
    Then the output is:
      | verdict   |
      | <verdict> |
    And the operation emits no event
    And the operation emits no "urn:corpus:ticketing:ticket:event:ticket_used"

    Examples:
      | ticket_code      | event_id                             | verdict      |
      | USEDUSEDUSEDUSED | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | ALREADY_USED |
      | ZZZZZZZZZZZZZZZZ | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | NOT_VALID    |
      | ABCDEFGH23456789 | 00000000-0000-4000-8000-000000000999 | WRONG_EVENT  |

  Scenario Outline: A ticket code or an event identifier that is not valid is rejected at the boundary
    Given the time is "2026-12-01T19:00:00Z"
    When I run the operation with:
      | ticket_code   | event_id   |
      | <ticket_code> | <event_id> |
    Then the input is rejected on "<field>"

    Examples:
      | field       | ticket_code       | event_id                             |
      | ticket_code | ABCDEFGH234567891 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f |
      | event_id    | ABCDEFGH23456789  | concert-1                            |
