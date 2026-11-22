@urn-forge:strict
@urn:corpus:claims:claim:operation:report_overdue
Feature: Report a claim that waits for a decision for 30 days

  The shell's clock calls report_overdue for each claim that selectClaimReportOverdueDue gives.
  A claim is due 30 days after its last submission, while it holds no mark of that submission.

  Scenario: A claim submitted exactly 30 days ago is reported once, and keeps its state
    Given the time is "2026-11-19T09:00:00Z"
    And the caller is:
      | role  |
      | clock |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state     | purpose      | currency | total  | lines                                                                                                           | submitted_at         |
      | CLM-0000000123 | 2       | E-1001      | M-3003     | SUBMITTED | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-10-12, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] | 2026-10-20T09:00:00Z |
    When I run the operation with:
      | claim_id       |
      | CLM-0000000123 |
    Then the output is:
      | claim_id       | version | employee_id | manager_id | state     | purpose      | currency | total  | lines                                                                                                           | submitted_at         | overdue_reported_at  |
      | CLM-0000000123 | 2       | E-1001      | M-3003     | SUBMITTED | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-10-12, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] | 2026-10-20T09:00:00Z | 2026-11-19T09:00:00Z |
    And the operation emits "urn:corpus:claims:claim:event:claim_decision_overdue":
      | event_id                             | claim_id       | employee_id | manager_id | total  | currency | state     | submitted_at         | occurred_at          |
      | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | E-1001      | M-3003     | 120.00 | EUR      | SUBMITTED | 2026-10-20T09:00:00Z | 2026-11-19T09:00:00Z |

  Scenario: A claim submitted 1 millisecond less than 30 days ago is not due
    Given the time is "2026-11-19T08:59:59.999Z"
    And the caller is:
      | role  |
      | clock |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state     | purpose      | currency | total  | lines                                                                                                           | submitted_at         |
      | CLM-0000000123 | 2       | E-1001      | M-3003     | SUBMITTED | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-10-12, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] | 2026-10-20T09:00:00Z |
    When I run the operation with:
      | claim_id       |
      | CLM-0000000123 |
    Then the operation is not due

  Scenario: A second call after the report is not due: the claim holds the mark of this submission
    Given the time is "2026-12-01T09:00:00Z"
    And the caller is:
      | role  |
      | clock |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state     | purpose      | currency | total  | lines                                                                                                           | submitted_at         | overdue_reported_at  |
      | CLM-0000000123 | 2       | E-1001      | M-3003     | SUBMITTED | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-10-12, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] | 2026-10-20T09:00:00Z | 2026-11-19T09:00:00Z |
    When I run the operation with:
      | claim_id       |
      | CLM-0000000123 |
    Then the operation is not due

  Scenario: A claim submitted again counts from its last submission: a mark of an earlier submission does not stop the report
    Given the time is "2026-12-20T09:00:00Z"
    And the caller is:
      | role  |
      | clock |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state     | purpose      | currency | total  | lines                                                                                                           | submitted_at         | overdue_reported_at  |
      | CLM-0000000123 | 6       | E-1001      | M-3003     | SUBMITTED | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-10-12, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] | 2026-11-20T09:00:00Z | 2026-11-19T09:00:00Z |
    When I run the operation with:
      | claim_id       |
      | CLM-0000000123 |
    Then the output is:
      | claim_id       | version | employee_id | manager_id | state     | purpose      | currency | total  | lines                                                                                                           | submitted_at         | overdue_reported_at  |
      | CLM-0000000123 | 6       | E-1001      | M-3003     | SUBMITTED | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-10-12, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] | 2026-11-20T09:00:00Z | 2026-12-20T09:00:00Z |
    And the operation emits "urn:corpus:claims:claim:event:claim_decision_overdue":
      | event_id                             | claim_id       | employee_id | manager_id | total  | currency | state     | submitted_at         | occurred_at          |
      | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | E-1001      | M-3003     | 120.00 | EUR      | SUBMITTED | 2026-11-20T09:00:00Z | 2026-12-20T09:00:00Z |

  Scenario: A claim submitted again is not due 30 days after its earlier submission, only after its last one
    Given the time is "2026-12-20T08:59:59.999Z"
    And the caller is:
      | role  |
      | clock |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state     | purpose      | currency | total  | lines                                                                                                           | submitted_at         |
      | CLM-0000000123 | 4       | E-1001      | M-3003     | SUBMITTED | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-10-12, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] | 2026-11-20T09:00:00Z |
    When I run the operation with:
      | claim_id       |
      | CLM-0000000123 |
    Then the operation is not due

  Scenario: A malformed claim id is rejected
    Given the time is "2026-11-19T09:00:00Z"
    And the caller is:
      | role  |
      | clock |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state     | purpose      | currency | total  | lines                                                                                                           | submitted_at         |
      | CLM-0000000123 | 2       | E-1001      | M-3003     | SUBMITTED | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-10-12, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] | 2026-10-20T09:00:00Z |
    When I run the operation with:
      | claim_id |
      | CLM-12   |
    Then the input is rejected on "claim_id"
    And the operation fails with "urn:corpus:claims:claim:error:invalid_request"
    And nothing changes

  Scenario: A claim that does not exist is not found
    Given the time is "2026-11-19T09:00:00Z"
    And the caller is:
      | role  |
      | clock |
    And there is no current claim
    When I run the operation with:
      | claim_id       |
      | CLM-0000000404 |
    Then the operation fails with "urn:corpus:claims:claim:error:not_found":
      | claim_id       |
      | CLM-0000000404 |
    And nothing changes

  Scenario Outline: Only the shell's clock may report a claim
    Given the time is "2026-11-19T09:00:00Z"
    And the caller is:
      | role   | employee_id   |
      | <role> | <employee_id> |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state     | purpose      | currency | total  | lines                                                                                                           | submitted_at         |
      | CLM-0000000123 | 2       | E-1001      | M-3003     | SUBMITTED | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-10-12, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] | 2026-10-20T09:00:00Z |
    When I run the operation with:
      | claim_id       |
      | CLM-0000000123 |
    Then the operation fails with "urn:corpus:claims:claim:error:clock_only":
      | claim_id       |
      | CLM-0000000123 |
    And nothing changes

    Examples:
      | role     | employee_id |
      | employee | E-1001      |
      | manager  | M-3003      |
      | finance  | F-4004      |

  Scenario Outline: A claim that is not SUBMITTED is refused, even 30 days after a submission
    Given the time is "2026-11-19T09:00:00Z"
    And the caller is:
      | role  |
      | clock |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state   | purpose      | currency | total  | lines                                                                                                           | submitted_at         |
      | CLM-0000000123 | 3       | E-1001      | M-3003     | <state> | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-10-12, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] | 2026-10-20T09:00:00Z |
    When I run the operation with:
      | claim_id       |
      | CLM-0000000123 |
    Then the operation fails with "urn:corpus:claims:claim:error:invalid_state":
      | claim_id       | state   |
      | CLM-0000000123 | <state> |
    And nothing changes

    Examples:
      | state     |
      | DRAFT     |
      | APPROVED  |
      | REJECTED  |
      | WITHDRAWN |
      | PAID      |

  Scenario: A repeat of the clock with the same idempotency key within 24 hours returns the first answer and reports nothing again
    Given the time is "2026-11-19T09:00:00Z"
    And the caller is:
      | role  |
      | clock |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state     | purpose      | currency | total  | lines                                                                                                           | submitted_at         |
      | CLM-0000000123 | 2       | E-1001      | M-3003     | SUBMITTED | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] | 2026-10-20T09:00:00Z |
    When I run the operation with:
      | idempotency_key | claim_id       |
      | tick-2026-11-19 | CLM-0000000123 |
    And the time is "2026-11-19T09:05:00Z"
    And I run the operation again with:
      | idempotency_key | claim_id       |
      | tick-2026-11-19 | CLM-0000000123 |
    Then the answer is the first answer
    And the output is:
      | claim_id       | version | employee_id | manager_id | state     | purpose      | currency | total  | lines                                                                                                           | submitted_at         | overdue_reported_at  |
      | CLM-0000000123 | 2       | E-1001      | M-3003     | SUBMITTED | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] | 2026-10-20T09:00:00Z | 2026-11-19T09:00:00Z |
    And the operation emits no event
