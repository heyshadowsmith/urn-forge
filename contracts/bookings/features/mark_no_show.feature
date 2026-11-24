Feature: Mark a booking whose party did not come
  # Only staff of the restaurant of the booking mark it.

  Scenario: Staff mark a CONFIRMED booking NO_SHOW, with one BookingNoShow event
    When I run "mark_no_show" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T19:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "booking_change"

  Scenario Outline: A booking in another state cannot move
    When I run "mark_no_show" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone | stored_booking.refund_amount | stored_booking.cancelled_at |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T19:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | <state>              | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        | <refund_amount>              | <cancelled_at>              |
    Then the output is "invalid_state":
      | reference | state   |
      | ABCDEFGH  | <state> |

    Examples:
      | state     | refund_amount | cancelled_at         |
      | SEATED    |               |                      |
      | COMPLETED |               |                      |
      | CANCELLED | 0             | 2026-11-20T08:00:00Z |
      | NO_SHOW   |               |                      |

  Scenario Outline: A CONFIRMED booking becomes NO_SHOW from 15 minutes after its start, that edge included
    When I run "mark_no_show" with:
      | reference | caller.role | caller.restaurant_id                 | now   | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | <now> | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "booking_change"

    Examples:
      | now                  |
      | 2026-12-24T18:45:00Z |
      | 2026-12-25T02:00:00Z |

  Scenario Outline: A CONFIRMED booking cannot be marked NO_SHOW before 15 minutes after its start
    When I run "mark_no_show" with:
      | reference | caller.role | caller.restaurant_id                 | now   | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | <now> | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "invalid_state":
      | reference | state     |
      | ABCDEFGH  | CONFIRMED |

    Examples:
      | now                  |
      | 2026-12-24T18:44:59Z |
      | 2026-12-24T16:00:00Z |

  Scenario: An unknown reference is not found
    When I run "mark_no_show" with:
      | reference | caller.role | caller.restaurant_id                 | now                  |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-22T10:00:00Z |
    Then the output is "booking_not_found":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to staff of another restaurant
    When I run "mark_no_show" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | staff       | 9b2c1f00-1111-4222-8333-444455556666 | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to staff of another restaurant who present its contact
    When I run "mark_no_show" with:
      | reference | caller.role | caller.restaurant_id                 | email           | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | staff       | 9b2c1f00-1111-4222-8333-444455556666 | ada@example.com | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to a guest who presents another email
    When I run "mark_no_show" with:
      | reference | caller.role | email           | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | guest       | eve@example.com | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to a guest who presents no contact
    When I run "mark_no_show" with:
      | reference | caller.role | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | guest       | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to a guest with its contact and the id of its restaurant
    When I run "mark_no_show" with:
      | reference | caller.role | caller.restaurant_id                 | email           | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | guest       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | ada@example.com | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A request that names another booking than the one loaded is rejected
    When I run "mark_no_show" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ZZZZZZZZ  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the input is rejected by "names_the_booking" of "booking_ref"
