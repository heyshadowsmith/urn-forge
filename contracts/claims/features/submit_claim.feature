Feature: Submit a claim

  The owner submits a DRAFT claim at the version they read; the claim holds the time of the call as its
  submission, and the answer carries the event claim_submitted.

  Scenario: A DRAFT claim becomes SUBMITTED
    When I run "submit_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                               |
      | employee    | emp-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | emp-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "DRAFT", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}]} |
    Then the output is "submitted":
      | claim_submitted                                                                                                                                                                                                                |
      | {"event_id": "3f0c8a52-6d1e-4b7a-9c2f-000000000001", "claim_id": "CLM-0000000123", "employee_id": "emp-1", "total": 2000, "currency": "EUR", "state": "SUBMITTED", "actor_id": "emp-1", "occurred_at": "2026-11-22T10:00:00Z"} |

  Scenario: A change of a claim that does not exist is refused
    When I run "submit_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id |
      | employee    | emp-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | emp-1    |
    Then the output is "not_found":
      | claim_id       |
      | CLM-0000000123 |

  Scenario: Another employee may not submit the claim
    When I run "submit_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                               |
      | employee    | emp-2              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | emp-2    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "DRAFT", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}]} |
    Then the output is "forbidden":
      | role     | actor_id |
      | employee | emp-2    |

  Scenario: A APPROVED claim cannot become SUBMITTED
    When I run "submit_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                          |
      | employee    | emp-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | emp-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "APPROVED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "invalid_state":
      | claim_id       | state    |
      | CLM-0000000123 | APPROVED |

  Scenario: A change of an older version is refused
    When I run "submit_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                               |
      | employee    | emp-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | emp-1    | {"claim_id": "CLM-0000000123", "version": 3, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "DRAFT", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}]} |
    Then the output is "version_conflict":
      | claim_id       | version |
      | CLM-0000000123 | 2       |

  Scenario: An expense 90 days before the day of the submission is accepted
    When I run "submit_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                               |
      | employee    | emp-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | emp-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "DRAFT", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-08-24", "description": "Lunch", "amount": 2000}]} |
    Then the output is "submitted"

  Scenario: An expense 91 days before the day of the submission is rejected
    When I run "submit_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                               |
      | employee    | emp-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | emp-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "DRAFT", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-08-23", "description": "Lunch", "amount": 2000}]} |
    Then the input is rejected by "lines_dated_for_now" of "submission"

  Scenario: An expense after the day of the submission is rejected
    When I run "submit_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                               |
      | employee    | emp-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | emp-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "DRAFT", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-23", "description": "Lunch", "amount": 2000}]} |
    Then the input is rejected by "lines_dated_for_now" of "submission"

  Scenario: A stored claim that is not the claim of the request is rejected
    When I run "submit_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                               |
      | employee    | emp-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000999 | 2       | emp-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "DRAFT", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}]} |
    Then the input is rejected by "names_the_stored_claim" of "submission"

  Scenario: A submission with no event id is rejected
    When I run "submit_claim" with:
      | caller.role | caller.employee_id | now                  | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                               |
      | employee    | emp-1              | 2026-11-22T10:00:00Z | CLM-0000000123 | 2       | emp-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "DRAFT", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}]} |
    Then the input is rejected by "required" of "submission"
