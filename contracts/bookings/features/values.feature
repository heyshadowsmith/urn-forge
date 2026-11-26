Feature: The values of the contract
  # Each rule of an answer, an event or a refusal, broken on a value of its own.

  Scenario: A confirmation with a deposit and its terms is accepted
    When I check a "confirmation" with:
      | reference | restaurant_id                        | status    | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | deposit_per_guest | currency |
      | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 8          | 120              | 16000          | 2000              | EUR      |
    Then the value is accepted

  Scenario Outline: A confirmation that breaks a rule is rejected
    When I check a "confirmation" with:
      | reference   | restaurant_id   | status   | starts_at   | local_date   | local_time   | time_zone   | party_size   | duration_minutes   | deposit_amount   | deposit_per_guest   | currency   |
      | <reference> | <restaurant_id> | <status> | <starts_at> | <local_date> | <local_time> | <time_zone> | <party_size> | <duration_minutes> | <deposit_amount> | <deposit_per_guest> | <currency> |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                 | definition        | reference | restaurant_id                        | status    | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | deposit_amount | deposit_per_guest | currency |
      | const                | status            | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | SEATED    | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 8          | 120              | 16000          | 2000              | EUR      |
      | minimum              | duration_minutes  | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 8          | 0                | 16000          | 2000              | EUR      |
      | exclusiveMinimum     | deposit_amount    | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 8          | 120              | 0              | 2000              | EUR      |
      | exclusiveMinimum     | deposit_per_guest | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 8          | 120              | 0              | 0                 | EUR      |
      | pattern              | currency          | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 8          | 120              | 16000          | 2000              | eur      |
      | pattern              | time_zone         | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Paris time   | 8          | 120              | 16000          | 2000              | EUR      |
      | deposit_has_terms    | confirmation      | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 8          | 120              | 16000          | 2000              |          |
      | deposit_is_per_guest | confirmation      | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 8          | 120              | 14000          | 2000              | EUR      |
      | required             | confirmation      |           | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 8          | 120              | 16000          | 2000              | EUR      |
      | local_start_is_starts_at | confirmation  | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T03:00:00Z | 2026-12-24 | 19:30      | Europe/Paris | 8          | 120              | 16000          | 2000              | EUR      |
      | local_start_is_starts_at | confirmation  | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T19:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 8          | 120              | 16000          | 2000              | EUR      |
      | local_start_is_starts_at | confirmation  | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-25 | 19:30      | Europe/Paris | 8          | 120              | 16000          | 2000              | EUR      |
      | local_start_is_starts_at | confirmation  | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Atlantis | 8       | 120              | 16000          | 2000              | EUR      |

  Scenario Outline: A booking that breaks a rule is rejected
    When I check a "booking" with:
      | reference   | restaurant_id   | state   | starts_at   | local_date   | local_time   | time_zone   | party_size   | duration_minutes   | refund_amount   | cancelled_at   |
      | <reference> | <restaurant_id> | <state> | <starts_at> | <local_date> | <local_time> | <time_zone> | <party_size> | <duration_minutes> | <refund_amount> | <cancelled_at> |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition    | reference | restaurant_id                        | state     | starts_at            | local_date | local_time | time_zone    | party_size | duration_minutes | refund_amount | cancelled_at              |
      | pattern  | reference     | abcdefgh  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              |               |                           |
      | required | booking       | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          |                  |               |                           |
      | minimum  | refund_amount | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CANCELLED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | -1            | 2026-11-20T08:00:00Z      |
      | format   | cancelled_at  | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CANCELLED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 0             | 20 Nov 2026               |
      | in_utc   | cancelled_at  | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CANCELLED | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris | 4          | 120              | 0             | 2026-11-20T09:00:00+01:00 |
      | local_start_is_starts_at | booking | ABCDEFGH | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-26T18:30:00Z | 2026-12-24 | 19:30 | Europe/Paris | 4 | 120 | | |
      | local_start_is_starts_at | booking | ABCDEFGH | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-07-14T18:30:00Z | 2026-07-14 | 19:30 | Europe/Paris | 4 | 120 | | |
      | local_start_is_starts_at | booking | ABCDEFGH | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2026-12-24T18:30:30Z | 2026-12-24 | 19:30 | Europe/Paris | 4 | 120 | | |
      | local_start_is_starts_at | booking | ABCDEFGH | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 2027-03-28T01:30:00Z | 2027-03-28 | 02:30 | Europe/Paris | 4 | 120 | | |

  Scenario Outline: A booking whose starts_at is its local date and time in its time zone is accepted
    When I check a "booking" with:
      | reference | restaurant_id                        | state     | starts_at   | local_date   | local_time   | time_zone   | party_size | duration_minutes |
      | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | <starts_at> | <local_date> | <local_time> | <time_zone> | 4          | 120              |
    Then the value is accepted

    Examples:
      | starts_at            | local_date | local_time | time_zone        |
      | 2026-12-24T18:30:00Z | 2026-12-24 | 19:30      | Europe/Paris     |
      | 2026-07-14T17:30:00Z | 2026-07-14 | 19:30      | Europe/Paris     |
      | 2026-12-24T23:15:00Z | 2026-12-25 | 00:15      | Europe/Paris     |
      | 2027-03-28T01:00:00Z | 2027-03-28 | 03:00      | Europe/Paris     |
      | 2026-12-25T00:30:00Z | 2026-12-24 | 19:30      | America/New_York |
      | 2026-12-24T14:00:00Z | 2026-12-24 | 19:30      | Asia/Kolkata     |
      | 2026-12-24T19:30:00Z | 2026-12-24 | 19:30      | UTC              |

  Scenario Outline: An event that breaks a rule is rejected
    When I check a "booking_event" with:
      | event_id   | event_type   | occurred_at   | reference   | restaurant_id   | state   | party_size   | local_date   | local_time   | time_zone   | guest_id   |
      | <event_id> | <event_type> | <occurred_at> | <reference> | <restaurant_id> | <state> | <party_size> | <local_date> | <local_time> | <time_zone> | <guest_id> |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition    | event_id                             | event_type     | occurred_at               | reference | restaurant_id                        | state     | party_size | local_date | local_time | time_zone    | guest_id                             |
      | pattern  | event_id      | event-1                              | BookingCreated | 2026-11-22T10:00:00Z      | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 4          | 2026-12-24 | 19:30      | Europe/Paris | a8098c1a-f86e-41da-bd5c-00c04fd430c8 |
      | enum     | event_type    | 16fd2706-8baf-433b-82eb-8c7fed5c9b0e | BookingLost    | 2026-11-22T10:00:00Z      | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 4          | 2026-12-24 | 19:30      | Europe/Paris | a8098c1a-f86e-41da-bd5c-00c04fd430c8 |
      | format   | occurred_at   | 16fd2706-8baf-433b-82eb-8c7fed5c9b0e | BookingCreated | now                       | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 4          | 2026-12-24 | 19:30      | Europe/Paris | a8098c1a-f86e-41da-bd5c-00c04fd430c8 |
      | in_utc   | occurred_at   | 16fd2706-8baf-433b-82eb-8c7fed5c9b0e | BookingCreated | 2026-11-22T11:00:00+01:00 | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 4          | 2026-12-24 | 19:30      | Europe/Paris | a8098c1a-f86e-41da-bd5c-00c04fd430c8 |
      | pattern  | guest_id      | 16fd2706-8baf-433b-82eb-8c7fed5c9b0e | BookingCreated | 2026-11-22T10:00:00Z      | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 4          | 2026-12-24 | 19:30      | Europe/Paris | ada@example.com                      |
      | required | booking_event | 16fd2706-8baf-433b-82eb-8c7fed5c9b0e | BookingCreated | 2026-11-22T10:00:00Z      | ABCDEFGH  | 3f2504e0-4f89-41d3-9a0c-0305e82c3301 | CONFIRMED | 4          | 2026-12-24 | 19:30      | Europe/Paris |                                      |

  Scenario Outline: A refusal for no availability that breaks a rule is rejected
    When I check a "no_availability" with:
      | local_date   | local_time   | time_zone   | party_size   | alternatives   |
      | <local_date> | <local_time> | <time_zone> | <party_size> | <alternatives> |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                 | definition      | local_date | local_time | time_zone    | party_size | alternatives                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
      | required             | no_availability | 2026-12-24 | 20:00      |              | 4          | []                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
      | required             | alternative     | 2026-12-24 | 20:00      | Europe/Paris | 4          | [{"starts_at": "2026-12-24T18:00:00Z", "local_date": "2026-12-24"}]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
      | maxItems             | alternatives    | 2026-12-24 | 20:00      | Europe/Paris | 4          | [{"starts_at": "2026-12-24T18:00:00Z", "local_date": "2026-12-24", "local_time": "17:00", "party_size": 4}, {"starts_at": "2026-12-24T18:00:00Z", "local_date": "2026-12-24", "local_time": "18:00", "party_size": 4}, {"starts_at": "2026-12-24T18:00:00Z", "local_date": "2026-12-24", "local_time": "19:00", "party_size": 4}, {"starts_at": "2026-12-24T18:00:00Z", "local_date": "2026-12-24", "local_time": "21:00", "party_size": 4}, {"starts_at": "2026-12-24T18:00:00Z", "local_date": "2026-12-24", "local_time": "21:15", "party_size": 4}, {"starts_at": "2026-12-24T18:00:00Z", "local_date": "2026-12-24", "local_time": "22:00", "party_size": 4}] |
      | each_at_another_time | alternatives    | 2026-12-24 | 20:00      | Europe/Paris | 4          | [{"starts_at": "2026-12-24T18:00:00Z", "local_date": "2026-12-24", "local_time": "19:00", "party_size": 4}, {"starts_at": "2026-12-24T18:00:00Z", "local_date": "2026-12-24", "local_time": "19:00", "party_size": 4}]                                                                                                                                                                                                                                                                                                                                                                                                                                             |

  Scenario Outline: A refusal for no availability whose alternative is not at its local time is rejected
    When I check a "no_availability" with:
      | local_date | local_time | time_zone    | party_size | alternatives   |
      | 2026-12-24 | 23:45      | Europe/Paris | 4          | <alternatives> |
    Then the value is rejected by "alternatives_at_their_local_time" of "no_availability"

    Examples:
      | alternatives                                                                                                                                                                                     |
      | [{"starts_at": "2026-12-24T23:30:00Z", "local_date": "2026-12-24", "local_time": "00:30", "party_size": 4}]                                                                                    |
      | [{"starts_at": "2026-12-24T21:45:00Z", "local_date": "2026-12-24", "local_time": "22:45", "party_size": 4}, {"starts_at": "2026-12-24T22:00:00Z", "local_date": "2026-12-24", "local_time": "22:00", "party_size": 4}] |

  Scenario Outline: An object that leaves out a required part is rejected
    When I check a "<definition>" with:
      | <property> |
      |            |
    Then the value is rejected by "required" of "<definition>"

    Examples:
      | definition                 | property        |
      | booked                     | confirmation    |
      | repeated                   | confirmation    |
      | booking_change             | booking         |
      | cancelled                  | booking         |
      | already_cancelled          | cancellation    |
      | cancellation               | reference       |
      | invalid_request            | idempotency_key |
      | outside_booking_window     | starts_at       |
      | deposit_required           | party_size      |
      | payment_declined           | deposit_token   |
      | party_too_large_for_online | party_size      |
      | booking_not_found          | reference       |
      | invalid_state              | reference       |
      | change_deadline_passed     | reference       |
      | forbidden                  | reference       |
