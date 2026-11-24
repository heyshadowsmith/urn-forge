Feature: Seat a booking

  Scenario: A confirmed booking is seated
    When I run "seat_booking" with:
      | reference | stored_booking.reference | stored_booking.party_size | stored_booking.state | stored_booking.starts_at | stored_booking.ends_at | stored_booking.contact      |
      | ABCDEFGH  | ABCDEFGH                 | 4                         | confirmed            | 2026-11-24T19:00:00Z     | 2026-11-24T21:00:00Z   | {"email": "ada@example.com"} |
    Then the output is "booking":
      | reference | party_size | state  |
      | ABCDEFGH  | 4          | seated |

  Scenario Outline: A booking that is not confirmed is refused
    When I run "seat_booking" with:
      | reference | stored_booking.reference | stored_booking.party_size | stored_booking.state | stored_booking.starts_at | stored_booking.ends_at | stored_booking.contact.email |
      | ABCDEFGH  | ABCDEFGH                 | 4                         | <state>              | 2026-11-24T19:00:00Z     | 2026-11-24T21:00:00Z   | ada@example.com              |
    Then the output is "invalid_state":
      | reference | state   |
      | ABCDEFGH  | <state> |

    Examples:
      | state     |
      | seated    |
      | completed |
      | cancelled |

  Scenario: A request that names another booking is rejected
    When I run "seat_booking" with:
      | reference | stored_booking.reference | stored_booking.party_size | stored_booking.state | stored_booking.starts_at | stored_booking.ends_at | stored_booking.contact.email |
      | ZZZZZZZZ  | ABCDEFGH                 | 4                         | confirmed            | 2026-11-24T19:00:00Z     | 2026-11-24T21:00:00Z   | ada@example.com              |
    Then the input is rejected by "names_the_booking" of "seat_request"

  Scenario Outline: A booking that breaks a rule is rejected
    When I check a "booking" with:
      | reference   | party_size   | state   | deposit   | starts_at   | ends_at   | note   | tables   | contact.email | contact.phone | dishes   | total   |
      | <reference> | <party_size> | <state> | <deposit> | <starts_at> | <ends_at> | <note> | <tables> | <email>       | <phone>       | <dishes> | <total> |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                     | definition   | reference | party_size | state     | deposit | starts_at            | ends_at              | note                      | tables          | email           | phone | dishes                               | total |
      | required                 | booking      |           | 4          | confirmed |         | 2026-11-24T19:00:00Z | 2026-11-24T21:00:00Z |                           |                 | ada@example.com |       |                                      |       |
      | pattern                  | reference    | abc       | 4          | confirmed |         | 2026-11-24T19:00:00Z | 2026-11-24T21:00:00Z |                           |                 | ada@example.com |       |                                      |       |
      | minimum                  | party_size   | ABCDEFGH  | 0          | confirmed |         | 2026-11-24T19:00:00Z | 2026-11-24T21:00:00Z |                           |                 | ada@example.com |       |                                      |       |
      | maximum                  | party_size   | ABCDEFGH  | 13         | confirmed | 100     | 2026-11-24T19:00:00Z | 2026-11-24T21:00:00Z |                           |                 | ada@example.com |       |                                      |       |
      | enum                     | state        | ABCDEFGH  | 4          | lost      |         | 2026-11-24T19:00:00Z | 2026-11-24T21:00:00Z |                           |                 | ada@example.com |       |                                      |       |
      | at_least                 | deposit      | ABCDEFGH  | 4          | confirmed | -1      | 2026-11-24T19:00:00Z | 2026-11-24T21:00:00Z |                           |                 | ada@example.com |       |                                      |       |
      | format                   | starts_at    | ABCDEFGH  | 4          | confirmed |         | 2026-11-24 19:00     | 2026-11-24T21:00:00Z |                           |                 | ada@example.com |       |                                      |       |
      | format                   | ends_at      | ABCDEFGH  | 4          | confirmed |         | 2026-11-24T19:00:00Z | 24/11/2026           |                           |                 | ada@example.com |       |                                      |       |
      | maxLength                | note         | ABCDEFGH  | 4          | confirmed |         | 2026-11-24T19:00:00Z | 2026-11-24T21:00:00Z | A table by the window too |                 | ada@example.com |       |                                      |       |
      | maxItems                 | tables       | ABCDEFGH  | 4          | confirmed |         | 2026-11-24T19:00:00Z | 2026-11-24T21:00:00Z |                           | [1, 2, 3, 4, 5] | ada@example.com |       |                                      |       |
      | uniqueItems              | tables       | ABCDEFGH  | 4          | confirmed |         | 2026-11-24T19:00:00Z | 2026-11-24T21:00:00Z |                           | [1, 1]          | ada@example.com |       |                                      |       |
      | minimum                  | table_number | ABCDEFGH  | 4          | confirmed |         | 2026-11-24T19:00:00Z | 2026-11-24T21:00:00Z |                           | [0]             | ada@example.com |       |                                      |       |
      | required                 | contact      | ABCDEFGH  | 4          | confirmed |         | 2026-11-24T19:00:00Z | 2026-11-24T21:00:00Z |                           |                 |                 | 555   |                                      |       |
      | pattern                  | email        | ABCDEFGH  | 4          | confirmed |         | 2026-11-24T19:00:00Z | 2026-11-24T21:00:00Z |                           |                 | ada             |       |                                      |       |
      | large_party_pays_deposit | booking      | ABCDEFGH  | 8          | confirmed |         | 2026-11-24T19:00:00Z | 2026-11-24T21:00:00Z |                           |                 | ada@example.com |       |                                      |       |
      | ends_after_start         | booking      | ABCDEFGH  | 4          | confirmed |         | 2026-11-24T19:00:00Z | 2026-11-24T19:15:00Z |                           |                 | ada@example.com |       |                                      |       |
      | total_is_the_dishes      | booking      | ABCDEFGH  | 4          | confirmed |         | 2026-11-24T19:00:00Z | 2026-11-24T21:00:00Z |                           |                 | ada@example.com |       | [{"course": "main", "amount": 1500}] | 1000  |
      | enum                     | course       | ABCDEFGH  | 4          | confirmed |         | 2026-11-24T19:00:00Z | 2026-11-24T21:00:00Z |                           |                 | ada@example.com |       | [{"course": "drink", "amount": 500}] | 500   |
      | minimum                  | amount       | ABCDEFGH  | 4          | confirmed |         | 2026-11-24T19:00:00Z | 2026-11-24T21:00:00Z |                           |                 | ada@example.com |       | [{"course": "main", "amount": -5}]   | -5    |
      | required                 | dish         | ABCDEFGH  | 4          | confirmed |         | 2026-11-24T19:00:00Z | 2026-11-24T21:00:00Z |                           |                 | ada@example.com |       | [{"course": "main"}]                 |       |

  Scenario: A request with no booking is rejected
    When I run "seat_booking" with:
      | reference |
      | ABCDEFGH  |
    Then the input is rejected by "required" of "seat_request"

  Scenario: A refusal with no state is rejected
    When I check an "invalid_state" with:
      | reference |
      | ABCDEFGH  |
    Then the value is rejected by "required" of "invalid_state"

  Scenario: A booking with a deposit and dishes is accepted
    When I check a "booking" with:
      | reference | party_size | state     | deposit | starts_at            | ends_at              | contact.email   | dishes                                                                  | total |
      | ABCDEFGH  | 8          | confirmed | 5000    | 2026-11-24T19:00:00Z | 2026-11-24T21:00:00Z | ada@example.com | [{"course": "starter", "amount": 800}, {"course": "main", "amount": 2200}] | 3000  |
    Then the value is accepted
