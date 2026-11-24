Feature: Read a booking
  # The input holds the booking as the shell loaded it (absent when no booking has the reference), the caller and the time of the call.

  Scenario: Staff read a booking of their own restaurant, as it is stored
    When I run "get_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "booking":
      | reference | restaurant_id                        | state     | time_zone    |
      | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | Europe/Paris |

  Scenario: An unknown reference is not found
    When I run "get_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-22T10:00:00Z |
    Then the output is "booking_not_found":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to staff of another restaurant
    When I run "get_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | staff       | 9b2c1f00-1111-4222-8333-444455556666 | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to staff of another restaurant who present its contact
    When I run "get_booking" with:
      | reference | caller.role | caller.restaurant_id                 | email           | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | staff       | 9b2c1f00-1111-4222-8333-444455556666 | ada@example.com | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to a guest who presents another email
    When I run "get_booking" with:
      | reference | caller.role | email           | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | guest       | eve@example.com | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to a guest who presents no contact
    When I run "get_booking" with:
      | reference | caller.role | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | guest       | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to a guest who presents an email, of a booking with none
    When I run "get_booking" with:
      | reference | caller.role | email           | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.phone |
      | ABCDEFGH  | guest       | ada@example.com | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A guest who presents the email of the booking may act on it
    When I run "get_booking" with:
      | reference | caller.role | email           | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | guest       | ada@example.com | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "booking"

  Scenario: A guest who presents the phone of the booking may act on it
    When I run "get_booking" with:
      | reference | caller.role | phone         | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | guest       | +447911123456 | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "booking"

  Scenario: A request that names another booking than the one loaded is rejected
    When I run "get_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ZZZZZZZZ  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the input is rejected by "names_the_booking" of "booking_ref"

  Scenario Outline: A call that leaves out a required part is rejected
    When I run "get_booking" with:
      | <column> |
      | <value>  |
    Then the input is rejected by "required" of "<definition>"

    Examples:
      | definition  | column               | value                                |
      | booking_ref | reference            | ABCDEFGH                             |
      | caller      | caller.restaurant_id | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |

  Scenario Outline: A call with a value that breaks a rule is rejected
    When I run "get_booking" with:
      | reference   | caller.role | caller.restaurant_id | now                  |
      | <reference> | <role>      | <restaurant_id>      | 2026-11-22T10:00:00Z |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                         | definition | reference | role  | restaurant_id                        |
      | pattern                      | reference  | ABCDEFGI  | staff | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
      | enum                         | role       | ABCDEFGH  | chef  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 |
      | staff_works_for_a_restaurant | caller     | ABCDEFGH  | staff |                                      |

  Scenario Outline: A stored booking that breaks a rule is rejected
    When I run "get_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | <state>              | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | <time_zone>              | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                     | definition | state     | time_zone    |
      | enum                     | state      | LOST      | Europe/Paris |
      | pattern                  | time_zone  | CONFIRMED | paris        |
      | cancellation_is_recorded | booking    | CANCELLED | Europe/Paris |
