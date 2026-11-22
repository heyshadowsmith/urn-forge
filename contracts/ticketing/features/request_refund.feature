@urn-forge:strict
@urn:corpus:ticketing:refund:operation:request_refund
Feature: Refund tickets

  Scenario Outline: Refunded tickets are listed with the amount
    When I run the operation with:
      | idempotency_key   | order_id                             | ticket_codes   |
      | <idempotency_key> | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | <ticket_codes> |
    Then the output is:
      | order_id                             | ticket_codes   | amount   |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | <ticket_codes> | <amount> |
    And the operation emits "urn:corpus:ticketing:ticket:event:ticket_refunded":
      | event_id                             | ticket_code      |
      | 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f | ABCDEFGH23456789 |

    Examples:
      | idempotency_key  | ticket_codes                         | amount                                 |
      | =repeat(8, "k")  | [ABCDEFGH23456789]                   | { amount_minor: 5000, currency: EUR }  |
      | =repeat(64, "k") | [ABCDEFGH23456789, ZYXWVUTS98765432] | { amount_minor: 10000, currency: EUR } |

  Scenario Outline: A request outside the limits of a field is rejected at the boundary
    When I run the operation with:
      | idempotency_key   | order_id   | ticket_codes   |
      | <idempotency_key> | <order_id> | <ticket_codes> |
    Then the input is rejected on "<field>"

    Examples:
      | field           | idempotency_key  | order_id                             | ticket_codes                         |
      | idempotency_key | =repeat(7, "k")  | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789]                   |
      | idempotency_key | =repeat(65, "k") | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789]                   |
      | order_id        | refund-0001      | order-1                              | [ABCDEFGH23456789]                   |
      | ticket_codes    | refund-0001      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | []                                   |
      | ticket_codes    | refund-0001      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789, ABCDEFGH23456789] |
      | ticket_codes    | refund-0001      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH2345678O]                   |

  Scenario: A used ticket cannot be refunded
    When I run the operation with:
      | idempotency_key | order_id                             | ticket_codes                         |
      | refund-0001     | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [ABCDEFGH23456789, USEDUSEDUSEDUSED] |
    Then the operation fails with "urn:corpus:ticketing:refund:error:ticket_not_refundable":
      | ticket_code      |
      | USEDUSEDUSEDUSED |
    And the operation emits no event
