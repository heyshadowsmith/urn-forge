@urn-forge:strict
@urn:corpus:inventory:adjustment:operation:adjust_stock
Feature: Adjust the on-hand stock

  Scenario Outline: An adjustment changes the on-hand count by its delta, for its reason
    When I run the operation with:
      | idempotency_key   | sku   | location   | delta   | reason   |
      | <idempotency_key> | <sku> | AMS-B-0142 | <delta> | <reason> |
    Then the output is:
      | sku   | location   | on_hand   | reserved | available   |
      | <sku> | AMS-B-0142 | <on_hand> | 100      | <available> |
    And the operation emits "urn:corpus:inventory:adjustment:event:stock_adjusted":
      | event_id                             | sku   | location   | quantity_changed | reason   | occurred_at              |
      | 7d3f1c2a-5b4e-4a6d-9c8b-000000000001 | <sku> | AMS-B-0142 | <delta>          | <reason> | 2026-11-22T10:00:00.000Z |
    And the operation emits no "urn:corpus:inventory:stock:event:stock_depleted"

    Examples:
      | idempotency_key  | sku                              | delta  | reason      | on_hand | available |
      | adj-0001         | WIDGET-1                         | -3     | DAMAGED     | 497     | 397       |
      | =repeat(64, "a") | A1B                              | -1     | LOST        | 499     | 399       |
      | adj-0003         | ABCDEFGHIJKLMNOPQRSTUVWXYZ-12345 | 100000 | FOUND       | 100500  | 100400    |
      | adj-0004         | WIDGET-1                         | 7      | CYCLE_COUNT | 507     | 407       |
      | adj-0005         | WIDGET-1                         | 1      | CORRECTION  | 501     | 401       |

  Scenario: An adjustment that takes the last available unit makes the stock depleted
    When I run the operation with:
      | idempotency_key | sku      | location   | delta | reason |
      | adj-0006        | WIDGET-1 | AMS-B-0142 | -400  | LOST   |
    Then the operation emits "urn:corpus:inventory:adjustment:event:stock_adjusted":
      | quantity_changed | level                                                                              |
      | -400             | { sku: WIDGET-1, location: AMS-B-0142, on_hand: 100, reserved: 100, available: 0 } |
    And the operation emits "urn:corpus:inventory:stock:event:stock_depleted":
      | event_id                             | sku      | location   |
      | 7d3f1c2a-5b4e-4a6d-9c8b-000000000002 | WIDGET-1 | AMS-B-0142 |

  Scenario Outline: An adjustment below the reserved count is refused and changes nothing
    When I run the operation with:
      | idempotency_key | sku      | location   | delta   | reason |
      | adj-0007        | WIDGET-1 | AMS-B-0142 | <delta> | LOST   |
    Then the operation fails with "urn:corpus:inventory:stock:error:insufficient_stock":
      | short_lines   |
      | <short_lines> |
    And the operation emits no event

    Examples:
      | delta   | short_lines                                                                  |
      | -401    | [{ sku: WIDGET-1, location: AMS-B-0142, requested: 401, available: 400 }]    |
      | -100000 | [{ sku: WIDGET-1, location: AMS-B-0142, requested: 100000, available: 400 }] |

  Scenario Outline: A delta of 0 or outside -100000 to 100000 is rejected
    When I run the operation with:
      | idempotency_key | sku      | location   | delta   | reason |
      | adj-0008        | WIDGET-1 | AMS-B-0142 | <delta> | LOST   |
    Then the input is rejected on "delta"

    Examples:
      | delta   |
      | 0       |
      | -100001 |
      | 100001  |

  Scenario: A reason that is not one of the codes is rejected
    When I run the operation with:
      | idempotency_key | sku      | location   | delta | reason |
      | adj-0009        | WIDGET-1 | AMS-B-0142 | -1    | STOLEN |
    Then the input is rejected on "reason"

  Scenario Outline: A SKU or location that breaks its rules is rejected
    When I run the operation with:
      | idempotency_key | sku   | location   | delta | reason |
      | adj-0010        | <sku> | <location> | -1    | LOST   |
    Then the input is rejected on "<field>"

    Examples:
      | sku              | location   | field    |
      | AB               | AMS-B-0142 | sku      |
      | =repeat(33, "A") | AMS-B-0142 | sku      |
      | WIDGET-1-        | AMS-B-0142 | sku      |
      | WIDGET-1         | AMS-0142   | location |

  Scenario Outline: An idempotency key shorter than 8 or longer than 64 characters is rejected
    When I run the operation with:
      | idempotency_key   | sku      | location   | delta | reason |
      | <idempotency_key> | WIDGET-1 | AMS-B-0142 | -1    | LOST   |
    Then the input is rejected on "idempotency_key"

    Examples:
      | idempotency_key  |
      | adj-001          |
      | =repeat(65, "a") |

  Scenario: An adjustment of an unknown SKU is refused
    When I run the operation with:
      | idempotency_key | sku         | location   | delta | reason |
      | adj-0011        | NO-SUCH-SKU | AMS-B-0142 | 1     | FOUND  |
    Then the operation fails with "urn:corpus:inventory:stock:error:unknown_sku":
      | sku         |
      | NO-SUCH-SKU |

  Scenario: An adjustment at an unknown location is refused
    When I run the operation with:
      | idempotency_key | sku      | location   | delta | reason |
      | adj-0012        | WIDGET-1 | ZZZ-Z-9999 | 1     | FOUND  |
    Then the operation fails with "urn:corpus:inventory:stock:error:unknown_location":
      | location   |
      | ZZZ-Z-9999 |

  Scenario: An idempotency key used before with a different body is refused
    When I run the operation with:
      | idempotency_key | sku      | location   | delta | reason |
      | conflict-key    | WIDGET-1 | AMS-B-0142 | 1     | FOUND  |
    Then the operation fails with "urn:corpus:inventory:request:error:idempotency_conflict":
      | idempotency_key |
      | conflict-key    |
