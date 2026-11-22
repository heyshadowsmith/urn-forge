@urn-forge:strict
@urn:corpus:claims:claim:operation:get_claim
Feature: Get a claim

  Scenario Outline: The employee who owns the claim, their manager or a finance user reads it by its id
    Given the caller is:
      | role   | employee_id   |
      | <role> | <employee_id> |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state     | purpose              | currency | total  | lines                                                                                                                                                                                                                                                                                                                |
      | CLM-0000000123 | 3       | E-1001      | M-3003     | SUBMITTED | Client visit in Lyon | EUR      | 120.00 | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 } }, { category: MEALS, expense_date: 2026-11-02, description: Lunch, amount: 25.00 }] |
    When I run the operation with:
      | claim_id       | actor_id      |
      | CLM-0000000123 | <employee_id> |
    Then the output is:
      | claim_id       | version | employee_id | manager_id | state     | purpose              | total  | currency | lines                                                                                                                                                                                                                                                                                                                | reason |
      | CLM-0000000123 | 3       | E-1001      | M-3003     | SUBMITTED | Client visit in Lyon | 120.00 | EUR      | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 } }, { category: MEALS, expense_date: 2026-11-02, description: Lunch, amount: 25.00 }] |        |

    Examples:
      | role     | employee_id |
      | employee | E-1001      |
      | manager  | M-3003      |
      | finance  | F-4004      |

  Scenario: A malformed claim id is rejected
    Given the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state     | purpose              | currency | total  | lines                                                                                                                                                                                                                                                                                                                |
      | CLM-0000000123 | 3       | E-1001      | M-3003     | SUBMITTED | Client visit in Lyon | EUR      | 120.00 | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 } }, { category: MEALS, expense_date: 2026-11-02, description: Lunch, amount: 25.00 }] |
    When I run the operation with:
      | claim_id | actor_id |
      | CLM-12   | E-1001   |
    Then the input is rejected on "claim_id"

  Scenario: A claim that does not exist is not found
    Given the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    And there is no current claim
    When I run the operation with:
      | claim_id       | actor_id |
      | CLM-0000000404 | E-1001   |
    Then the operation fails with "urn:corpus:claims:claim:error:not_found":
      | claim_id       |
      | CLM-0000000404 |

  Scenario Outline: Any other caller, or a caller who names another actor, is refused
    Given the caller is:
      | role   | employee_id   |
      | <role> | <employee_id> |
    And the current claim is:
      | claim_id       | version | employee_id | manager_id | state     | purpose              | currency | total  | lines                                                                                                                                                                                                                                                                                                                |
      | CLM-0000000123 | 3       | E-1001      | M-3003     | SUBMITTED | Client visit in Lyon | EUR      | 120.00 | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 } }, { category: MEALS, expense_date: 2026-11-02, description: Lunch, amount: 25.00 }] |
    When I run the operation with:
      | claim_id       | actor_id   |
      | CLM-0000000123 | <actor_id> |
    Then the operation fails with "urn:corpus:claims:claim:error:forbidden":
      | actor_id   |
      | <actor_id> |

    Examples:
      | role     | employee_id | actor_id |
      | employee | E-2002      | E-2002   |
      | manager  | M-5005      | M-5005   |
      | employee | E-1001      | E-2002   |
      | finance  | F-4004      | E-1001   |
