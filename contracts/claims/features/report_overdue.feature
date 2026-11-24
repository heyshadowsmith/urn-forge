Feature: Report an overdue claim

  The shell's clock reports a claim that has waited in SUBMITTED for 30 days since its last submission,
  once for each submission; the claim keeps its state and version, and holds the time of the report.

  Scenario: A claim submitted 30 days ago is reported
    When I run "report_overdue" with:
      | caller.role | now                  | event_id                             | claim_id       | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | clock       | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-10-20", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-10-23T10:00:00Z"} |
    Then the output is "overdue_reported":
      | claim_decision_overdue                                                                                                                                                                                                                                                   |
      | {"event_id": "3f0c8a52-6d1e-4b7a-9c2f-000000000001", "claim_id": "CLM-0000000123", "employee_id": "emp-1", "manager_id": "mgr-1", "total": 2000, "currency": "EUR", "state": "SUBMITTED", "submitted_at": "2026-10-23T10:00:00Z", "occurred_at": "2026-11-22T10:00:00Z"} |

  Scenario: A claim reported before its last submission is reported again
    When I run "report_overdue" with:
      | caller.role | now                  | event_id                             | claim_id       | stored_claim                                                                                                                                                                                                                                                                                                                                                                          |
      | clock       | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-10-20", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-10-23T10:00:00Z", "overdue_reported_at": "2026-10-01T00:00:00Z"} |
    Then the output is "overdue_reported"

  Scenario: A claim submitted less than 30 days ago is rejected
    When I run "report_overdue" with:
      | caller.role | now                  | event_id                             | claim_id       | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | clock       | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-10-20", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-10-23T10:00:01Z"} |
    Then the input is rejected by "claim_is_due" of "overdue_check"

  Scenario: A claim reported since its last submission is rejected
    When I run "report_overdue" with:
      | caller.role | now                  | event_id                             | claim_id       | stored_claim                                                                                                                                                                                                                                                                                                                                                                          |
      | clock       | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-10-20", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-10-23T10:00:00Z", "overdue_reported_at": "2026-11-22T09:00:00Z"} |
    Then the input is rejected by "claim_is_due" of "overdue_check"

  Scenario: Only the clock may report a claim
    When I run "report_overdue" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | employee    | emp-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-10-20", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-10-23T10:00:00Z"} |
    Then the output is "forbidden":
      | role     |
      | employee |

  Scenario: A claim that does not exist is refused
    When I run "report_overdue" with:
      | caller.role | now                  | event_id                             | claim_id       |
      | clock       | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 |
    Then the output is "not_found":
      | claim_id       |
      | CLM-0000000123 |

  Scenario: An approved claim is not reported
    When I run "report_overdue" with:
      | caller.role | now                  | event_id                             | claim_id       | stored_claim                                                                                                                                                                                                                                                                                                                          |
      | clock       | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | {"claim_id": "CLM-0000000123", "version": 3, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "APPROVED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "invalid_state":
      | claim_id       | state    |
      | CLM-0000000123 | APPROVED |

  Scenario: A stored claim that is not the claim of the request is rejected
    When I run "report_overdue" with:
      | caller.role | now                  | event_id                             | claim_id       | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | clock       | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000999 | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-10-20", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-10-23T10:00:00Z"} |
    Then the input is rejected by "names_the_stored_claim" of "overdue_check"

  Scenario: A request with no time is rejected
    When I run "report_overdue" with:
      | caller.role | event_id                             | claim_id       | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | clock       | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-10-20", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-10-23T10:00:00Z"} |
    Then the input is rejected by "required" of "overdue_check"
