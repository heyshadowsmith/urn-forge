@urn-forge:strict
@urn:demo:shipping:quote:operation:quote_shipping
Feature: Shipping quotes

  Scenario Outline: The price depends on the weight, the zone and the speed
    When I run the operation with:
      | weight_grams   | zone   | express   |
      | <weight_grams> | <zone> | <express> |
    Then the output is:
      | price_cents   |
      | <price_cents> |

    Examples:
      | weight_grams | zone          | express | price_cents |
      | 800          | domestic      | false   | 600         |
      | 2500         | domestic      |         | 800         |
      | 2500         | international | false   | 2400        |
      | 2500         | domestic      | true    | 1600        |

  Scenario: A parcel without weight is rejected at the boundary
    When I run the operation with:
      | weight_grams | zone     |
      | 0            | domestic |
    Then the input is rejected on "weight_grams"

  Scenario: An express parcel over 5000 grams is refused
    When I run the operation with:
      | weight_grams | zone     | express |
      | 5001         | domestic | true    |
    Then the operation fails with "urn:demo:shipping:quote:error:too_heavy_for_express":
      | weight_grams |
      | 5001         |

  Scenario Outline: The lightest and heaviest parcels are accepted
    When I run the operation with:
      | weight_grams   | zone     |
      | <weight_grams> | domestic |
    Then the output is:
      | price_cents   |
      | <price_cents> |

    Examples:
      | weight_grams | price_cents |
      | 1            | 600         |
      | 30000        | 3500        |

  Scenario: A parcel over 30000 grams is rejected at the boundary
    When I run the operation with:
      | weight_grams | zone     |
      | 30001        | domestic |
    Then the input is rejected on "weight_grams"

  Scenario: An unknown zone is rejected at the boundary
    When I run the operation with:
      | weight_grams | zone |
      | 800          | moon |
    Then the input is rejected on "zone"
