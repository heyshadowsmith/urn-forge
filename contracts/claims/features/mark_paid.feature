Feature: Mark a claim paid

  A finance user marks an APPROVED claim paid at the version they read; the answer carries the event
  claim_paid with the approved total and currency.

  Scenario: A APPROVED claim becomes PAID
    When I run "mark_paid" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                          |
      | finance     | fin-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | fin-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "APPROVED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "paid":
      | claim_paid                                                                                                                                                                                                                |
      | {"event_id": "3f0c8a52-6d1e-4b7a-9c2f-000000000001", "claim_id": "CLM-0000000123", "employee_id": "emp-1", "total": 2000, "currency": "EUR", "state": "PAID", "actor_id": "fin-1", "occurred_at": "2026-11-22T10:00:00Z"} |

  Scenario: A change of a claim that does not exist is refused
    When I run "mark_paid" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id |
      | finance     | fin-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | fin-1    |
    Then the output is "not_found":
      | claim_id       |
      | CLM-0000000123 |

  Scenario: A manager may not mark a claim paid
    When I run "mark_paid" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                          |
      | manager     | mgr-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | mgr-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "APPROVED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "forbidden":
      | role    | actor_id |
      | manager | mgr-1    |

  Scenario: The clock may not mark a claim paid
    When I run "mark_paid" with:
      | caller.role | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                          |
      | clock       | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | fin-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "APPROVED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "forbidden":
      | role  | actor_id |
      | clock | fin-1    |

  Scenario: A PAID claim cannot become PAID
    When I run "mark_paid" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                      |
      | finance     | fin-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | fin-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "PAID", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "invalid_state":
      | claim_id       | state |
      | CLM-0000000123 | PAID  |

  Scenario: A change of an older version is refused
    When I run "mark_paid" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                          |
      | finance     | fin-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | fin-1    | {"claim_id": "CLM-0000000123", "version": 3, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "APPROVED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "version_conflict":
      | claim_id       | version |
      | CLM-0000000123 | 2       |

  Scenario: A payment with an idempotency key is accepted
    When I run "mark_paid" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                          | idempotency_key |
      | finance     | fin-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | fin-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "APPROVED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} | pay-123         |
    Then the output is "paid"

  Scenario: An empty idempotency key is rejected
    When I run "mark_paid" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                          | idempotency_key |
      | finance     | fin-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | fin-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "APPROVED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} | ""              |
    Then the input is rejected by "minLength" of "idempotency_key"
