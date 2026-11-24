Feature: Reject a claim

  The manager of the claimant rejects a SUBMITTED claim with a reason of 10 to 500 characters; the claim
  and the event claim_rejected carry the reason.

  Scenario: A SUBMITTED claim becomes REJECTED
    When I run "reject_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           | reason                              |
      | manager     | mgr-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | mgr-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} | The hotel needs an itemised receipt |
    Then the output is "rejected":
      | claim_rejected                                                                                                                                                                                                                                                                 |
      | {"event_id": "3f0c8a52-6d1e-4b7a-9c2f-000000000001", "claim_id": "CLM-0000000123", "employee_id": "emp-1", "total": 2000, "currency": "EUR", "state": "REJECTED", "actor_id": "mgr-1", "occurred_at": "2026-11-22T10:00:00Z", "reason": "The hotel needs an itemised receipt"} |

  Scenario: A change of a claim that does not exist is refused
    When I run "reject_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | reason                              |
      | manager     | mgr-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | mgr-1    | The hotel needs an itemised receipt |
    Then the output is "not_found":
      | claim_id       |
      | CLM-0000000123 |

  Scenario: The owner may not reject their claim
    When I run "reject_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           | reason                              |
      | employee    | emp-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | emp-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} | The hotel needs an itemised receipt |
    Then the output is "forbidden":
      | role     | actor_id |
      | employee | emp-1    |

  Scenario: A WITHDRAWN claim cannot become REJECTED
    When I run "reject_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           | reason                              |
      | manager     | mgr-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | mgr-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "WITHDRAWN", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} | The hotel needs an itemised receipt |
    Then the output is "invalid_state":
      | claim_id       | state     |
      | CLM-0000000123 | WITHDRAWN |

  Scenario: A change of an older version is refused
    When I run "reject_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           | reason                              |
      | manager     | mgr-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | mgr-1    | {"claim_id": "CLM-0000000123", "version": 3, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} | The hotel needs an itemised receipt |
    Then the output is "version_conflict":
      | claim_id       | version |
      | CLM-0000000123 | 2       |

  Scenario: A reason of 9 characters is rejected
    When I run "reject_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           | reason    |
      | manager     | mgr-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | mgr-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} | Too much. |
    Then the input is rejected by "minLength" of "reason"

  Scenario: A reason of 501 characters is rejected
    When I run "reject_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           | reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
      | manager     | mgr-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | mgr-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} | xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx |
    Then the input is rejected by "maxLength" of "reason"

  Scenario: A rejection with no reason is rejected
    When I run "reject_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | manager     | mgr-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | mgr-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the input is rejected by "required" of "rejection"

  Scenario: A stored claim that is not the claim of the request is rejected
    When I run "reject_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           | reason                              |
      | manager     | mgr-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000999 | 2       | mgr-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} | The hotel needs an itemised receipt |
    Then the input is rejected by "names_the_stored_claim" of "rejection"
