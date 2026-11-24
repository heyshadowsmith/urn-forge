Feature: Read the stock of one SKU at one location
  The shell loads the stored stock level of the SKU at the location, when there is one. Any
  authenticated caller may read the stock.

  Scenario Outline: Any caller reads the stored stock level
    When I run "get_stock" with:
      | caller.role | sku      | location   | stored_level                                                                                     |
      | <role>      | WIDGET-1 | AMS-B-0142 | {"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400} |
    Then the output is "stock_level":
      | sku      | location   | on_hand | reserved | available |
      | WIDGET-1 | AMS-B-0142 | 500     | 100      | 400       |

    Examples:
      | role                 |
      | order_system         |
      | purchasing_system    |
      | warehouse_staff      |
      | warehouse_supervisor |

  Scenario: A SKU with no stored level is unknown
    When I run "get_stock" with:
      | caller.role  | sku         | location   |
      | order_system | NO-SUCH-SKU | AMS-B-0142 |
    Then the output is "unknown_sku":
      | error_code  | sku         |
      | UNKNOWN_SKU | NO-SUCH-SKU |

  Scenario: A location of no warehouse is unknown
    When I run "get_stock" with:
      | caller.role  | sku      | location   |
      | order_system | WIDGET-1 | ZZZ-Z-9999 |
    Then the output is "unknown_location":
      | error_code       | location   |
      | UNKNOWN_LOCATION | ZZZ-Z-9999 |

  Scenario: A loaded level of another SKU is rejected
    When I run "get_stock" with:
      | caller.role  | sku      | location   | stored_level                                                                                     |
      | order_system | GADGET-2 | AMS-B-0142 | {"sku": "WIDGET-1", "location": "AMS-B-0142", "on_hand": 500, "reserved": 100, "available": 400} |
    Then the input is rejected by "level_is_the_query" of "stock_query"

  Scenario: A query with no caller is rejected
    When I run "get_stock" with:
      | sku      | location   |
      | WIDGET-1 | AMS-B-0142 |
    Then the input is rejected by "required" of "stock_query"
