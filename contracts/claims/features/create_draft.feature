@urn-forge:strict
@urn:corpus:claims:claim:operation:create_draft
Feature: Create a draft claim

  Scenario Outline: A draft that obeys every rule is kept, and the answer gives its total
    Given the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    When I run the operation with:
      | actor_id | employee_id | purpose   | currency | lines   |
      | E-1001   | E-1001      | <purpose> | EUR      | <lines> |
    Then the output is:
      | claim_id       | state | total   | currency | version |
      | CLM-0000000001 | DRAFT | <total> | EUR      | 1       |

    Examples:
      | purpose           | lines                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | total    |
      | P                 | [{ category: TRAVEL, expense_date: 2026-11-02, description: T, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 1 } }, { category: LODGING, expense_date: 2026-11-02, description: Hotel, amount: 180.40, receipt: { sha256: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb, media_type: image/jpeg, size_bytes: 10485760 } }, { category: MEALS, expense_date: 2026-11-02, description: Lunch, amount: 25.00 }, { category: MILEAGE, expense_date: 2026-11-02, description: Drive to the client, amount: 0.01, distance_km: 1 }, { category: MILEAGE, expense_date: 2026-11-02, description: Drive to Paris, amount: 400.00, distance_km: 2000 }, { category: SUPPLIES, expense_date: 2026-11-02, description: Paper, amount: 12.50, receipt: { sha256: cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc, media_type: image/png, size_bytes: 2048 } }, { category: TRAINING, expense_date: 2026-11-02, description: Course, amount: 10000.00, receipt: { sha256: dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd, media_type: application/pdf, size_bytes: 900000 } }, { category: OTHER, expense_date: 2026-11-02, description: DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD, amount: 3.10 }] | 10716.01 |
      | =repeat(500, "p") | =repeat(50, { category: MEALS, expense_date: 2026-11-02, description: Lunch, amount: 10.00 })                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 500.00   |
      | Client visit      | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 } }]                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 95.00    |

  Scenario Outline: A claim in each currency the domain accepts is kept, with its total in that currency
    Given the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    When I run the operation with:
      | actor_id | employee_id | purpose      | currency   | lines |
      | E-1001   | E-1001      | Client visit | <currency> | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 } }] |
    Then the output is:
      | claim_id       | state | total | currency   | version |
      | CLM-0000000001 | DRAFT | 95.00 | <currency> | 1       |

    Examples:
      | currency |
      | CHF      |
      | EUR      |
      | GBP      |
      | USD      |

  Scenario Outline: A purpose that is empty or longer than 500 characters is rejected
    Given the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    When I run the operation with:
      | actor_id | employee_id | purpose   | currency | lines                                                                                                                                                                                                                              |
      | E-1001   | E-1001      | <purpose> | EUR      | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 } }] |
    Then the input is rejected on "purpose"
    And the operation fails with "urn:corpus:claims:claim:error:invalid_request"
    And nothing changes

    Examples:
      | purpose           |
      | ""                |
      | =repeat(501, "p") |

  Scenario Outline: A currency that is not one the domain accepts is rejected
    Given the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    When I run the operation with:
      | actor_id | employee_id | purpose      | currency   | lines                                                                                                                                                                                                                              |
      | E-1001   | E-1001      | Client visit | <currency> | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 } }] |
    Then the input is rejected on "currency"
    And the operation fails with "urn:corpus:claims:claim:error:invalid_request"
    And nothing changes

    Examples:
      | currency |
      | eur      |
      | XYZ      |
      | JPY      |

  Scenario Outline: A list of lines that breaks a rule of its values is rejected
    Given the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    When I run the operation with:
      | actor_id | employee_id | purpose      | currency | lines   |
      | E-1001   | E-1001      | Client visit | EUR      | <lines> |
    Then the input is rejected on "lines"
    And the operation fails with "urn:corpus:claims:claim:error:invalid_request"
    And nothing changes

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
    Given the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    When I run the operation with:
      | actor_id | employee_id | purpose      | currency | lines   |
      | E-1001   | E-1001      | Client visit | EUR      | <lines> |
    Then the input is rejected by "urn:corpus:claims:line:invariant:<invariant>"
    And the operation fails with "urn:corpus:claims:claim:error:invalid_request"
    And nothing changes

    Examples:
      | invariant                 | lines                                                                                                                                                                                                                                        |
      | receipt_above_25          | [{ category: MEALS, expense_date: 2026-11-02, description: Dinner, amount: 25.01 }]                                                                                                                                                          |
      | mileage_has_distance      | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive, amount: 20.00 }]                                                                                                                                                         |
      | mileage_has_distance      | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive, amount: 20.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 }, distance_km: 40 }] |
      | distance_only_for_mileage | [{ category: MEALS, expense_date: 2026-11-02, description: Lunch, amount: 10.00, distance_km: 40 }]                                                                                                                                          |

  Scenario Outline: An employee may create a claim only for themselves, as themselves
    Given the caller is:
      | role   | employee_id   |
      | <role> | <employee_id> |
    When I run the operation with:
      | actor_id   | employee_id | purpose      | currency | lines                                                                                                                                                                                                                              |
      | <actor_id> | E-1001      | Client visit | EUR      | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, media_type: application/pdf, size_bytes: 48213 } }] |
    Then the operation fails with "urn:corpus:claims:claim:error:forbidden":
      | actor_id   |
      | <actor_id> |
    And nothing changes

    Examples:
      | role     | employee_id | actor_id |
      | employee | E-2002      | E-2002   |
      | manager  | M-3003      | M-3003   |
      | employee | E-1001      | E-2002   |

  Scenario: A receipt that is already on another claim is refused
    Given the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    When I run the operation with:
      | actor_id | employee_id | purpose      | currency | lines                                                                                                                                                                                                                              |
      | E-1001   | E-1001      | Client visit | EUR      | [{ category: TRAVEL, expense_date: 2026-11-02, description: Train to Lyon, amount: 95.00, receipt: { sha256: ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, media_type: application/pdf, size_bytes: 48213 } }] |
    Then the operation fails with "urn:corpus:claims:claim:error:duplicate_receipt":
      | sha256                                                           |
      | ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff |
    And nothing changes

  Scenario: A repeat with the same idempotency key by the same caller within 24 hours returns the first answer, whatever its body
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    When I run the operation with:
      | idempotency_key | actor_id | employee_id | purpose      | currency | lines                                                                                                          |
      | key-0001        | E-1001   | E-1001      | Client visit | EUR      | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 95.00, distance_km: 460 }] |
    And the time is "2026-11-23T09:59:59.999Z"
    And I run the operation again with:
      | idempotency_key | actor_id | employee_id | purpose       | currency | lines                                                                                                          |
      | key-0001        | E-1001   | E-1001      | Another visit | EUR      | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 50.00, distance_km: 200 }] |
    Then the answer is the first answer
    And the output is:
      | claim_id       | state | total | currency | version |
      | CLM-0000000001 | DRAFT | 95.00 | EUR      | 1       |

  Scenario: The same idempotency key sent by another caller is a new request
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    When I run the operation with:
      | idempotency_key | actor_id | employee_id | purpose      | currency | lines                                                                                                          |
      | key-0001        | E-1001   | E-1001      | Client visit | EUR      | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 95.00, distance_km: 460 }] |
    And the caller is:
      | role     | employee_id |
      | employee | E-2002      |
    And I run the operation again with:
      | idempotency_key | actor_id | employee_id | purpose      | currency | lines                                                                                                          |
      | key-0001        | E-2002   | E-2002      | Client visit | EUR      | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 50.00, distance_km: 200 }] |
    Then the output is:
      | claim_id       | state | total | currency | version |
      | CLM-0000000001 | DRAFT | 50.00 | EUR      | 1       |

  Scenario: The same idempotency key 24 hours after the first request is a new request
    Given the time is "2026-11-22T10:00:00Z"
    And the caller is:
      | role     | employee_id |
      | employee | E-1001      |
    When I run the operation with:
      | idempotency_key | actor_id | employee_id | purpose      | currency | lines                                                                                                          |
      | key-0001        | E-1001   | E-1001      | Client visit | EUR      | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 95.00, distance_km: 460 }] |
    And the time is "2026-11-23T10:00:00Z"
    And I run the operation again with:
      | idempotency_key | actor_id | employee_id | purpose      | currency | lines                                                                                                          |
      | key-0001        | E-1001   | E-1001      | Client visit | EUR      | [{ category: MILEAGE, expense_date: 2026-11-02, description: Drive to Lyon, amount: 50.00, distance_km: 200 }] |
    Then the output is:
      | claim_id       | state | total | currency | version |
      | CLM-0000000001 | DRAFT | 50.00 | EUR      | 1       |
