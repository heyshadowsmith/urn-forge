@urn-forge:strict
@urn:corpus:claims:claim:operation:reject_claim
Feature: Reject a claim

  Scenario Outline: The claim moves to REJECTED, and the answer and the event carry the reason
    When I run the operation with:
      | claim_id       | version | actor_id | reason   |
      | CLM-0000000123 | 1       | M-3003   | <reason> |
    Then the output is:
      | claim_id       | state    | total  | currency | version | reason   |
      | CLM-0000000123 | REJECTED | 120.00 | EUR      | 2       | <reason> |
    And the operation emits "urn:corpus:claims:claim:event:claim_rejected":
      | event_id                             | claim_id       | employee_id | total  | currency | state    | actor_id | occurred_at          | reason   |
      | 3f0c8a52-6d1e-4b7a-9c2f-1a2b3c4d5e6f | CLM-0000000123 | E-1001      | 120.00 | EUR      | REJECTED | M-3003   | 2026-11-22T10:00:00Z | <reason> |

    Examples: 
      | reason            |
      | No receipt        |
      | =repeat(500, "r") |

  Scenario Outline: A reason shorter than 10 or longer than 500 characters is rejected
    When I run the operation with:
      | claim_id       | version | actor_id | reason   |
      | CLM-0000000123 | 1       | M-3003   | <reason> |
    Then the input is rejected on "reason"

    Examples: 
      | reason            |
      | No reason         |
      | =repeat(501, "r") |

  Scenario: A malformed claim id is rejected
    When I run the operation with:
      | claim_id | version | actor_id | reason     |
      | CLM-12   | 1       | M-3003   | No receipt |
    Then the input is rejected on "claim_id"

  Scenario: A version below 1 is rejected
    When I run the operation with:
      | claim_id       | version | actor_id | reason     |
      | CLM-0000000123 | 0       | M-3003   | No receipt |
    Then the input is rejected on "version"

  Scenario: A claim that does not exist is not found
    When I run the operation with:
      | claim_id       | version | actor_id | reason     |
      | CLM-0000000404 | 4       | E-1001   | No receipt |
    Then the operation fails with "urn:corpus:claims:claim:error:not_found":
      | claim_id       |
      | CLM-0000000404 |

  Scenario: A user who may not act on the claim is refused
    When I run the operation with:
      | claim_id       | version | actor_id | reason     |
      | CLM-0000000123 | 4       | stranger | No receipt |
    Then the operation fails with "urn:corpus:claims:claim:error:forbidden":
      | actor_id |
      | stranger |

  Scenario: A claim in a state that does not allow the change is refused
    When I run the operation with:
      | claim_id       | version | actor_id | reason     |
      | CLM-0000000412 | 4       | E-1001   | No receipt |
    Then the operation fails with "urn:corpus:claims:claim:error:invalid_state":
      | claim_id       | state |
      | CLM-0000000412 | PAID  |

  Scenario: A claim that changed since the caller read it is refused
    When I run the operation with:
      | claim_id       | version | actor_id | reason     |
      | CLM-0000000409 | 4       | E-1001   | No receipt |
    Then the operation fails with "urn:corpus:claims:claim:error:version_conflict":
      | claim_id       | version |
      | CLM-0000000409 | 4       |
