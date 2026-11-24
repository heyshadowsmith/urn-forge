Feature: Approve a claim

  The manager of the claimant approves a SUBMITTED claim at the version they read, never their own claim;
  the answer carries the event claim_approved.

  Scenario: A SUBMITTED claim becomes APPROVED
    When I run "approve_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | manager     | mgr-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | mgr-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "approved":
      | claim_approved                                                                                                                                                                                                                |
      | {"event_id": "3f0c8a52-6d1e-4b7a-9c2f-000000000001", "claim_id": "CLM-0000000123", "employee_id": "emp-1", "total": 2000, "currency": "EUR", "state": "APPROVED", "actor_id": "mgr-1", "occurred_at": "2026-11-22T10:00:00Z"} |

  Scenario: A change of a claim that does not exist is refused
    When I run "approve_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id |
      | manager     | mgr-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | mgr-1    |
    Then the output is "not_found":
      | claim_id       |
      | CLM-0000000123 |

  Scenario: The owner may not approve their claim
    When I run "approve_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | employee    | emp-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | emp-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "forbidden":
      | role     | actor_id |
      | employee | emp-1    |

  Scenario: A manager of another employee may not approve the claim
    When I run "approve_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | manager     | mgr-2              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | mgr-2    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "forbidden":
      | role    | actor_id |
      | manager | mgr-2    |

  Scenario: A DRAFT claim cannot become APPROVED
    When I run "approve_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                               |
      | manager     | mgr-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | mgr-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "DRAFT", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}]} |
    Then the output is "invalid_state":
      | claim_id       | state |
      | CLM-0000000123 | DRAFT |

  Scenario: A change of an older version is refused
    When I run "approve_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | manager     | mgr-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | mgr-1    | {"claim_id": "CLM-0000000123", "version": 3, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "version_conflict":
      | claim_id       | version |
      | CLM-0000000123 | 2       |

  Scenario: A manager who owns the claim may not approve it
    When I run "approve_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | manager     | mgr-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | mgr-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "mgr-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "forbidden":
      | role    | actor_id |
      | manager | mgr-1    |

  Scenario: A request in the name of another user is refused
    When I run "approve_claim" with:
      | caller.role | caller.employee_id | now                  | event_id                             | claim_id       | version | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | manager     | mgr-1              | 2026-11-22T10:00:00Z | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | 2       | mgr-9    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "forbidden":
      | role    | actor_id |
      | manager | mgr-9    |
