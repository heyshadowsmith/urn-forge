@urn:corpus:bookings:booking:operation:get_booking
Feature: Read a booking

  Scenario: Staff read a booking of their own restaurant, with its time zone
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | email           |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          | ada@example.com |
    When I run the operation with:
      | reference |
      | CNFRMD22  |
    Then the output is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 80.00          |

  Scenario: A guest reads a booking whose reference and email they present
    Given the caller is:
      | role  |
      | guest |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | email           | phone        |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference | email           |
      | CNFRMD22  | ada@example.com |
    Then the output is:
      | reference | state     |
      | CNFRMD22  | CONFIRMED |

  Scenario: A guest reads a booking whose reference and phone they present
    Given the caller is:
      | role  |
      | guest |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | email           | phone        |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference | phone        |
      | CNFRMD22  | +33612345678 |
    Then the output is:
      | reference | state     |
      | CNFRMD22  | CONFIRMED |

  Scenario: A reference that is not 8 characters from the published alphabet is rejected
    Given the caller is:
      | role  |
      | guest |
    And there is no current booking
    When I run the operation with:
      | reference |
      | BOOKING1  |
    Then the input is rejected on "reference"

  Scenario: An unknown reference is not found
    Given the caller is:
      | role  |
      | guest |
    And there is no current booking
    When I run the operation with:
      | reference | email           |
      | XXXXXXXX  | ada@example.com |
    Then the operation fails with "urn:corpus:bookings:booking:error:booking_not_found":
      | reference |
      | XXXXXXXX  |

  Scenario Outline: A guest who does not present the contact of the booking is forbidden
    Given the caller is:
      | role  |
      | guest |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | email           | phone        |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference | email   | phone   |
      | CNFRMD22  | <email> | <phone> |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden":
      | reference |
      | CNFRMD22  |

    Examples:
      | email           | phone        |
      |                 |              |
      | eve@example.com |              |
      |                 | +33600000000 |

  Scenario: A guest who presents an email cannot read a booking that holds none
    Given the caller is:
      | role  |
      | guest |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | phone        |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | +33612345678 |
    When I run the operation with:
      | reference | email           |
      | CNFRMD22  | ada@example.com |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"

  Scenario: Staff with no restaurant are forbidden
    Given the caller is:
      | role  |
      | staff |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              |
    When I run the operation with:
      | reference |
      | CNFRMD22  |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"

  Scenario: Staff cannot read a booking of another restaurant
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes |
      | FRBDDN22  | 7c9e6679-7425-40de-944b-e07fc1f90ae7 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              |
    When I run the operation with:
      | reference |
      | FRBDDN22  |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden":
      | reference |
      | FRBDDN22  |

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

  Scenario: Staff of another restaurant cannot read a booking by presenting its contact
    Given the caller is:
      | role  | restaurant_id                        |
      | staff | 7c9e6679-7425-40de-944b-e07fc1f90ae7 |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | email           | phone        |
      | CNFRMD22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference | email           | phone        |
      | CNFRMD22  | ada@example.com | +33612345678 |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"

  Scenario: A guest's contact opens only the booking of the reference they present
    Given the caller is:
      | role  |
      | guest |
    And the current booking is:
      | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | email           | phone        |
      | FRBDDN22  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | ada@example.com | +33612345678 |
    When I run the operation with:
      | reference | email           | phone        |
      | CNFRMD22  | ada@example.com | +33612345678 |
    Then the operation fails with "urn:corpus:bookings:booking:error:forbidden"
