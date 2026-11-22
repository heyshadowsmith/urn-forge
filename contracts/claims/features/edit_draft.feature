@urn-forge:strict
@urn:corpus:claims:claim:operation:edit_draft
Feature: Edit a draft claim

  Scenario Outline: A draft that obeys every rule is kept, and the answer gives its total
    Given the current claim is:
      | claim_id       | version | employee_id | state | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 1       | E-1001      | DRAFT | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version | actor_id | purpose   | currency | lines   |
      | CLM-0000000123 | 1       | E-1001   | <purpose> | EUR      | <lines> |
    Then the output is:
      | claim_id       | state | total   | currency | version |
      | CLM-0000000123 | DRAFT | <total> | EUR      | 2       |

    Examples: 
      | purpose           | lines                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | total    |
      | P                 | [{ category: TRAVEL, expense_date: 2026-11-02, description: T, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 1 } }, { category: LODGING, expense_date: 2026-11-02, description: Hotel, amount: 180.40, receipt: { sha256: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, media_type: image/jpeg, size_bytes: 10485760 } }, { category: MEALS, expense_date: 2026-11-02, description: Lunch, amount: 25.00 }, { category: MILEAGE, expense_date: 2026-11-02, description: Drive to the client, amount: 0.01, distance_km: 1 }, { category: MILEAGE, expense_date: 2026-11-02, description: Drive to Paris, amount: 400.00, distance_km: 2000 }, { category: SUPPLIES, expense_date: 2026-11-02, description: Paper, amount: 12.50, receipt: { sha256: cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc, media_type: image/png, size_bytes: 2048 } }, { category: TRAINING, expense_date: 2026-11-02, description: Course, amount: 10000.00, receipt: { sha256: dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd, media_type: application/pdf, size_bytes: 900000 } }, { category: OTHER, expense_date: 2026-11-02, description: DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD, amount: 3.10 }] | 10716.01 |
      | =repeat(500, "p") | =repeat(50, { category: MEALS, expense_date: 2026-11-02, description: Lunch, amount: 10.00 })                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 500.00   |
      | Client visit      | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 } }]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 95.00    |

  Scenario: A rejected claim that is edited goes back to DRAFT
    Given the current claim is:
      | claim_id       | version | employee_id | state    | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 3       | E-1001      | REJECTED | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version | actor_id | purpose      | currency | lines                                                                                                          |
      | CLM-0000000123 | 3       | E-1001   | Client visit | EUR      | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 95.00, distance_km: 460 }] |
    Then the output is:
      | claim_id       | state | total | currency | version |
      | CLM-0000000123 | DRAFT | 95.00 | EUR      | 4       |

  Scenario Outline: A purpose that is empty or longer than 500 characters is rejected
    Given the current claim is:
      | claim_id       | version | employee_id | state | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 1       | E-1001      | DRAFT | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version | actor_id | purpose   | currency | lines                                                                                                                                                                                                                              |
      | CLM-0000000123 | 1       | E-1001   | <purpose> | EUR      | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 } }] |
    Then the input is rejected on "purpose"

    Examples: 
      | purpose           |
      | ""                |
      | =repeat(501, "p") |

  Scenario: A currency that is not three capital letters is rejected
    Given the current claim is:
      | claim_id       | version | employee_id | state | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 1       | E-1001      | DRAFT | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version | actor_id | purpose      | currency | lines                                                                                                                                                                                                                              |
      | CLM-0000000123 | 1       | E-1001   | Client visit | eur      | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 } }] |
    Then the input is rejected on "currency"

  Scenario Outline: A list of lines that breaks a rule of its values is rejected
    Given the current claim is:
      | claim_id       | version | employee_id | state | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 1       | E-1001      | DRAFT | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version | actor_id | purpose      | currency | lines   |
      | CLM-0000000123 | 1       | E-1001   | Client visit | EUR      | <lines> |
    Then the input is rejected on "lines"

    Examples: 
      | lines                                                                                                                                                                                                                                                                                  |
      | []                                                                                                                                                                                                                                                                                     |
      | =repeat(51, { category: MEALS, expense_date: 2026-11-02, description: Lunch, amount: 10.00 })                                                                                                                                                                                          |
      | [{ category: BOAT, expense_date: 2026-11-02, description: Train to Lyon, amount: 10.00 }]                                                                                                                                                                                              |
      | [{ category: MEALS, expense_date: 2026-11-02, description: Train to Lyon, amount: 0 }]                                                                                                                                                                                                 |
      | [{ category: TRAINING, expense_date: 2026-11-02, description: Train to Lyon, amount: 10000.01, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 } }]                                                |
      | [{ category: MEALS, expense_date: 2026-11-02, description: Train to Lyon, amount: 1.005 }]                                                                                                                                                                                             |
      | [{ category: MEALS, expense_date: 2026-11-02, description: "", amount: 10.00 }]                                                                                                                                                                                                        |
      | [{ category: MEALS, expense_date: 2026-11-02, description: DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD, amount: 10.00 }] |
      | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: xyz, media_type: application/pdf, size_bytes: 48213 } }]                                                                                                                  |
      | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: image/gif, size_bytes: 48213 } }]                                                           |
      | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 0 } }]                                                         |
      | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 10485761 } }]                                                  |
      | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive, amount: 0.20, distance_km: 0.5 }]                                                                                                                                                                                  |
      | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive, amount: 800.00, distance_km: 2000.5 }]                                                                                                                                                                             |

  Scenario Outline: A line that breaks a rule across its values is rejected
    Given the current claim is:
      | claim_id       | version | employee_id | state | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 1       | E-1001      | DRAFT | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version | actor_id | purpose      | currency | lines   |
      | CLM-0000000123 | 1       | E-1001   | Client visit | EUR      | <lines> |
    Then the input is rejected by "urn:corpus:claims:line:invariant:<invariant>"

    Examples: 
      | invariant                 | lines                                                                                                                                                                                                                                        |
      | receipt_above_25          | [{ category: MEALS, expense_date: 2026-11-02, description: Dinner, amount: 25.01 }]                                                                                                                                                          |
      | mileage_has_distance      | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive, amount: 20.00 }]                                                                                                                                                         |
      | mileage_has_distance      | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive, amount: 20.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 }, distance_km: 40 }] |
      | distance_only_for_mileage | [{ category: MEALS, expense_date: 2026-11-02, description: Lunch, amount: 10.00, distance_km: 40 }]                                                                                                                                          |

  Scenario: A malformed claim id is rejected
    Given the current claim is:
      | claim_id       | version | employee_id | state | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 1       | E-1001      | DRAFT | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id | version | actor_id | purpose      | currency | lines                                                                                                                                                                                                                              |
      | CLM-12   | 1       | E-1001   | Client visit | EUR      | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 } }] |
    Then the input is rejected on "claim_id"

  Scenario: A version below 1 is rejected
    Given the current claim is:
      | claim_id       | version | employee_id | state | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 1       | E-1001      | DRAFT | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version | actor_id | purpose      | currency | lines                                                                                                                                                                                                                              |
      | CLM-0000000123 | 0       | E-1001   | Client visit | EUR      | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 } }] |
    Then the input is rejected on "version"

  Scenario: A claim that does not exist is not found
    Given there is no current claim
    When I run the operation with:
      | claim_id       | version | actor_id | purpose      | currency | lines                                                                                                                                                                                                                              |
      | CLM-0000000404 | 4       | E-1001   | Client visit | EUR      | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 } }] |
    Then the operation fails with "urn:corpus:claims:claim:error:not_found":
      | claim_id       |
      | CLM-0000000404 |

  Scenario: A user who may not act on the claim is refused
    Given the current claim is:
      | claim_id       | version | employee_id | state | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 4       | E-1001      | DRAFT | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version | actor_id | purpose      | currency | lines                                                                                                                                                                                                                              |
      | CLM-0000000123 | 4       | stranger | Client visit | EUR      | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 } }] |
    Then the operation fails with "urn:corpus:claims:claim:error:forbidden":
      | actor_id |
      | stranger |

  Scenario Outline: A claim that is not DRAFT or REJECTED is refused
    Given the current claim is:
      | claim_id       | version | employee_id | state   | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 1       | E-1001      | <state> | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version | actor_id | purpose      | currency | lines                                                                                                                                                                                                                              |
      | CLM-0000000123 | 1       | E-1001   | Client visit | EUR      | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 } }] |
    Then the operation fails with "urn:corpus:claims:claim:error:invalid_state":
      | claim_id       | state   |
      | CLM-0000000123 | <state> |

    Examples: 
      | state     |
      | SUBMITTED |
      | APPROVED  |
      | WITHDRAWN |
      | PAID      |

  Scenario Outline: A version other than the current one is refused with the current version
    Given the current claim is:
      | claim_id       | version | employee_id | state | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 5       | E-1001      | DRAFT | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version   | actor_id | purpose      | currency | lines                                                                                                                                                                                                                              |
      | CLM-0000000123 | <version> | E-1001   | Client visit | EUR      | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 } }] |
    Then the operation fails with "urn:corpus:claims:claim:error:version_conflict":
      | claim_id       | version |
      | CLM-0000000123 | 5       |

    Examples: 
      | version |
      | 4       |
      | 6       |

  Scenario: A receipt that is already on another claim is refused
    Given the current claim is:
      | claim_id       | version | employee_id | state | purpose      | currency | total  | lines                                                                                                           |
      | CLM-0000000123 | 1       | E-1001      | DRAFT | Client visit | EUR      | 120.00 | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 120.00, distance_km: 460 }] |
    When I run the operation with:
      | claim_id       | version | actor_id | purpose      | currency | lines                                                                                                                                                                                                                              |
      | CLM-0000000123 | 1       | E-1001   | Client visit | EUR      | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, media_type: application/pdf, size_bytes: 48213 } }] |
    Then the operation fails with "urn:corpus:claims:claim:error:duplicate_receipt":
      | sha256                                                           |
      | ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff |
