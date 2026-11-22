@urn:corpus:bookings:booking:operation:cancel_booking
Feature: Cancel a booking

  Scenario Outline: A confirmed booking is cancelled; the deposit comes back in full only 24 hours or more before the start
    When I run the operation with:
      | reference   |
      | <reference> |
    Then the output is:
      | reference   | state     | refund_amount | cancelled_at         |
      | <reference> | CANCELLED | <refund_amount>      | 2026-11-22T10:00:00Z |
    And the operation emits "urn:corpus:bookings:booking:event:booking_cancelled":
      | reference   | state     | occurred_at          | guest_id                             |
      | <reference> | CANCELLED | 2026-11-22T10:00:00Z | a8098c1a-f86e-41da-bd5c-00c04fd430c8 |

    Examples:
      | reference | refund_amount |
      | CNFRMD22  | 80.00  |
      | LATE3333  | 0.00   |

  Scenario: A second cancellation gives the first answer again, with no new event
    When I run the operation with:
      | reference |
      | CANCLD22  |
    Then the output is:
      | reference | state     | refund_amount | cancelled_at         |
      | CANCLD22  | CANCELLED | 80.00         | 2026-11-20T08:00:00Z |
    And the operation emits no event

  Scenario: A reference that is not valid is rejected
    When I run the operation with:
      | reference |
      | abc       |
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

  Scenario: A seated booking cannot be cancelled
    When I run the operation with:
      | reference |
      | SEATED22  |
    Then the operation fails with "urn:corpus:bookings:booking:error:invalid_state":
      | reference | state  |
      | SEATED22  | SEATED |
    And the operation emits no event

  Scenario: A booking that starts in less than 2 hours cannot be cancelled
    When I run the operation with:
      | reference |
      | LATE2222  |
    Then the operation fails with "urn:corpus:bookings:booking:error:change_deadline_passed"
    And the operation emits no event
