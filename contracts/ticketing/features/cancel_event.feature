@urn-forge:strict
@urn:corpus:ticketing:show:operation:cancel_event
Feature: Cancel an event

  Scenario: A cancelled event is published, and its tickets are refunded
    When I run the operation with:
      | event_id                             |
      | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f |
    Then the output is:
      | event_id                             | cancelled_at         |
      | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | 2026-12-01T19:00:00Z |
    And the operation emits "urn:corpus:ticketing:show:event:event_cancelled":
      | message_id                           | event_id                             | occurred_at          |
      | 00000000-0000-4000-8000-000000000001 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | 2026-12-01T19:00:00Z |
    And the operation emits "urn:corpus:ticketing:ticket:event:ticket_refunded":
      | message_id                           | ticket_code      |
      | 00000000-0000-4000-8000-000000000003 | ZYXWVUTS98765432 |

  Scenario: An event identifier that is not a UUID is rejected at the boundary
    When I run the operation with:
      | event_id  |
      | concert-1 |
    Then the input is rejected on "event_id"
