Feature: Read a claim

  The owner of a claim, their manager and finance users may read it; the answer is the stored claim.

  Scenario: The owner reads their claim
    When I run "get_claim" with:
      | caller.role | caller.employee_id | claim_id       | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | employee    | emp-1              | CLM-0000000123 | emp-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "claim":
      | claim_id       | state     | total | currency | version | lines                                                                                         |
      | CLM-0000000123 | SUBMITTED | 2000  | EUR      | 2       | [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}] |

  Scenario: The manager of the owner reads the claim
    When I run "get_claim" with:
      | caller.role | caller.employee_id | claim_id       | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | manager     | mgr-1              | CLM-0000000123 | mgr-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "claim":
      | claim_id       |
      | CLM-0000000123 |

  Scenario: A finance user reads the claim
    When I run "get_claim" with:
      | caller.role | caller.employee_id | claim_id       | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | finance     | fin-1              | CLM-0000000123 | fin-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "claim":
      | claim_id       |
      | CLM-0000000123 |

  Scenario: Another employee may not read the claim
    When I run "get_claim" with:
      | caller.role | caller.employee_id | claim_id       | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | employee    | emp-2              | CLM-0000000123 | emp-2    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the output is "forbidden":
      | role     | actor_id |
      | employee | emp-2    |

  Scenario: A claim that does not exist is refused
    When I run "get_claim" with:
      | caller.role | caller.employee_id | claim_id       | actor_id |
      | employee    | emp-1              | CLM-0000000123 | emp-1    |
    Then the output is "not_found":
      | claim_id       |
      | CLM-0000000123 |

  Scenario: A stored claim that is not the claim of the request is rejected
    When I run "get_claim" with:
      | caller.role | caller.employee_id | claim_id       | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | employee    | emp-1              | CLM-0000000999 | emp-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the input is rejected by "names_the_stored_claim" of "lookup"

  Scenario: A request with no actor is rejected
    When I run "get_claim" with:
      | caller.role | caller.employee_id | claim_id       | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | employee    | emp-1              | CLM-0000000123 | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2000, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the input is rejected by "required" of "lookup"

  Scenario: A stored claim whose total is not the sum of its lines is rejected
    When I run "get_claim" with:
      | caller.role | caller.employee_id | claim_id       | actor_id | stored_claim                                                                                                                                                                                                                                                                                                                           |
      | employee    | emp-1              | CLM-0000000123 | emp-1    | {"claim_id": "CLM-0000000123", "version": 2, "employee_id": "emp-1", "manager_id": "mgr-1", "state": "SUBMITTED", "purpose": "Client visit in Bern", "currency": "EUR", "total": 2500, "lines": [{"category": "MEALS", "expense_date": "2026-11-03", "description": "Lunch", "amount": 2000}], "submitted_at": "2026-11-10T09:00:00Z"} |
    Then the input is rejected by "total_is_sum" of "claim"
