@urn-forge:strict
@urn:corpus:claims:claim:operation:mark_paid
Feature: Mark a claim paid

  Scenario: The claim moves to PAID, its version goes up by 1, and an event tells it
    Given the current claim is:
      | claim_id       | version | employee_id | state    | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 1       | E-1001      | APPROVED | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version | actor_id |
      | CLM-0000000123 | 1       | F-4004   |
    Then the output is:
      | claim_id       | state | total  | currency | version |
      | CLM-0000000123 | PAID  | 120.00 | EUR      | 2       |
    And the operation emits "urn:corpus:claims:claim:event:claim_paid":
      | event_id                             | claim_id       | employee_id | total  | currency | state | actor_id | occurred_at          |
      | 3f0c8a52-6d1e-4b7a-9c2f-1a2b3c4d5e6f | CLM-0000000123 | E-1001      | 120.00 | EUR      | PAID  | F-4004   | 2026-11-22T10:00:00Z |

  Scenario: A malformed claim id is rejected
    Given the current claim is:
      | claim_id       | version | employee_id | state    | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 1       | E-1001      | APPROVED | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id | version | actor_id |
      | CLM-12   | 1       | F-4004   |
    Then the input is rejected on "claim_id"

  Scenario: A version below 1 is rejected
    Given the current claim is:
      | claim_id       | version | employee_id | state    | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 1       | E-1001      | APPROVED | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version | actor_id |
      | CLM-0000000123 | 0       | F-4004   |
    Then the input is rejected on "version"

  Scenario: A claim that does not exist is not found
    Given there is no current claim
    When I run the operation with:
      | claim_id       | version | actor_id |
      | CLM-0000000404 | 4       | E-1001   |
    Then the operation fails with "urn:corpus:claims:claim:error:not_found":
      | claim_id       |
      | CLM-0000000404 |

  Scenario: A user who may not act on the claim is refused
    Given the current claim is:
      | claim_id       | version | employee_id | state    | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 4       | E-1001      | APPROVED | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version | actor_id |
      | CLM-0000000123 | 4       | stranger |
    Then the operation fails with "urn:corpus:claims:claim:error:forbidden":
      | actor_id |
      | stranger |

  Scenario Outline: A claim that is not APPROVED is refused
    Given the current claim is:
      | claim_id       | version | employee_id | state   | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 1       | E-1001      | <state> | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version | actor_id |
      | CLM-0000000123 | 1       | E-1001   |
    Then the operation fails with "urn:corpus:claims:claim:error:invalid_state":
      | claim_id       | state   |
      | CLM-0000000123 | <state> |

    Examples: 
      | state     |
      | DRAFT     |
      | SUBMITTED |
      | REJECTED  |
      | WITHDRAWN |
      | PAID      |

  Scenario Outline: A version other than the current one is refused with the current version
    Given the current claim is:
      | claim_id       | version | employee_id | state    | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 5       | E-1001      | APPROVED | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version   | actor_id |
      | CLM-0000000123 | <version> | E-1001   |
    Then the operation fails with "urn:corpus:claims:claim:error:version_conflict":
      | claim_id       | version |
      | CLM-0000000123 | 5       |

    Examples: 
      | version |
      | 4       |
      | 6       |
