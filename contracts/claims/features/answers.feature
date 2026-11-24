Feature: The answers, events and refusals

  Each answer, event and refusal has its required properties.

  Scenario: A submitted with a missing property is rejected
    When I check a "submitted" with:
      | claim                                                                                                                                                                                                                                                                                                                                  |
      | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the value is rejected by "required" of "submitted"

  Scenario: A withdrawn with a missing property is rejected
    When I check a "withdrawn" with:
      | claim                                                                                                                                                                                                                                                                                                                                  |
      | {"claim_id": "CLM-0000000123", "version": 3, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "WITHDRAWN", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the value is rejected by "required" of "withdrawn"

  Scenario: An approved with a missing property is rejected
    When I check an "approved" with:
      | claim                                                                                                                                                                                                                                                                                                                                 |
      | {"claim_id": "CLM-0000000123", "version": 3, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "APPROVED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the value is rejected by "required" of "approved"

  Scenario: A rejected with a missing property is rejected
    When I check a "rejected" with:
      | claim                                                                                                                                                                                                                                                                                                                                                                                  |
      | {"claim_id": "CLM-0000000123", "version": 3, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "REJECTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z", "reason": "The hotel needs an itemised receipt"} |
    Then the value is rejected by "required" of "rejected"

  Scenario: A paid with a missing property is rejected
    When I check a "paid" with:
      | claim                                                                                                                                                                                                                                                                                                                             |
      | {"claim_id": "CLM-0000000123", "version": 4, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "PAID", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the value is rejected by "required" of "paid"

  Scenario: An overdue_reported with a missing property is rejected
    When I check an "overdue_reported" with:
      | claim                                                                                                                                                                                                                                                                                                                                  |
      | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the value is rejected by "required" of "overdue_reported"

  Scenario: A claim_submitted with a missing property is rejected
    When I check a "claim_submitted" with:
      | event_id                             | claim_id       | employee_id | total | currency | state     | actor_id |
      | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | emp-1       | 2000  | EUR      | SUBMITTED | emp-1    |
    Then the value is rejected by "required" of "claim_submitted"

  Scenario: A claim_withdrawn with a missing property is rejected
    When I check a "claim_withdrawn" with:
      | event_id                             | claim_id       | employee_id | total | currency | state     | occurred_at          |
      | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | emp-1       | 2000  | EUR      | WITHDRAWN | 2026-11-22T10:00:00Z |
    Then the value is rejected by "required" of "claim_withdrawn"

  Scenario: A claim_approved with a missing property is rejected
    When I check a "claim_approved" with:
      | event_id                             | claim_id       | employee_id | currency | state    | actor_id | occurred_at          |
      | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | emp-1       | EUR      | APPROVED | mgr-1    | 2026-11-22T10:00:00Z |
    Then the value is rejected by "required" of "claim_approved"

  Scenario: A claim_rejected with a missing property is rejected
    When I check a "claim_rejected" with:
      | event_id                             | claim_id       | employee_id | total | currency | state    | actor_id | occurred_at          |
      | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | emp-1       | 2000  | EUR      | REJECTED | mgr-1    | 2026-11-22T10:00:00Z |
    Then the value is rejected by "required" of "claim_rejected"

  Scenario: A claim_paid with a missing property is rejected
    When I check a "claim_paid" with:
      | claim_id       | employee_id | total | currency | state | actor_id | occurred_at          |
      | CLM-0000000123 | emp-1       | 2000  | EUR      | PAID  | fin-1    | 2026-11-22T10:00:00Z |
    Then the value is rejected by "required" of "claim_paid"

  Scenario: A claim_decision_overdue with a missing property is rejected
    When I check a "claim_decision_overdue" with:
      | event_id                             | claim_id       | employee_id | manager_id | total | currency | state     | occurred_at          |
      | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | emp-1       | mgr-1      | 2000  | EUR      | SUBMITTED | 2026-11-22T10:00:00Z |
    Then the value is rejected by "required" of "claim_decision_overdue"

  Scenario: A not_found with a missing property is rejected
    When I check a "not_found" with:
      | claim_id |
      |          |
    Then the value is rejected by "required" of "not_found"

  Scenario: A forbidden with a missing property is rejected
    When I check a "forbidden" with:
      | actor_id |
      | emp-2    |
    Then the value is rejected by "required" of "forbidden"

  Scenario: An invalid_state with a missing property is rejected
    When I check an "invalid_state" with:
      | claim_id       |
      | CLM-0000000123 |
    Then the value is rejected by "required" of "invalid_state"

  Scenario: A version_conflict with a missing property is rejected
    When I check a "version_conflict" with:
      | version |
      | 2       |
    Then the value is rejected by "required" of "version_conflict"

  Scenario: A duplicate_receipt with a missing property is rejected
    When I check a "duplicate_receipt" with:
      | sha256 |
      |        |
    Then the value is rejected by "required" of "duplicate_receipt"
