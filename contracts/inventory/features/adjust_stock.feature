Feature: Adjust stock
  A warehouse supervisor corrects the on-hand count of one SKU at one location. The shell loads the
  stored level of the SKU at the location.

  Scenario Outline: A delta corrects the on-hand count
    When I run "adjust_stock" with:
      | caller.role          | now                      | idempotency_key | sku      | location   | delta   | reason   | stored_level                                                                                     |
      | warehouse_supervisor | 2026-11-22T10:00:00.000Z | adjust-0001     | WIDGET-1 | AMS-B-0142 | <delta> | <reason> | {"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400} |
    Then the output is "adjustment_made":
      | level   | depletions |
      | <level> | []         |

    Examples:
      | delta  | reason      | level                                                                                                  |
      | -5     | DAMAGED     | {"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 495, "reserved": 100, "available": 395}       |
      | -1     | LOST        | {"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 499, "reserved": 100, "available": 399}       |
      | 12     | FOUND       | {"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 512, "reserved": 100, "available": 412}       |
      | -399   | CYCLE_COUNT | {"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 101, "reserved": 100, "available": 1}         |
      | 100000 | CORRECTION  | {"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 100500, "reserved": 100, "available": 100400} |

  Scenario: A correction to no available units depletes the stock
    When I run "adjust_stock" with:
      | caller.role          | now                      | idempotency_key | sku      | location   | delta | reason  | stored_level                                                                                     |
      | warehouse_supervisor | 2026-11-22T10:00:00.000Z | adjust-0001     | WIDGET-1 | AMS-B-0142 | -400  | DAMAGED | {"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400} |
    Then the output is "adjustment_made":
      | level                                                                                          |
      | {"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 100, "reserved": 100, "available": 0} |

  Scenario: A delta below the reserved count is refused
    When I run "adjust_stock" with:
      | caller.role          | now                      | idempotency_key | sku      | location   | delta | reason  | stored_level                                                                                     |
      | warehouse_supervisor | 2026-11-22T10:00:00.000Z | adjust-0001     | WIDGET-1 | AMS-B-0142 | -401  | DAMAGED | {"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400} |
    Then the output is "insufficient_stock":
      | error_code         | short_lines                                                                         |
      | INSUFFICIENT_STOCK | [{"sku": "WIDGET-1", "location": "AMS-B-0142", "requested": 401, "available": 400}] |

  Scenario: A SKU with no stored level is unknown
    When I run "adjust_stock" with:
      | caller.role          | now                      | idempotency_key | sku         | location   | delta | reason  |
      | warehouse_supervisor | 2026-11-22T10:00:00.000Z | adjust-0001     | NO-SUCH-SKU | AMS-B-0142 | -5    | DAMAGED |
    Then the output is "unknown_sku":
      | error_code  | sku         |
      | UNKNOWN_SKU | NO-SUCH-SKU |

  Scenario: A location of no warehouse is unknown
    When I run "adjust_stock" with:
      | caller.role          | now                      | idempotency_key | sku      | location   | delta | reason  |
      | warehouse_supervisor | 2026-11-22T10:00:00.000Z | adjust-0001     | WIDGET-1 | ZZZ-Z-9999 | -5    | DAMAGED |
    Then the output is "unknown_location":
      | error_code       | location   |
      | UNKNOWN_LOCATION | ZZZ-Z-9999 |

  Scenario Outline: Another caller may not adjust stock
    When I run "adjust_stock" with:
      | caller.role | now                      | idempotency_key | sku      | location   | delta | reason  | stored_level                                                                                     |
      | <role>      | 2026-11-22T10:00:00.000Z | adjust-0001     | WIDGET-1 | AMS-B-0142 | -5    | DAMAGED | {"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400} |
    Then the output is "forbidden":
      | error_code | role   |
      | FORBIDDEN  | <role> |

    Examples:
      | role              |
      | order_system      |
      | purchasing_system |
      | warehouse_staff   |
      | clock             |

  Scenario Outline: An adjustment that breaks a rule is rejected
    When I run "adjust_stock" with:
      | caller.role | now                      | idempotency_key | sku   | location   | delta   | reason   | stored_level   |
      | <role>      | 2026-11-22T10:00:00.000Z | adjust-0001     | <sku> | <location> | <delta> | <reason> | <stored_level> |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule               | definition | role                 | sku                               | location   | delta   | reason     | stored_level                                                                                     |
      | minimum            | delta      | warehouse_supervisor | WIDGET-1                          | AMS-B-0142 | -100001 | DAMAGED    |                                                                                                  |
      | maximum            | delta      | warehouse_supervisor | WIDGET-1                          | AMS-B-0142 | 100001  | FOUND      |                                                                                                  |
      | not_zero           | delta      | warehouse_supervisor | WIDGET-1                          | AMS-B-0142 | 0       | CORRECTION |                                                                                                  |
      | enum               | reason     | warehouse_supervisor | WIDGET-1                          | AMS-B-0142 | -5      | STOLEN     |                                                                                                  |
      | enum               | role       | auditor              | WIDGET-1                          | AMS-B-0142 | -5      | DAMAGED    |                                                                                                  |
      | minLength          | sku        | warehouse_supervisor | AB                                | AMS-B-0142 | -5      | DAMAGED    |                                                                                                  |
      | maxLength          | sku        | warehouse_supervisor | AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA | AMS-B-0142 | -5      | DAMAGED    |                                                                                                  |
      | pattern            | sku        | warehouse_supervisor | -WIDGET                           | AMS-B-0142 | -5      | DAMAGED    |                                                                                                  |
      | pattern            | sku        | warehouse_supervisor | widget-1                          | AMS-B-0142 | -5      | DAMAGED    |                                                                                                  |
      | pattern            | location   | warehouse_supervisor | WIDGET-1                          | AMS-B-142  | -5      | DAMAGED    |                                                                                                  |
      | level_is_the_query | adjustment | warehouse_supervisor | WIDGET-1                          | AMS-B-0143 | -5      | DAMAGED    | {"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400} |
      | required           | adjustment | warehouse_supervisor | WIDGET-1                          | AMS-B-0142 | -5      |            |                                                                                                  |

  Scenario: A caller with no role is rejected
    When I run "adjust_stock" with:
      | now                      | idempotency_key | sku      | location   | delta | reason  | stored_level                                                                                     | caller |
      | 2026-11-22T10:00:00.000Z | adjust-0001     | WIDGET-1 | AMS-B-0142 | -5    | DAMAGED | {"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400} | {}     |
    Then the input is rejected by "required" of "caller"
