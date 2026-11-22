@urn-forge:strict
@urn:corpus:claims:claim:operation:withdraw_claim
Feature: Withdraw a claim

  Scenario: The claim moves to WITHDRAWN, its version goes up by 1, and an event tells it
    When I run the operation with:
      | claim_id       | version | actor_id |
      | CLM-0000000123 | 1       | E-1001   |
    Then the output is:
      | claim_id       | state     | total  | currency | version |
      | CLM-0000000123 | WITHDRAWN | 120.00 | EUR      | 2       |
    And the operation emits "urn:corpus:claims:claim:event:claim_withdrawn":
      | event_id                             | claim_id       | employee_id | total  | currency | state     | actor_id | occurred_at          |
      | 3f0c8a52-6d1e-4b7a-9c2f-1a2b3c4d5e6f | CLM-0000000123 | E-1001      | 120.00 | EUR      | WITHDRAWN | E-1001   | 2026-11-22T10:00:00Z |

  Scenario: A malformed claim id is rejected
    When I run the operation with:
      | claim_id | version | actor_id |
      | CLM-12   | 1       | E-1001   |
    Then the input is rejected on "claim_id"

  Scenario: A version below 1 is rejected
    When I run the operation with:
      | claim_id       | version | actor_id |
      | CLM-0000000123 | 0       | E-1001   |
    Then the input is rejected on "version"

  Scenario: A claim that does not exist is not found
    When I run the operation with:
      | claim_id       | version | actor_id |
      | CLM-0000000404 | 4       | E-1001   |
    Then the operation fails with "urn:corpus:claims:claim:error:not_found":
      | claim_id       |
      | CLM-0000000404 |

  Scenario: A user who may not act on the claim is refused
    When I run the operation with:
      | claim_id       | version | actor_id |
      | CLM-0000000123 | 4       | stranger |
    Then the operation fails with "urn:corpus:claims:claim:error:forbidden":
      | actor_id |
      | stranger |

  Scenario: A claim in a state that does not allow the change is refused
    When I run the operation with:
      | claim_id       | version | actor_id |
      | CLM-0000000412 | 4       | E-1001   |
    Then the operation fails with "urn:corpus:claims:claim:error:invalid_state":
      | claim_id       | state |
      | CLM-0000000412 | PAID  |

  Scenario: A claim that changed since the caller read it is refused
    When I run the operation with:
      | claim_id       | version | actor_id |
      | CLM-0000000409 | 4       | E-1001   |
    Then the operation fails with "urn:corpus:claims:claim:error:version_conflict":
      | claim_id       | version |
      | CLM-0000000409 | 4       |
