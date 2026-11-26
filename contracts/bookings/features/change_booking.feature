Feature: Change a booking
  # A guest presents the email or the phone of the booking; staff act on the bookings of their restaurant.
  # The deadline reads the start as stored, before the change.

  Scenario Outline: A confirmed booking 2 hours or more away is changed, with one BookingChanged event
    When I run "change_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now   | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone | starts_at   | local_date   | local_time   | party_size   | deposit_token   |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | <now> | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        | <starts_at> | <local_date> | <local_time> | <party_size> | <deposit_token> |
    Then the output is "booking_change"

    Examples:
      | now                  | starts_at            | local_date | local_time | party_size | deposit_token |
      | 2026-11-22T10:00:00Z | 2026-12-25T18:30:00Z | 2026-12-25 |            |            |               |
      | 2026-11-22T10:00:00Z | 2026-12-24T19:00:00Z |            | 20:00      | 6          |               |
      | 2026-11-22T10:00:00Z |                      |            |            | 12         | tok_visa_4242 |
      | 2026-12-24T16:30:00Z |                      |            |            | 2          |               |

  Scenario Outline: A booking that is not CONFIRMED cannot change
    When I run "change_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | party_size | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone | stored_booking.refund_amount | stored_booking.cancelled_at |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-22T10:00:00Z | 5          | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | <state>              | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        | <refund_amount>              | <cancelled_at>              |
    Then the output is "invalid_state":
      | reference | state   |
      | ABCDEFGH  | <state> |

    Examples:
      | state     | refund_amount | cancelled_at         |
      | SEATED    |               |                      |
      | COMPLETED |               |                      |
      | CANCELLED | 0             | 2026-11-20T08:00:00Z |
      | NO_SHOW   |               |                      |

  Scenario: A booking that starts in less than 2 hours cannot change
    When I run "change_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | party_size | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T16:30:01Z | 5          | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "change_deadline_passed":
      | reference |
      | ABCDEFGH  |

  Scenario: A change to 13 or more guests is refused online
    When I run "change_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | party_size | deposit_token | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-22T10:00:00Z | 13         | tok_visa_4242 | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "party_too_large_for_online":
      | party_size |
      | 13         |

  Scenario: A change to 7 or more guests with no deposit token is refused
    When I run "change_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | party_size | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-22T10:00:00Z | 7          | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "deposit_required":
      | party_size |
      | 7          |

  Scenario Outline: A move to a start less than 2 hours or more than 90 days away is refused
    When I run "change_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | starts_at   | local_date   | local_time   | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-22T10:00:00Z | <starts_at> | <local_date> | <local_time> | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "outside_booking_window":
      | starts_at   |
      | <starts_at> |

    Examples:
      | starts_at            | local_date | local_time |
      | 2026-11-22T11:00:00Z | 2026-11-22 | 12:00      |
      | 2027-03-01T18:30:00Z | 2027-03-01 | 19:30      |

  Scenario Outline: A move gives starts_at with the local date or time, and starts_at comes only with a move
    When I run "change_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone | starts_at   | local_date   | local_time   |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        | <starts_at> | <local_date> | <local_time> |
    Then the input is rejected by "move_has_starts_at" of "change_request"

    Examples:
      | starts_at            | local_date | local_time |
      | 2026-12-25T18:30:00Z |            |            |
      |                      | 2026-12-25 |            |
      |                      |            | 20:00      |

  Scenario Outline: A move whose starts_at is not the new local date and time in the zone of the booking is rejected
    # The local date or time that the request leaves out is the stored one.
    When I run "change_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone | starts_at   | local_date   | local_time   |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        | <starts_at> | <local_date> | <local_time> |
    Then the input is rejected by "move_is_at_its_local_time" of "change_request"

    Examples:
      | starts_at            | local_date | local_time |
      | 2026-12-25T03:00:00Z | 2026-12-25 |            |
      | 2026-12-24T20:00:00Z |            | 20:00      |
      | 2026-12-24T18:30:00Z | 2026-12-25 |            |
      | 2026-12-24T19:00:00Z | 2026-12-25 | 20:00      |

  Scenario Outline: A move in the zone of the booking, across a change of its offset, is changed
    When I run "change_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone | starts_at   | local_date   | local_time   |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2027-01-10T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2027-03-01T18:30:00Z     | 2027-03-01                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        | <starts_at> | <local_date> | <local_time> |
    Then the output is "booking_change"

    Examples:
      | starts_at            | local_date | local_time |
      | 2027-03-28T17:30:00Z | 2027-03-28 |            |
      | 2027-03-27T23:15:00Z | 2027-03-28 | 00:15      |
      | 2027-03-28T01:00:00Z | 2027-03-28 | 03:00      |

  Scenario: An unknown reference is not found
    When I run "change_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-22T10:00:00Z |
    Then the output is "booking_not_found":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to staff of another restaurant
    When I run "change_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | staff       | 9b2c1f00-1111-4222-8333-444455556666 | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to staff of another restaurant who present its contact
    When I run "change_booking" with:
      | reference | caller.role | caller.restaurant_id                 | email           | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | staff       | 9b2c1f00-1111-4222-8333-444455556666 | ada@example.com | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to a guest who presents another email
    When I run "change_booking" with:
      | reference | caller.role | email           | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | guest       | eve@example.com | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to a guest who presents no contact
    When I run "change_booking" with:
      | reference | caller.role | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | guest       | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to a guest who presents an email, of a booking with none
    When I run "change_booking" with:
      | reference | caller.role | email           | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.phone |
      | ABCDEFGH  | guest       | ada@example.com | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A guest who presents the email of the booking may act on it
    When I run "change_booking" with:
      | reference | caller.role | email           | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | guest       | ada@example.com | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "booking_change"

  Scenario: A guest who presents the phone of the booking may act on it
    When I run "change_booking" with:
      | reference | caller.role | phone         | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | guest       | +447911123456 | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "booking_change"

  Scenario: A request that names another booking than the one loaded is rejected
    When I run "change_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ZZZZZZZZ  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the input is rejected by "names_the_booking" of "change_request"

  Scenario: A request that leaves out a required part is rejected
    When I run "change_booking" with:
      | reference | caller.role |
      | ABCDEFGH  | guest       |
    Then the input is rejected by "required" of "change_request"
