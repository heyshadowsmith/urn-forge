@urn-forge:strict
@urn:corpus:inventory:stock:operation:get_stock
Feature: Read the stock of a SKU at a location

  # Any authenticated caller may read the stock; the scenarios below run as warehouse staff.
  Background:
    Given the caller is:
      | role            |
      | warehouse_staff |

  Scenario Outline: A stock level has on-hand, reserved and available counts
    When I run the operation with:
      | sku   | location   |
      | <sku> | <location> |
    Then the output is:
      | sku   | location   | on_hand | reserved | available |
      | <sku> | <location> | 500     | 100      | 400       |

    Examples:
      | sku               | location   |
      | WIDGET-1          | AMS-B-0142 |
      | A1B               | ROT-Z-0000 |
      | =repeat(16, "Z9") | AMS-A-9999 |

  Scenario Outline: A SKU that is too short, too long, or not uppercase letters, digits and inner hyphens is rejected
    When I run the operation with:
      | sku   | location   |
      | <sku> | AMS-B-0142 |
    Then the input is rejected on "sku"

    Examples:
      | sku              |
      | AB               |
      | =repeat(33, "A") |
      | -WIDGET          |
      | WIDGET-          |
      | widget-1         |
      | WIDGET_1         |

  Scenario Outline: A location that is not WAREHOUSE-ZONE-BIN is rejected
    When I run the operation with:
      | sku      | location   |
      | WIDGET-1 | <location> |
    Then the input is rejected on "location"

    Examples:
      | location    |
      | AMS-B-142   |
      | AM-B-0142   |
      | AMS-BB-0142 |
      | ams-b-0142  |

  Scenario: An unknown SKU is refused
    When I run the operation with:
      | sku         | location   |
      | NO-SUCH-SKU | AMS-B-0142 |
    Then the operation fails with "urn:corpus:inventory:stock:error:unknown_sku":
      | sku         |
      | NO-SUCH-SKU |

  Scenario: An unknown location is refused
    When I run the operation with:
      | sku      | location   |
      | WIDGET-1 | ZZZ-Z-9999 |
    Then the operation fails with "urn:corpus:inventory:stock:error:unknown_location":
      | location   |
      | ZZZ-Z-9999 |

  Scenario Outline: Any authenticated caller may read the stock
    Given the caller is:
      | role   |
      | <role> |
    When I run the operation with:
      | sku      | location   |
      | WIDGET-1 | AMS-B-0142 |
    Then the output is:
      | sku      | location   | on_hand | reserved | available |
      | WIDGET-1 | AMS-B-0142 | 500     | 100      | 400       |

    Examples:
      | role                 |
      | order_system         |
      | purchasing_system    |
      | warehouse_staff      |
      | warehouse_supervisor |
      | clock                |
