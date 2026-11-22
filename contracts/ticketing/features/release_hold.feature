@urn-forge:strict
@urn:corpus:ticketing:hold:operation:release_hold
Feature: Release a hold

  Scenario: A released hold leaves ACTIVE
    When I run the operation with:
      | hold_id                              |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b |
    Then the output is:
      | hold_id                              | hold_status |
      | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | RELEASED    |

  Scenario: A hold identifier that is not a UUID is rejected at the boundary
    When I run the operation with:
      | hold_id |
      | hold-1  |
    Then the input is rejected on "hold_id"

  Scenario: An unknown hold is refused
    When I run the operation with:
      | hold_id                              |
      | 00000000-0000-4000-8000-000000000404 |
    Then the operation fails with "urn:corpus:ticketing:hold:error:hold_not_found":
      | hold_id                              |
      | 00000000-0000-4000-8000-000000000404 |
