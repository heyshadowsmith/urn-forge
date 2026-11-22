@urn:corpus:bookings:booking:operation:complete_booking
Feature: Close a booking when the party leaves

  Scenario: A SEATED booking moves to COMPLETED
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | SEATED    | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference |
      | CNFRMD22  |
    Then the output is:
      | reference | state |
      | CNFRMD22  | COMPLETED |
    And the operation emits "urn:corpus:bookings:booking:event:booking_completed":
      | event_id                             | reference | restaurant_id                        | state     | party_size | local_date | local_time | time_zone    | occurred_at          | guest_id                             |
      | 16fd2706-8baf-433b-82eb-8c7fed5c9b0e | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | COMPLETED | 4          | 2026-12-24 | 19:30      | Europe/Paris | 2026-11-22T10:00:00Z | a8098c1a-f86e-41da-bd5c-00c04fd430c8 |

  Scenario Outline: A booking in another state cannot move
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And the current booking is:
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
      | state |
      | CONFIRMED |
      | COMPLETED |
      | CANCELLED |
      | NO_SHOW |

  Scenario: A reference that is not valid is rejected
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | SEATED    | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference |
      | BOOKING1  |
    Then the input is rejected on "reference"

  Scenario: An unknown reference is not found
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And there is no current booking
    When I run the operation with:
      | reference |
      | XXXXXXXX  |
    Then the operation fails with "urn:corpus:bookings:booking:error:booking_not_found"
    And the operation emits no event

  Scenario: A booking of another restaurant is forbidden
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | FRBDDN22  | 7c9e6679-7425-40de-944b-e07fc1f90ae7 | SEATED    | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference |
      | FRBDDN22  |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"
    And the operation emits no event

  Scenario: A guest cannot complete a booking, even with its reference, its contact and the id of its restaurant
    Given the caller is:
      | role  | restaurant_id                        |
      | guest | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | email           | phone        |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | SEATED    | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference | email           | phone        |
      | CNFRMD22  | ada@example.com | +33612345678 |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden":
      | reference |
      | CNFRMD22  |
    And the operation emits no event

  Scenario: Staff with no restaurant cannot complete a booking
    Given the caller is:
      | role  |
      | staff |
    And the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | email           | phone        |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | SEATED    | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference |
      | CNFRMD22  |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"
    And the operation emits no event

  Scenario Outline: A presented email or phone that is not valid is rejected
    Given the caller is:
      | role  |
      | guest |
    And the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | SEATED    | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              |
    When I run the operation with:
      | reference | email   | phone   |
      | CNFRMD22  | <email> | <phone> |
    Then the input is rejected on "<field>"

    Examples:
      | field | email         | phone         |
      | email | not-an-email  |               |
      | phone |               | 0612345678    |
      | phone |               | +012345678    |
      | phone |               | +1234567890123456 |
