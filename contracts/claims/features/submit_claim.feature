@urn-forge:strict
@urn:corpus:claims:claim:operation:submit_claim
Feature: Submit a claim

  Scenario: The claim moves to SUBMITTED, its version goes up by 1, and an event tells it
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 1       | E-1001      | M-3003     | DRAFT | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version | actor_id |
      | CLM-0000000123 | 1       | E-1001   |
    Then the output is:
      | claim_id       | state     | total  | currency | version | submitted_at         |
      | CLM-0000000123 | SUBMITTED | 120.00 | EUR      | 2       | 2026-11-22T10:00:00Z |
    And the operation emits "urn:corpus:claims:claim:event:claim_submitted":
      | event_id                             | claim_id       | employee_id | total  | currency | state     | actor_id | occurred_at          |
      | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | E-1001      | 120.00 | EUR      | SUBMITTED | E-1001   | 2026-11-22T10:00:00Z |

  Scenario: A malformed claim id is rejected
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 1       | E-1001      | M-3003     | DRAFT | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id | version | actor_id |
      | CLM-12   | 1       | E-1001   |
    Then the input is rejected on "claim_id"
    And the operation fails with "urn:corpus:claims:claim:error:invalid_request"
    And nothing changes

  Scenario: A version below 1 is rejected
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 1       | E-1001      | M-3003     | DRAFT | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version | actor_id |
      | CLM-0000000123 | 0       | E-1001   |
    Then the input is rejected on "version"
    And the operation fails with "urn:corpus:claims:claim:error:invalid_request"
    And nothing changes

  Scenario: A claim that does not exist is not found
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    And there is no current claim
    When I run the operation with:
      | claim_id       | version | actor_id |
      | CLM-0000000404 | 4       | E-1001   |
    Then the operation fails with "urn:corpus:claims:claim:error:not_found":
      | claim_id       |
      | CLM-0000000404 |
    And nothing changes

  Scenario Outline: Only the employee who owns the claim may submit it, as themselves
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | role   | employee_id   |
      | <role> | <employee_id> |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 4       | E-1001      | M-3003     | DRAFT | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version | actor_id   |
      | CLM-0000000123 | 4       | <actor_id> |
    Then the operation fails with "urn:corpus:claims:claim:error:forbidden":
      | actor_id   |
      | <actor_id> |
    And nothing changes

    Examples:
      | role     | employee_id | actor_id |
      | employee | E-2002      | E-2002   |
      | manager  | M-3003      | M-3003   |
      | finance  | F-4004      | F-4004   |
      | employee | E-1001      | E-2002   |

  Scenario Outline: A claim that is not DRAFT is refused
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state   | purpose      | currency | total  | lines                                                                                                           | submitted_at         |
      | CLM-0000000123 | 1       | E-1001      | M-3003     | <state> | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] | 2026-10-20T09:00:00Z |
    When I run the operation with:
      | claim_id       | version | actor_id |
      | CLM-0000000123 | 1       | E-1001   |
    Then the operation fails with "urn:corpus:claims:claim:error:invalid_state":
      | claim_id       | state   |
      | CLM-0000000123 | <state> |
    And nothing changes

    Examples:
      | state     |
      | SUBMITTED |
      | APPROVED  |
      | REJECTED  |
      | WITHDRAWN |
      | PAID      |

  Scenario Outline: A version other than the current one is refused with the version sent
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 5       | E-1001      | M-3003     | DRAFT | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version   | actor_id |
      | CLM-0000000123 | <version> | E-1001   |
    Then the operation fails with "urn:corpus:claims:claim:error:version_conflict":
      | claim_id       | version   |
      | CLM-0000000123 | <version> |
    And nothing changes

    Examples:
      | version |
      | 4       |
      | 6       |

  Scenario: A repeat with the same idempotency key by the same caller within 24 hours returns the first answer and changes nothing
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 1       | E-1001      | M-3003     | DRAFT | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | idempotency_key | claim_id       | version | actor_id |
      | key-0001        | CLM-0000000123 | 1       | E-1001   |
    And the time is "2026-11-23T09:59:59.999Z"
    And I run the operation again with:
      | idempotency_key | claim_id       | version | actor_id |
      | key-0001        | CLM-0000000123 | 1       | E-1001   |
    Then the answer is the first answer
    And the output is:
      | claim_id       | state     | total  | currency | version | submitted_at         |
      | CLM-0000000123 | SUBMITTED | 120.00 | EUR      | 2       | 2026-11-22T10:00:00Z |
    And the operation emits no event

  Scenario: The same idempotency key 24 hours after the first request is a new request, and changes the claim again
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 1       | E-1001      | M-3003     | DRAFT | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | idempotency_key | claim_id       | version | actor_id |
      | key-0001        | CLM-0000000123 | 1       | E-1001   |
    And the time is "2026-11-23T10:00:00Z"
    And I run the operation again with:
      | idempotency_key | claim_id       | version | actor_id |
      | key-0001        | CLM-0000000123 | 1       | E-1001   |
    Then the output is:
      | claim_id       | state     | total  | currency | version | submitted_at         |
      | CLM-0000000123 | SUBMITTED | 120.00 | EUR      | 2       | 2026-11-23T10:00:00Z |
    And the operation emits "urn:corpus:claims:claim:event:claim_submitted":
      | event_id                             | claim_id       | employee_id | total  | currency | state     | actor_id | occurred_at          |
      | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | E-1001      | 120.00 | EUR      | SUBMITTED | E-1001   | 2026-11-22T10:00:00Z |

  Scenario: A request without an idempotency key runs as any request, also when it is repeated
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 1       | E-1001      | M-3003     | DRAFT | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version | actor_id |
      | CLM-0000000123 | 1       | E-1001   |
    And the time is "2026-11-22T11:00:00Z"
    And I run the operation again with:
      | claim_id       | version | actor_id |
      | CLM-0000000123 | 1       | E-1001   |
    Then the output is:
      | claim_id       | state     | total  | currency | version | submitted_at         |
      | CLM-0000000123 | SUBMITTED | 120.00 | EUR      | 2       | 2026-11-22T11:00:00Z |
    And the operation emits "urn:corpus:claims:claim:event:claim_submitted":
      | event_id                             | claim_id       | employee_id | total  | currency | state     | actor_id | occurred_at          |
      | 3f0c8a52-6d1e-4b7a-9c2f-000000000001 | CLM-0000000123 | E-1001      | 120.00 | EUR      | SUBMITTED | E-1001   | 2026-11-22T10:00:00Z |
