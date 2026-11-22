@urn-forge:strict
@urn:corpus:ticketing:order:operation:check_out
Feature: Check out a hold

  Scenario: A paid hold becomes an order with one ticket per place
    When I run the operation with:
      | idempotency_key | hold_id                              | payment_reference |
      | checkout-0001   | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | pay_123           |
    Then the output is:
      | order_id                             | fees                                 | total                                  |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | { amount_minor: 500, currency: EUR } | { amount_minor: 8500, currency: EUR } |
    And the operation emits "urn:corpus:ticketing:order:event:order_placed":
      | message_id                           | event_id                             | order_id                             | hold_id                              | ticket_codes                         | occurred_at          |
      | 00000000-0000-4000-8000-000000000001 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | [ABCDEFGH23456789, ZYXWVUTS98765432] | 2026-12-01T19:00:00Z |
    And the operation emits "urn:corpus:ticketing:ticket:event:ticket_issued":
      | message_id                           | event_id                             | ticket_code      | occurred_at          |
      | 00000000-0000-4000-8000-000000000002 | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | ABCDEFGH23456789 | 2026-12-01T19:00:00Z |

  Scenario Outline: Values at the edges of their limits are accepted
    When I run the operation with:
      | idempotency_key   | hold_id                              | payment_reference   |
      | <idempotency_key> | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | <payment_reference> |
    Then the output is:
      | order_id                             |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f |

    Examples:
      | idempotency_key  | payment_reference |
      | =repeat(8, "k")  | p                 |
      | =repeat(64, "k") | pay_123           |

  Scenario Outline: A request outside the limits of a field is rejected at the boundary
    When I run the operation with:
      | idempotency_key   | hold_id   | payment_reference   |
      | <idempotency_key> | <hold_id> | <payment_reference> |
    Then the input is rejected on "<field>"

    Examples:
      | field             | idempotency_key  | hold_id                              | payment_reference |
      | idempotency_key   | =repeat(7, "k")  | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | pay_123           |
      | idempotency_key   | =repeat(65, "k") | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | pay_123           |
      | hold_id           | checkout-0001    | hold-1                               | pay_123           |
      | payment_reference | checkout-0001    | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | ""                |

  Scenario: A checkout without a payment reference is rejected
    When I run the operation with:
      | idempotency_key | hold_id                              | payment_reference |
      | checkout-0001   | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b |                   |
    Then the input is rejected on "payment_reference"

  Scenario: A checkout after the expiry of the hold is refused, and no ticket is issued
    When I run the operation with:
      | idempotency_key | hold_id                              | payment_reference |
      | checkout-0001   | 00000000-0000-4000-8000-000000000410 | pay_123           |
    Then the operation fails with "urn:corpus:ticketing:order:error:hold_expired":
      | hold_id                              | expires_at           |
      | 00000000-0000-4000-8000-000000000410 | 2026-12-01T19:10:00Z |
    And the operation emits no event

  Scenario: A checkout of an unknown hold is refused
    When I run the operation with:
      | idempotency_key | hold_id                              | payment_reference |
      | checkout-0001   | 00000000-0000-4000-8000-000000000404 | pay_123           |
    Then the operation fails with "urn:corpus:ticketing:hold:error:hold_not_found"
    And the operation emits no event

  Scenario: A declined payment issues no ticket
    When I run the operation with:
      | idempotency_key | hold_id                              | payment_reference |
      | checkout-0001   | 3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b | DECLINED          |
    Then the operation fails with "urn:corpus:ticketing:order:error:payment_declined":
      | payment_reference |
      | DECLINED          |
    And the operation emits no event
