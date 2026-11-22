@urn:corpus:bookings:booking:operation:cancel_booking
Feature: Cancel a booking

  Scenario Outline: A confirmed booking is cancelled; the deposit comes back in full only 24 hours or more before the start
    Given the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | <local_date> | <local_time> | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference |
      | CNFRMD22  |
    Then the output is:
      | reference | state     | refund_amount   | cancelled_at         |
      | CNFRMD22  | CANCELLED | <refund_amount> | 2026-11-22T10:00:00Z |
    And the operation emits "urn:corpus:bookings:booking:event:booking_cancelled":
      | reference | state     | occurred_at          | guest_id                             |
      | CNFRMD22  | CANCELLED | 2026-11-22T10:00:00Z | a8098c1a-f86e-41da-bd5c-00c04fd430c8 |

    Examples:
      | local_date | local_time | refund_amount |
      | 2026-12-24 | 19:30      | 80.00         |
      | 2026-11-23 | 11:00      | 80.00         |
      | 2026-11-23 | 10:45      | 0.00          |
      | 2026-11-22 | 16:00      | 0.00          |

  Scenario: A reference that is not valid is rejected
    Given the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference |
      | abc       |
    Then the input is rejected on "reference"

  Scenario: An unknown reference is not found
    Given there is no current booking
    When I run the operation with:
      | reference |
      | XXXXXXXX  |
    Then the operation fails with "urn:corpus:bookings:booking:error:booking_not_found"
    And the operation emits no event

  Scenario: A booking of another restaurant is forbidden
    Given the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | FRBDDN22  | 7c9e6679-7425-40de-944b-e07fc1f90ae7 | CONFIRMED | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference |
      | FRBDDN22  |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"
    And the operation emits no event

  Scenario: A second cancellation gives the first answer again, with no new event
    Given the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CANCELLED | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference |
      | CNFRMD22  |
    Then the output is:
      | reference | state     | refund_amount | cancelled_at         |
      | CNFRMD22  | CANCELLED | 80.00         | 2026-11-20T08:00:00Z |
    And the operation emits no event

  Scenario Outline: A seated, completed or no-show booking cannot be cancelled
    Given the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | <state>   | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference |
      | CNFRMD22  |
    Then the operation fails with "urn:corpus:bookings:booking:error:invalid_state":
      | reference | state   |
      | CNFRMD22  | <state> |
    And the operation emits no event

    Examples:
      | state     |
      | SEATED    |
      | COMPLETED |
      | NO_SHOW   |

  Scenario: A booking that starts in less than 2 hours cannot be cancelled
    Given the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-11-22 | 12:00      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference |
      | CNFRMD22  |
    Then the operation fails with "urn:corpus:bookings:booking:error:change_deadline_passed"
    And the operation emits no event
