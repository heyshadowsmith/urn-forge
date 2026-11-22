@urn:corpus:bookings:booking:operation:change_booking
Feature: Change a booking

  Scenario Outline: A confirmed booking more than 2 hours away is changed
    When I run the operation with:
      | reference | local_date   | local_time   | party_size   |
      | CNFRMD22  | <local_date> | <local_time> | <party_size> |
    Then the output is:
      | reference | state     | local_date   | local_time   | time_zone    | party_size   |
      | CNFRMD22  | CONFIRMED | <local_date> | <local_time> | Europe/Paris | <party_size> |
    And the operation emits "urn:corpus:bookings:booking:event:booking_changed":
      | reference | state     | local_date   | local_time   | party_size   | time_zone    | guest_id                             |
      | CNFRMD22  | CONFIRMED | <local_date> | <local_time> | <party_size> | Europe/Paris | a8098c1a-f86e-41da-bd5c-00c04fd430c8 |

    Examples:
      | local_date | local_time | party_size |
      | 2026-12-31 | 20:15      | 1          |
      | 2026-12-30 | 21:00      | 20         |

  Scenario: A change of the party size only keeps the date and the time
    When I run the operation with:
      | reference | party_size |
      | CNFRMD22  | 6          |
    Then the output is:
      | reference | state     | local_date | local_time | party_size |
      | CNFRMD22  | CONFIRMED | 2026-12-24 | 19:30      | 6          |

  Scenario Outline: A change with a value that is not valid is rejected on that field
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
    When I run the operation with:
      | reference | party_size |
      | XXXXXXXX  | 2          |
    Then the operation fails with "urn:corpus:bookings:booking:error:booking_not_found"
    And the operation emits no event

  Scenario: A booking of another restaurant is forbidden
    When I run the operation with:
      | reference | party_size |
      | FRBDDN22  | 2          |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"
    And the operation emits no event

  Scenario: A booking that is no longer confirmed cannot change
    When I run the operation with:
      | reference | party_size |
      | SEATED22  | 2          |
    Then the operation fails with "urn:corpus:bookings:booking:error:invalid_state":
      | reference | state  |
      | SEATED22  | SEATED |
    And the operation emits no event

  Scenario: A booking that starts in less than 2 hours cannot change
    When I run the operation with:
      | reference | party_size |
      | LATE2222  | 2          |
    Then the operation fails with "urn:corpus:bookings:booking:error:change_deadline_passed":
      | reference |
      | LATE2222  |
    And the operation emits no event
