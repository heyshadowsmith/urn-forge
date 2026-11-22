@urn:corpus:bookings:booking:operation:get_booking
Feature: Read a booking

  Scenario: A booking of the restaurant is read, with its time zone
    When I run the operation with:
      | reference |
      | CNFRMD22  |
    Then the output is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |

  Scenario: A reference that is not 8 characters from the published alphabet is rejected
    When I run the operation with:
      | reference |
      | BOOKING1  |
    Then the input is rejected on "reference"

  Scenario: An unknown reference is not found
    When I run the operation with:
      | reference |
      | XXXXXXXX  |
    Then the operation fails with "urn:corpus:bookings:booking:error:booking_not_found":
      | reference |
      | XXXXXXXX  |

  Scenario: A booking of another restaurant is forbidden
    When I run the operation with:
      | reference |
      | FRBDDN22  |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden":
      | reference |
      | FRBDDN22  |
