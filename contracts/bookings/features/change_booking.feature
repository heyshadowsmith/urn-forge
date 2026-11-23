@urn:corpus:bookings:booking:operation:change_booking
Feature: Change a booking

  # The shell gives the time of each call; a scenario that needs another one says so.
  Background:
    Given the time is "2026-11-22T10:00:00Z"

  Scenario Outline: A confirmed booking more than 2 hours away is changed
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference | starts_at   | local_date   | local_time   | party_size   |
      | CNFRMD22  | <starts_at> | <local_date> | <local_time> | <party_size> |
    Then the output is:
      | reference | state     | starts_at   | local_date   | local_time   | time_zone    | party_size   |
      | CNFRMD22  | CONFIRMED | <starts_at> | <local_date> | <local_time> | Europe/Paris | <party_size> |
    And the operation emits "urn:corpus:bookings:booking:event:booking_changed":
      | event_id                             | reference | restaurant_id                        | state     | local_date   | local_time   | party_size   | time_zone    | occurred_at          | guest_id                             |
      | 16fd2706-8baf-433b-82eb-8c7fed5c9b0e | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | <local_date> | <local_time> | <party_size> | Europe/Paris | 2026-11-22T10:00:00Z | a8098c1a-f86e-41da-bd5c-00c04fd430c8 |

    Examples:
      | starts_at            | local_date | local_time | party_size |
      | 2026-12-31T19:15:00Z | 2026-12-31 | 20:15      | 1          |
      | 2026-12-30T20:00:00Z | 2026-12-30 | 21:00      | 20         |

  Scenario: A change of the party size only keeps the date and the time
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference | party_size |
      | CNFRMD22  | 6          |
    Then the output is:
      | reference | state     | starts_at            | local_date | local_time | party_size |
      | CNFRMD22  | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | 6          |

  Scenario Outline: A change with a value that is not valid is rejected on that field
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference   | starts_at   | local_time   | party_size   |
      | <reference> | <starts_at> | <local_time> | <party_size> |
    Then the input is rejected on "<field>"

    Examples:
      | field      | reference | starts_at                 | local_time | party_size |
      | reference  | BOOKING1  |                           |            |            |
      | local_time | CNFRMD22  | 2026-12-24T20:05:00Z      | 21:05      |            |
      | starts_at  | CNFRMD22  | 2026-12-24T21:00:00+01:00 | 21:00      |            |
      | party_size | CNFRMD22  |                           |            | 0          |
      | party_size | CNFRMD22  |                           |            | 21         |

  Scenario: An unknown reference is not found
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And there is no current booking
    When I run the operation with:
      | reference | party_size |
      | XXXXXXXX  | 2          |
    Then the operation fails with "urn:corpus:bookings:booking:error:booking_not_found"
    And the operation emits no event

  Scenario: A booking of another restaurant is forbidden
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | FRBDDN22  | 7c9e6679-7425-40de-944b-e07fc1f90ae7 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference | party_size |
      | FRBDDN22  | 2          |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"
    And the operation emits no event

  Scenario Outline: A booking that is no longer confirmed cannot change
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And the current booking is:
      | reference | restaurant_id                        | state   | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | <state> | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
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

  # The booking starts at 2026-12-24T18:30:00Z (19:30 in Paris): a change runs to 2 hours before it,
  # 2026-12-24T16:30:00Z included. The deadline reads the start as it is, not the new one.
  Scenario Outline: A confirmed booking is changed up to 2 hours before its start
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And the time is "<now>"
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference | party_size |
      | CNFRMD22  | 2          |
    Then the output is:
      | reference | state     | starts_at            | party_size |
      | CNFRMD22  | CONFIRMED | 2026-12-24T18:30:00Z | 2          |

    Examples:
      | now                      |
      | 2026-12-24T16:29:59.999Z |
      | 2026-12-24T16:30:00Z     |

  Scenario Outline: A booking that starts in less than 2 hours cannot change
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And the time is "<now>"
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference | starts_at   | local_date   | local_time   | party_size |
      | CNFRMD22  | <starts_at> | <local_date> | <local_time> | 2          |
    Then the operation fails with "urn:corpus:bookings:booking:error:change_deadline_passed":
      | reference |
      | CNFRMD22  |
    And the operation emits no event

    Examples:
      | now                      | starts_at            | local_date | local_time |
      | 2026-12-24T16:30:00.001Z |                      |            |            |
      | 2026-12-24T18:30:00Z     |                      |            |            |
      | 2026-12-24T16:30:00.001Z | 2026-12-31T19:15:00Z | 2026-12-31 | 20:15      |

  Scenario Outline: A move gives starts_at with the local date or time, and starts_at comes only with a move
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference | starts_at   | local_date   | local_time   |
      | CNFRMD22  | <starts_at> | <local_date> | <local_time> |
    Then the input is rejected by "urn:corpus:bookings:booking:invariant:move_has_starts_at"

    Examples:
      | starts_at            | local_date | local_time |
      |                      | 2026-12-31 | 20:15      |
      |                      | 2026-12-31 |            |
      |                      |            | 20:15      |
      | 2026-12-31T19:15:00Z |            |            |

  Scenario: A guest changes a booking whose reference and email they present
    Given the caller is:
      | role  |
      | guest |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | email           | phone        |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference | email | party_size |
      | CNFRMD22  | ada@example.com | 6          |
    Then the output is:
      | reference | state     | party_size |
      | CNFRMD22  | CONFIRMED | 6          |

  Scenario: A guest changes a booking whose reference and phone they present
    Given the caller is:
      | role  |
      | guest |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | email           | phone        |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference | phone | party_size |
      | CNFRMD22  | +33612345678 | 6          |
    Then the output is:
      | reference | state     | party_size |
      | CNFRMD22  | CONFIRMED | 6          |

  Scenario Outline: A guest who does not present the contact of the booking cannot change it
    Given the caller is:
      | role  |
      | guest |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | email           | phone        |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference | email   | phone   | party_size |
      | CNFRMD22  | <email> | <phone> | 6          |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden":
      | reference |
      | CNFRMD22  |
    And the operation emits no event

    Examples:
      | email           | phone        |
      |                 |              |
      | eve@example.com |              |
      |                 | +33600000000 |

  Scenario: A guest who may not act on a booking does not learn its state
    Given the caller is:
      | role  |
      | guest |
    And the current booking is:
      | reference | restaurant_id                        | state  | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | email           | phone        |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | SEATED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference | email           | party_size |
      | CNFRMD22  | eve@example.com | 6          |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"
    And the operation emits no event

  Scenario: Staff with no restaurant cannot change a booking
    Given the caller is:
      | role  |
      | staff |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | email           | phone        |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference | party_size |
      | CNFRMD22  | 6          |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"
    And the operation emits no event

  Scenario: Staff of another restaurant cannot change a booking by presenting its contact
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 7c9e6679-7425-40de-944b-e07fc1f90ae7 |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | email           | phone        |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference | email           | phone        | party_size |
      | CNFRMD22  | ada@example.com | +33612345678 | 6          |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"
    And the operation emits no event

  Scenario: A guest's contact lets them change only the booking of the reference they present
    Given the caller is:
      | role  |
      | guest |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | email           | phone        |
      | FRBDDN22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference | email           | phone        | party_size |
      | CNFRMD22  | ada@example.com | +33612345678 | 6          |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"
    And the operation emits no event

  Scenario Outline: A presented email or phone that is not valid is rejected
    Given the caller is:
      | role  |
      | guest |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              |
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
