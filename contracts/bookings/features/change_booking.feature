@urn:corpus:bookings:booking:operation:change_booking
Feature: Change a booking

  Scenario Outline: A confirmed booking more than 2 hours away is changed
    Given the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference | local_date   | local_time   | party_size   |
      | CNFRMD22  | <local_date> | <local_time> | <party_size> |
    Then the output is:
      | reference | state     | local_date   | local_time   | time_zone    | party_size   |
      | CNFRMD22  | CONFIRMED | <local_date> | <local_time> | Europe/Paris | <party_size> |
    And the operation emits "urn:corpus:bookings:booking:event:booking_changed":
      | event_id                             | reference | restaurant_id                        | state     | local_date   | local_time   | party_size   | time_zone    | occurred_at          | guest_id                             |
      | 16fd2706-8baf-433b-82eb-8c7fed5c9b0e | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | <local_date> | <local_time> | <party_size> | Europe/Paris | 2026-11-22T10:00:00Z | a8098c1a-f86e-41da-bd5c-00c04fd430c8 |

    Examples:
      | local_date | local_time | party_size |
      | 2026-12-31 | 20:15      | 1          |
      | 2026-12-30 | 21:00      | 20         |

  Scenario: A change of the party size only keeps the date and the time
    Given the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference | party_size |
      | CNFRMD22  | 6          |
    Then the output is:
      | reference | state     | local_date | local_time | party_size |
      | CNFRMD22  | CONFIRMED | 2026-12-24 | 19:30      | 6          |

  Scenario Outline: A change with a value that is not valid is rejected on that field
    Given the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference   | local_time   | party_size   |
      | <reference> | <local_time> | <party_size> |
    Then the input is rejected on "<field>"

    Examples:
      | field      | reference | local_time | party_size |
      | reference  | BOOKING1  |            |            |
      | local_time | CNFRMD22  | 21:05      |            |
      | party_size | CNFRMD22  |            | 0          |
      | party_size | CNFRMD22  |            | 21         |

  Scenario: An unknown reference is not found
    Given there is no current booking
    When I run the operation with:
      | reference | party_size |
      | XXXXXXXX  | 2          |
    Then the operation fails with "urn:corpus:bookings:booking:error:booking_not_found"
    And the operation emits no event

  Scenario: A booking of another restaurant is forbidden
    Given the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | FRBDDN22  | 7c9e6679-7425-40de-944b-e07fc1f90ae7 | CONFIRMED | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference | party_size |
      | FRBDDN22  | 2          |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"
    And the operation emits no event

  Scenario Outline: A booking that is no longer confirmed cannot change
    Given the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | <state>   | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference | party_size |
      | CNFRMD22  | 2          |
    Then the operation fails with "urn:corpus:bookings:booking:error:invalid_state":
      | reference | state   |
      | CNFRMD22  | <state> |
    And the operation emits no event

    Examples:
      | state     |
      | SEATED    |
      | COMPLETED |
      | CANCELLED |
      | NO_SHOW   |

  Scenario: A booking that starts in less than 2 hours cannot change
    Given the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-11-22 | 12:00      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference | party_size |
      | CNFRMD22  | 2          |
    Then the operation fails with "urn:corpus:bookings:booking:error:change_deadline_passed":
      | reference |
      | CNFRMD22  |
    And the operation emits no event
