Feature: Cancel a booking
  # A guest presents the email or the phone of the booking; staff act on the bookings of their restaurant.

  Scenario Outline: A confirmed booking is cancelled; the deposit comes back in full only 24 hours or more before the start
    When I run "cancel_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now   | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone | stored_booking.deposit_amount |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | <now> | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        | <deposit_amount>              |
    Then the output is "cancelled":
      | cancellation                                                                                               |
      | {"reference": "ABCDEFGH", "state": "CANCELLED", "refund_amount": <refund_amount>, "cancelled_at": "<now>"} |

    Examples:
      | now                  | deposit_amount | refund_amount |
      | 2026-12-23T18:30:00Z | 14000          | 14000         |
      | 2026-12-23T18:30:01Z | 14000          | 0             |
      | 2026-12-24T16:30:00Z | 14000          | 0             |
      | 2026-11-22T10:00:00Z |                | 0             |

  Scenario: A second cancellation gives the first answer again, with no record or event, even after the deadline
    When I run "cancel_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone | stored_booking.deposit_amount | stored_booking.refund_amount | stored_booking.cancelled_at |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T18:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CANCELLED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        | 14000                         | 14000                        | 2026-11-20T08:00:00Z        |
    Then the output is "already_cancelled":
      | cancellation                                                                                                    |
      | {"reference": "ABCDEFGH", "state": "CANCELLED", "refund_amount": 14000, "cancelled_at": "2026-11-20T08:00:00Z"} |

  Scenario Outline: A seated, completed or no-show booking cannot be cancelled
    When I run "cancel_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | <state>              | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "invalid_state":
      | reference | state   |
      | ABCDEFGH  | <state> |

    Examples:
      | state     |
      | SEATED    |
      | COMPLETED |
      | NO_SHOW   |

  Scenario: A booking that starts in less than 2 hours cannot be cancelled
    When I run "cancel_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-12-24T16:30:01Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "change_deadline_passed":
      | reference |
      | ABCDEFGH  |

  Scenario: An unknown reference is not found
    When I run "cancel_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  |
      | ABCDEFGH  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-22T10:00:00Z |
    Then the output is "booking_not_found":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to staff of another restaurant
    When I run "cancel_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | staff       | 9b2c1f00-1111-4222-8333-444455556666 | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to staff of another restaurant who present its contact
    When I run "cancel_booking" with:
      | reference | caller.role | caller.restaurant_id                 | email           | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | staff       | 9b2c1f00-1111-4222-8333-444455556666 | ada@example.com | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to a guest who presents another email
    When I run "cancel_booking" with:
      | reference | caller.role | email           | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | guest       | eve@example.com | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to a guest who presents no contact
    When I run "cancel_booking" with:
      | reference | caller.role | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | guest       | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A booking is forbidden to a guest who presents an email, of a booking with none
    When I run "cancel_booking" with:
      | reference | caller.role | email           | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.phone |
      | ABCDEFGH  | guest       | ada@example.com | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | +447911123456        |
    Then the output is "forbidden":
      | reference |
      | ABCDEFGH  |

  Scenario: A guest who presents the email of the booking may act on it
    When I run "cancel_booking" with:
      | reference | caller.role | email           | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | guest       | ada@example.com | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "cancelled"

  Scenario: A guest who presents the phone of the booking may act on it
    When I run "cancel_booking" with:
      | reference | caller.role | phone         | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ABCDEFGH  | guest       | +447911123456 | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the output is "cancelled"

  Scenario: A request that names another booking than the one loaded is rejected
    When I run "cancel_booking" with:
      | reference | caller.role | caller.restaurant_id                 | now                  | stored_booking.reference | stored_booking.restaurant_id         | stored_booking.state | stored_booking.starts_at | stored_booking.local_date | stored_booking.local_time | stored_booking.time_zone | stored_booking.party_size | stored_booking.duration_minutes | stored_booking.email | stored_booking.phone |
      | ZZZZZZZZ  | staff       | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | 2026-11-22T10:00:00Z | ABCDEFGH                 | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED            | 2026-12-24T18:30:00Z     | 2026-12-24                | 19:30                     | Europe/Paris             | 4                         | 120                             | ada@example.com      | +447911123456        |
    Then the input is rejected by "names_the_booking" of "booking_ref"
