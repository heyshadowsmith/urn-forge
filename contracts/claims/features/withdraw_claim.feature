Feature: Withdraw a claim

  The owner withdraws a SUBMITTED claim at the version they read; the answer carries the event claim_withdrawn.

  Scenario: A SUBMITTED claim becomes WITHDRAWN
    When I run "withdraw_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | employee    | emp-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | emp-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "withdrawn":
      | claim_withdrawn                                                                                                                                                                                                                |
      | {"event_id": "3f0c8a52-6d1e-4b7a-9c2f-000000000001", "claim_id": "CLM-0000000123", "employee_id": "emp-1", "total": 2000, "currency": "EUR", "state": "WITHDRAWN", "actor_id": "emp-1", "occurred_at": "2026-11-22T10:00:00Z"} |

  Scenario: A change of a claim that does not exist is refused
    When I run "withdraw_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id |
      | employee    | emp-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | emp-1    |
    Then the output is "not_found":
      | claim_id       |
      | CLM-0000000123 |

  Scenario: Another employee may not withdraw the claim
    When I run "withdraw_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | employee    | emp-2              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | emp-2    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "forbidden":
      | role     | actor_id |
      | employee | emp-2    |

  Scenario: A PAID claim cannot become WITHDRAWN
    When I run "withdraw_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                      |
      | employee    | emp-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | emp-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "PAID", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "invalid_state":
      | claim_id       | state |
      | CLM-0000000123 | PAID  |

  Scenario: A change of an older version is refused
    When I run "withdraw_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | employee    | emp-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | emp-1    | {"claim_id": "CLM-0000000123", "version": 3, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "version_conflict":
      | claim_id       | version |
      | CLM-0000000123 | 2       |

  Scenario: A stored claim that is not the claim of the request is rejected
    When I run "withdraw_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | employee    | emp-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000999 | 2       | emp-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the input is rejected by "names_the_stored_claim" of "change"

  Scenario: A change at a time that is not in UTC is rejected
    When I run "withdraw_claim" with:
      | caller.role | caller.employee_id | now                       | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | employee    | emp-1              | 2026-11-22T11:00:00+01:00 | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | emp-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the input is rejected by "pattern" of "utc_time"

  Scenario: A change with no time is rejected
    When I run "withdraw_claim" with:
      | caller.role | caller.employee_id | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | employee    | emp-1              | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | emp-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the input is rejected by "required" of "change"
