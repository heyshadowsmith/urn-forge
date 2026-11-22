@urn:corpus:bookings:booking:operation:cancel_booking
Feature: Cancel a booking

  Scenario Outline: A confirmed booking is cancelled; the deposit comes back in full only 24 hours or more before the start
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | <local_date> | <local_time> | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference |
      | CNFRMD22  |
    Then the output is:
      | reference | state     | refund_amount   | cancelled_at         |
      | CNFRMD22  | CANCELLED | <refund_amount> | 2026-11-22T10:00:00Z |
    And the operation emits "urn:corpus:bookings:booking:event:booking_cancelled":
      | event_id                             | reference | restaurant_id                        | state     | party_size | local_date | local_time | time_zone    | occurred_at          | guest_id                             |
      | 16fd2706-8baf-433b-82eb-8c7fed5c9b0e | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CANCELLED | 4          | <local_date> | <local_time> | Europe/Paris | 2026-11-22T10:00:00Z | a8098c1a-f86e-41da-bd5c-00c04fd430c8 |

    Examples:
      | local_date | local_time | refund_amount |
      | 2026-12-24 | 19:30      | 80.00         |
      | 2026-11-23 | 11:00      | 80.00         |
      | 2026-11-23 | 10:45      | 0.00          |
      | 2026-11-22 | 16:00      | 0.00          |

  Scenario: A reference that is not valid is rejected
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference |
      | abc       |
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
      | FRBDDN22  | 7c9e6679-7425-40de-944b-e07fc1f90ae7 | CONFIRMED | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference |
      | FRBDDN22  |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"
    And the operation emits no event

  Scenario: A second cancellation gives the first answer again, with no new event
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CANCELLED | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference |
      | CNFRMD22  |
    Then the output is:
      | reference | state     | refund_amount | cancelled_at         |
      | CNFRMD22  | CANCELLED | 80.00         | 2026-11-20T08:00:00Z |
    And the operation emits no "urn:corpus:bookings:booking:event:booking_cancelled"
    And the operation emits no event

  Scenario Outline: A seated, completed or no-show booking cannot be cancelled
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
      | state     |
      | SEATED    |
      | COMPLETED |
      | NO_SHOW   |

  Scenario: A booking that starts in less than 2 hours cannot be cancelled
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-11-22 | 12:00      | Europe/Paris | 4          | 120              | 80.00          |
    When I run the operation with:
      | reference |
      | CNFRMD22  |
    Then the operation fails with "urn:corpus:bookings:booking:error:change_deadline_passed"
    And the operation emits no event

  Scenario: A guest cancels a booking whose reference and email they present
    Given the caller is:
      | role  |
      | guest |
    And the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | email           | phone        |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference | email |
      | CNFRMD22  | ada@example.com |
    Then the output is:
      | reference | state     | refund_amount |
      | CNFRMD22  | CANCELLED | 80.00         |

  Scenario: A guest cancels a booking whose reference and phone they present
    Given the caller is:
      | role  |
      | guest |
    And the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | email           | phone        |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference | phone |
      | CNFRMD22  | +33612345678 |
    Then the output is:
      | reference | state     | refund_amount |
      | CNFRMD22  | CANCELLED | 80.00         |

  Scenario Outline: A guest who does not present the contact of the booking cannot cancel it
    Given the caller is:
      | role  |
      | guest |
    And the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | email           | phone        |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference | email   | phone   |
      | CNFRMD22  | <email> | <phone> |
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
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | email           | phone        |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | SEATED    | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference | email           |
      | CNFRMD22  | eve@example.com |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"
    And the operation emits no event

  Scenario: Staff with no restaurant cannot cancel a booking
    Given the caller is:
      | role  |
      | staff |
    And the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | email           | phone        |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference |
      | CNFRMD22  |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"
    And the operation emits no event

  Scenario: Staff of another restaurant cannot cancel a booking by presenting its contact
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 7c9e6679-7425-40de-944b-e07fc1f90ae7 |
    And the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | email           | phone        |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference | email           | phone        |
      | CNFRMD22  | ada@example.com | +33612345678 |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"
    And the operation emits no event

  Scenario: A guest's contact lets them cancel only the booking of the reference they present
    Given the caller is:
      | role  |
      | guest |
    And the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | email           | phone        |
      | FRBDDN22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference | email           | phone        |
      | CNFRMD22  | ada@example.com | +33612345678 |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"
    And the operation emits no event

  Scenario Outline: A presented email or phone that is not valid is rejected
    Given the caller is:
      | role  |
      | guest |
    And the current booking is:
      | reference | restaurant_id                        | state     | local_date | local_time | time_zone    | party_size | duration_minutes |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              |
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
