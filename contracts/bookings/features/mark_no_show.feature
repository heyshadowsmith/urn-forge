@urn:corpus:bookings:booking:operation:mark_no_show
Feature: Mark a booking whose party did not come

  Scenario: A CONFIRMED booking moves to NO_SHOW
    Given the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-11-22 | 10:00      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference |
      | CNFRMD22  |
    Then the output is:
      | reference | state |
      | CNFRMD22  | NO_SHOW |
    And the operation emits "urn:corpus:bookings:booking:event:booking_no_show":
      | reference | state | restaurant_id                        | occurred_at          |
      | CNFRMD22  | NO_SHOW | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-22T10:00:00Z |

  Scenario Outline: A booking in another state cannot move
    Given the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | <state>   | 2026-11-22 | 10:00      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference |
      | CNFRMD22  |
    Then the operation fails with "urn:corpus:bookings:booking:error:invalid_state":
      | reference | state   |
      | CNFRMD22  | <state> |
    And the operation emits no event

    Examples:
      | state |
      | SEATED |
      | COMPLETED |
      | CANCELLED |
      | NO_SHOW |

  Scenario: A confirmed booking cannot be marked NO_SHOW before 15 minutes after its start
    Given the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-11-22 | 11:00      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference |
      | CNFRMD22  |
    Then the operation fails with "urn:corpus:bookings:booking:error:invalid_state":
      | reference | state     |
      | CNFRMD22  | CONFIRMED |
    And the operation emits no event

  Scenario: A reference that is not valid is rejected
    Given the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-11-22 | 10:00      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference |
      | BOOKING1  |
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
      | FRBDDN22  | 7c9e6679-7425-40de-944b-e07fc1f90ae7 | CONFIRMED | 2026-11-22 | 10:00      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference |
      | FRBDDN22  |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"
    And the operation emits no event
