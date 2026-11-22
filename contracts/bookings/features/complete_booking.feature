@urn:corpus:bookings:booking:operation:complete_booking
Feature: Close a booking when the party leaves

  Scenario: A SEATED booking moves to COMPLETED
    When I run the operation with:
      | reference |
      | SEATED22  |
    Then the output is:
      | reference | state |
      | SEATED22  | COMPLETED |
    And the operation emits "urn:corpus:bookings:booking:event:booking_completed":
      | reference | state | restaurant_id                        | occurred_at          |
      | SEATED22  | COMPLETED | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-22T10:00:00Z |

  Scenario: A booking in another state cannot move
    When I run the operation with:
      | reference |
      | CNFRMD22  |
    Then the operation fails with "urn:corpus:bookings:booking:error:invalid_state":
      | reference | state |
      | CNFRMD22  | CONFIRMED |
    And the operation emits no event

  Scenario: A reference that is not valid is rejected
    When I run the operation with:
      | reference |
      | BOOKING1  |
    Then the input is rejected on "reference"

  Scenario: An unknown reference is not found
    When I run the operation with:
      | reference |
      | XXXXXXXX  |
    Then the operation fails with "urn:corpus:bookings:booking:error:booking_not_found"
    And the operation emits no event

  Scenario: A booking of another restaurant is forbidden
    When I run the operation with:
      | reference |
      | FRBDDN22  |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"
    And the operation emits no event
