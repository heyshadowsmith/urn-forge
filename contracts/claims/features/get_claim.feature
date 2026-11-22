@urn-forge:strict
@urn:corpus:claims:claim:operation:get_claim
Feature: Get a claim

  Scenario: A claim is read by its id
    When I run the operation with:
      | claim_id       | actor_id |
      | CLM-0000000123 | M-3003   |
    Then the output is:
      | claim_id       | version | employee_id | state     | total  | currency | reason |
      | CLM-0000000123 | 3       | E-1001      | SUBMITTED | 120.00 | EUR      |        |

  Scenario: A malformed claim id is rejected
    When I run the operation with:
      | claim_id | actor_id |
      | CLM-12   | M-3003   |
    Then the input is rejected on "claim_id"

  Scenario: A claim that does not exist is not found
    When I run the operation with:
      | claim_id       | actor_id |
      | CLM-0000000404 | E-1001   |
    Then the operation fails with "urn:corpus:claims:claim:error:not_found":
      | claim_id       |
      | CLM-0000000404 |

  Scenario: A user who may not act on the claim is refused
    When I run the operation with:
      | claim_id       | actor_id |
      | CLM-0000000123 | stranger |
    Then the operation fails with "urn:corpus:claims:claim:error:forbidden":
      | actor_id |
      | stranger |
