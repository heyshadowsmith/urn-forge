Feature: The values of a claim

  Each rule of a value: the lines and receipts, the claim as it is stored, the caller and the events.
  Amounts are in cents.

  Scenario: A claim with a line of each kind is accepted
    When I check a "claim" with:
      | claim_id       | version | employee_id | manager_id | state     | purpose              | currency | total | lines                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | submitted_at         |
      | CLM-0000000123 | 2       | emp-1       | mgr-1      | SUBMITTED | Client visit in Bern | EUR      | 19600 | [{"category": "TRAVEL", "expense_date": "2026-11-02", "description": "Train to Bern", "amount": 12000, "receipt": {"sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "media_type": "application/pdf", "size_bytes": 52000}}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MILEAGE", "expense_date": "2026-11-05", "description": "Lunch", "amount": 5600, "distance_km": 80}] | 2026-11-10T09:00:00Z |
    Then the value is accepted

  Scenario: An expense 90 days before the day of the submission is accepted
    When I check a "claim" with:
      | claim_id       | version | employee_id | manager_id | state     | purpose              | currency | total | lines                                                                                         | submitted_at         |
      | CLM-0000000123 | 2       | emp-1       | mgr-1      | SUBMITTED | Client visit in Bern | EUR      | 2000  | [{"category": "MEALS", "expense_date": "2026-08-12", "description": "Lunch", "amount": 2000}] | 2026-11-10T09:00:00Z |
    Then the value is accepted

  Scenario: A line of exactly 25.00 needs no receipt
    When I check a "line" with:
      | category | expense_date | description | amount |
      | MEALS    | 2026-11-03   | Lunch       | 2500   |
    Then the value is accepted

  Scenario: A category outside the list is rejected
    When I check a "line" with:
      | category | expense_date | description | amount |
      | FUEL     | 2026-11-03   | Lunch       | 2000   |
    Then the value is rejected by "enum" of "category"

  Scenario: An expense date with a time is rejected
    When I check a "line" with:
      | category | expense_date         | description | amount |
      | MEALS    | 2026-11-03T10:00:00Z | Lunch       | 2000   |
    Then the value is rejected by "format" of "expense_date"

  Scenario: An empty description is rejected
    When I check a "line" with:
      | category | expense_date | description | amount |
      | MEALS    | 2026-11-03   | ""          | 2000   |
    Then the value is rejected by "minLength" of "description"

  Scenario: A description of 201 characters is rejected
    When I check a "line" with:
      | category | expense_date | description                                                                                                                                                                                               | amount |
      | MEALS    | 2026-11-03   | xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx | 2000   |
    Then the value is rejected by "maxLength" of "description"

  Scenario: An amount of 0.00 is rejected
    When I check a "line" with:
      | category | expense_date | description | amount |
      | MEALS    | 2026-11-03   | Lunch       | 0      |
    Then the value is rejected by "exclusiveMinimum" of "amount"

  Scenario: An amount of 10000.01 is rejected
    When I check a "line" with:
      | category | expense_date | description | amount  |
      | MEALS    | 2026-11-03   | Lunch       | 1000001 |
    Then the value is rejected by "maximum" of "amount"

  Scenario: A distance under 1 km is rejected
    When I check a "line" with:
      | category | expense_date | description | amount | distance_km |
      | MILEAGE  | 2026-11-03   | Lunch       | 2000   | 0.5         |
    Then the value is rejected by "minimum" of "distance_km"

  Scenario: A distance over 2000 km is rejected
    When I check a "line" with:
      | category | expense_date | description | amount | distance_km |
      | MILEAGE  | 2026-11-03   | Lunch       | 2000   | 2000.5      |
    Then the value is rejected by "maximum" of "distance_km"

  Scenario: A receipt hash in capitals is rejected
    When I check a "line" with:
      | category | expense_date | description | amount | receipt                                                                                                                              |
      | MEALS    | 2026-11-03   | Lunch       | 2000   | {"sha256": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "media_type": "application/pdf", "size_bytes": 52000} |
    Then the value is rejected by "pattern" of "sha256"

  Scenario: A receipt that is a GIF is rejected
    When I check a "line" with:
      | category | expense_date | description | amount | receipt                                                                                                                        |
      | MEALS    | 2026-11-03   | Lunch       | 2000   | {"sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "media_type": "image/gif", "size_bytes": 52000} |
    Then the value is rejected by "enum" of "media_type"

  Scenario: An empty receipt file is rejected
    When I check a "line" with:
      | category | expense_date | description | amount | receipt                                                                                                                          |
      | MEALS    | 2026-11-03   | Lunch       | 2000   | {"sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "media_type": "application/pdf", "size_bytes": 0} |
    Then the value is rejected by "minimum" of "size_bytes"

  Scenario: A receipt file over 10 MB is rejected
    When I check a "line" with:
      | category | expense_date | description | amount | receipt                                                                                                                                 |
      | MEALS    | 2026-11-03   | Lunch       | 2000   | {"sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "media_type": "application/pdf", "size_bytes": 10485761} |
    Then the value is rejected by "maximum" of "size_bytes"

  Scenario: A receipt with no size is rejected
    When I check a "line" with:
      | category | expense_date | description | amount | receipt                                                                                                         |
      | MEALS    | 2026-11-03   | Lunch       | 2000   | {"sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "media_type": "application/pdf"} |
    Then the value is rejected by "required" of "receipt"

  Scenario: A line with no amount is rejected
    When I check a "line" with:
      | category | expense_date | description |
      | MEALS    | 2026-11-03   | Lunch       |
    Then the value is rejected by "required" of "line"

  Scenario: A line of 25.01 with no receipt is rejected
    When I check a "line" with:
      | category | expense_date | description | amount |
      | MEALS    | 2026-11-03   | Lunch       | 2501   |
    Then the value is rejected by "receipt_above_25" of "line"

  Scenario: A MILEAGE line with no distance is rejected
    When I check a "line" with:
      | category | expense_date | description | amount |
      | MILEAGE  | 2026-11-03   | Lunch       | 2000   |
    Then the value is rejected by "mileage_has_distance" of "line"

  Scenario: A MILEAGE line with a receipt is rejected
    When I check a "line" with:
      | category | expense_date | description | amount | distance_km | receipt                                                                                                                              |
      | MILEAGE  | 2026-11-03   | Lunch       | 2000   | 80          | {"sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "media_type": "application/pdf", "size_bytes": 52000} |
    Then the value is rejected by "mileage_has_distance" of "line"

  Scenario: A MEALS line with a distance is rejected
    When I check a "line" with:
      | category | expense_date | description | amount | distance_km |
      | MEALS    | 2026-11-03   | Lunch       | 2000   | 12          |
    Then the value is rejected by "distance_only_for_mileage" of "line"

  Scenario: A claim id with 9 digits is rejected
    When I check a "claim" with:
      | claim_id      | version | employee_id | manager_id | state     | purpose              | currency | total | lines                                                                                         | submitted_at         |
      | CLM-000000123 | 2       | emp-1       | mgr-1      | SUBMITTED | Client visit in Bern | EUR      | 2000  | [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}] | 2026-11-10T09:00:00Z |
    Then the value is rejected by "pattern" of "claim_id"

  Scenario: A version of 0 is rejected
    When I check a "claim" with:
      | claim_id       | version | employee_id | manager_id | state     | purpose              | currency | total | lines                                                                                         | submitted_at         |
      | CLM-0000000123 | 0       | emp-1       | mgr-1      | SUBMITTED | Client visit in Bern | EUR      | 2000  | [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}] | 2026-11-10T09:00:00Z |
    Then the value is rejected by "minimum" of "version"

  Scenario: An empty employee id is rejected
    When I check a "claim" with:
      | claim_id       | version | employee_id | manager_id | state     | purpose              | currency | total | lines                                                                                         | submitted_at         |
      | CLM-0000000123 | 2       | ""          | mgr-1      | SUBMITTED | Client visit in Bern | EUR      | 2000  | [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}] | 2026-11-10T09:00:00Z |
    Then the value is rejected by "minLength" of "employee_id"

  Scenario: A state outside the list is rejected
    When I check a "claim" with:
      | claim_id       | version | employee_id | manager_id | state     | purpose              | currency | total | lines                                                                                         | submitted_at         |
      | CLM-0000000123 | 2       | emp-1       | mgr-1      | CANCELLED | Client visit in Bern | EUR      | 2000  | [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}] | 2026-11-10T09:00:00Z |
    Then the value is rejected by "enum" of "state"

  Scenario: A currency in lower case is rejected
    When I check a "claim" with:
      | claim_id       | version | employee_id | manager_id | state     | purpose              | currency | total | lines                                                                                         | submitted_at         |
      | CLM-0000000123 | 2       | emp-1       | mgr-1      | SUBMITTED | Client visit in Bern | eur      | 2000  | [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}] | 2026-11-10T09:00:00Z |
    Then the value is rejected by "enum" of "currency"

  Scenario: A total of 0.00 is rejected
    When I check a "claim" with:
      | claim_id       | version | employee_id | manager_id | state     | purpose              | currency | total | lines                                                                                         | submitted_at         |
      | CLM-0000000123 | 2       | emp-1       | mgr-1      | SUBMITTED | Client visit in Bern | EUR      | 0     | [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}] | 2026-11-10T09:00:00Z |
    Then the value is rejected by "exclusiveMinimum" of "total"

  Scenario: An empty purpose is rejected
    When I check a "claim" with:
      | claim_id       | version | employee_id | manager_id | state     | purpose | currency | total | lines                                                                                         | submitted_at         |
      | CLM-0000000123 | 2       | emp-1       | mgr-1      | SUBMITTED | ""      | EUR      | 2000  | [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}] | 2026-11-10T09:00:00Z |
    Then the value is rejected by "minLength" of "purpose"

  Scenario: A purpose of 501 characters is rejected
    When I check a "claim" with:
      | claim_id       | version | employee_id | manager_id | state     | purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | currency | total | lines                                                                                         | submitted_at         |
      | CLM-0000000123 | 2       | emp-1       | mgr-1      | SUBMITTED | xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx | EUR      | 2000  | [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}] | 2026-11-10T09:00:00Z |
    Then the value is rejected by "maxLength" of "purpose"

  Scenario: A reason of 9 characters is rejected
    When I check a "claim" with:
      | claim_id       | version | employee_id | manager_id | state    | purpose              | currency | total | lines                                                                                         | submitted_at         | reason    |
      | CLM-0000000123 | 2       | emp-1       | mgr-1      | REJECTED | Client visit in Bern | EUR      | 2000  | [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}] | 2026-11-10T09:00:00Z | Too much. |
    Then the value is rejected by "minLength" of "reason"

  Scenario: A reason of 501 characters is rejected
    When I check a "claim" with:
      | claim_id       | version | employee_id | manager_id | state    | purpose              | currency | total | lines                                                                                         | submitted_at         | reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
      | CLM-0000000123 | 2       | emp-1       | mgr-1      | REJECTED | Client visit in Bern | EUR      | 2000  | [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}] | 2026-11-10T09:00:00Z | xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx |
    Then the value is rejected by "maxLength" of "reason"

  Scenario: A submission time with no time is rejected
    When I check a "claim" with:
      | claim_id       | version | employee_id | manager_id | state     | purpose              | currency | total | lines                                                                                         | submitted_at |
      | CLM-0000000123 | 2       | emp-1       | mgr-1      | SUBMITTED | Client visit in Bern | EUR      | 2000  | [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}] | 2026-11-10   |
    Then the value is rejected by "format" of "utc_time"

  Scenario: A submission time that is not in UTC is rejected
    When I check a "claim" with:
      | claim_id       | version | employee_id | manager_id | state     | purpose              | currency | total | lines                                                                                         | submitted_at              |
      | CLM-0000000123 | 2       | emp-1       | mgr-1      | SUBMITTED | Client visit in Bern | EUR      | 2000  | [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}] | 2026-11-10T10:00:00+01:00 |
    Then the value is rejected by "pattern" of "utc_time"

  Scenario: A claim with no line is rejected
    When I check a "claim" with:
      | claim_id       | version | employee_id | manager_id | state     | purpose              | currency | lines | submitted_at         |
      | CLM-0000000123 | 2       | emp-1       | mgr-1      | SUBMITTED | Client visit in Bern | EUR      | []    | 2026-11-10T09:00:00Z |
    Then the value is rejected by "minItems" of "lines"

  Scenario: A claim with 51 lines is rejected
    When I check a "claim" with:
      | claim_id       | version | employee_id | manager_id | state     | purpose              | currency | total  | lines                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | submitted_at         |
      | CLM-0000000123 | 2       | emp-1       | mgr-1      | SUBMITTED | Client visit in Bern | EUR      | 102000 | [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}, {"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}] | 2026-11-10T09:00:00Z |
    Then the value is rejected by "maxItems" of "lines"

  Scenario: A claim with no manager is rejected
    When I check a "claim" with:
      | claim_id       | version | employee_id | state     | purpose              | currency | total | lines                                                                                         | submitted_at         |
      | CLM-0000000123 | 2       | emp-1       | SUBMITTED | Client visit in Bern | EUR      | 2000  | [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}] | 2026-11-10T09:00:00Z |
    Then the value is rejected by "required" of "claim"

  Scenario: A total that is not the sum of the lines is rejected
    When I check a "claim" with:
      | claim_id       | version | employee_id | manager_id | state     | purpose              | currency | total | lines                                                                                         | submitted_at         |
      | CLM-0000000123 | 2       | emp-1       | mgr-1      | SUBMITTED | Client visit in Bern | EUR      | 2001  | [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}] | 2026-11-10T09:00:00Z |
    Then the value is rejected by "total_is_sum" of "claim"

  Scenario: A submitted claim with no submission time is rejected
    When I check a "claim" with:
      | claim_id       | version | employee_id | manager_id | state     | purpose              | currency | total | lines                                                                                         |
      | CLM-0000000123 | 2       | emp-1       | mgr-1      | SUBMITTED | Client visit in Bern | EUR      | 2000  | [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}] |
    Then the value is rejected by "submitted_has_time" of "claim"

  Scenario: An expense after the day of the submission is rejected
    When I check a "claim" with:
      | claim_id       | version | employee_id | manager_id | state     | purpose              | currency | total | lines                                                                                         | submitted_at         |
      | CLM-0000000123 | 2       | emp-1       | mgr-1      | SUBMITTED | Client visit in Bern | EUR      | 2000  | [{"category": "MEALS", "expense_date": "2026-11-11", "description": "Lunch", "amount": 2000}] | 2026-11-10T09:00:00Z |
    Then the value is rejected by "lines_dated_for_submission" of "claim"

  Scenario: An expense 91 days before the day of the submission is rejected
    When I check a "claim" with:
      | claim_id       | version | employee_id | manager_id | state     | purpose              | currency | total | lines                                                                                         | submitted_at         |
      | CLM-0000000123 | 2       | emp-1       | mgr-1      | SUBMITTED | Client visit in Bern | EUR      | 2000  | [{"category": "MEALS", "expense_date": "2026-08-11", "description": "Lunch", "amount": 2000}] | 2026-11-10T09:00:00Z |
    Then the value is rejected by "lines_dated_for_submission" of "claim"

  Scenario: A caller with a role outside the list is rejected
    When I check a "caller" with:
      | role    | employee_id |
      | auditor | aud-1       |
    Then the value is rejected by "enum" of "role"

  Scenario: A caller with no role is rejected
    When I check a "caller" with:
      | employee_id |
      | emp-1       |
    Then the value is rejected by "required" of "caller"

  Scenario: An event id that is not a UUID is rejected
    When I check a "claim_paid" with:
      | event_id | claim_id       | employee_id | total | currency | state | actor_id | occurred_at          |
      | event-1  | CLM-0000000123 | emp-1       | 2000  | EUR      | PAID  | fin-1    | 2026-11-22T10:00:00Z |
    Then the value is rejected by "pattern" of "event_id"
