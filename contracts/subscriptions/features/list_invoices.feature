@urn-forge:strict
@urn:corpus:subscriptions:invoice:operation:list_invoices
Feature: List the invoices of a subscription

  Scenario Outline: The invoices of a subscription are listed, optionally with one status only
    When I run the operation with:
      | subscription_id              | status   |
      | sub_aaaaaaaaaaaaaaaaaaaaaaaa | <status> |
    Then the output is:
      | invoices |
      | <invoices> |

    Examples:
      | status        | invoices                                                                                                                                                                                                                                                                                                                                                         |
      | paid          | [{ invoice_id: in_1, subscription_id: sub_aaaaaaaaaaaaaaaaaaaaaaaa, status: paid, period_start: 2026-11-01T00:00:00Z, period_end: 2026-12-01T00:00:00Z, lines: [{ quantity: 2, amount: { amount_minor: 3000, currency: EUR } }], total: { amount_minor: 3000, currency: EUR } }] |
      | open          | [{ invoice_id: in_2, subscription_id: sub_aaaaaaaaaaaaaaaaaaaaaaaa, status: open, period_start: 2026-11-01T00:00:00Z, period_end: 2026-12-01T00:00:00Z, lines: [{ quantity: 2, amount: { amount_minor: 3000, currency: EUR } }], total: { amount_minor: 3000, currency: EUR } }] |
      | draft         | []                                                                                                                                                                                                                                                                                                                                                             |
      | void          | []                                                                                                                                                                                                                                                                                                                                                             |
      | uncollectible | []                                                                                                                                                                                                                                                                                                                                                             |

  Scenario Outline: An unknown status or a bad subscription id is rejected
    When I run the operation with:
      | subscription_id   | status   |
      | <subscription_id> | <status> |
    Then the input is rejected on "<field>"

    Examples:
      | field           | subscription_id              | status   |
      | status          | sub_aaaaaaaaaaaaaaaaaaaaaaaa | refunded |
      | subscription_id | in_1                         |          |

  Scenario: The invoices of an unknown subscription are not found
    When I run the operation with:
      | subscription_id              |
      | sub_000000000000000000000000 |
    Then the operation fails with "urn:corpus:subscriptions:subscription:error:not_found"
