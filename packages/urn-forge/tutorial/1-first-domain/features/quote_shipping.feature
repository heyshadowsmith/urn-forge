Feature: Shipping quotes

  Scenario Outline: The price depends on the weight, the zone and the speed
    When I run "quote_shipping" with:
      | weight_grams   | zone   | express   |
      | <weight_grams> | <zone> | <express> |
    Then the output is "quote":
      | price_cents   |
      | <price_cents> |

    Examples:
      | weight_grams | zone          | express | price_cents |
      | 800          | domestic      | false   | 600         |
      | 2500         | domestic      |         | 800         |
      | 2500         | international | false   | 2400        |
      | 2500         | domestic      | true    | 1600        |

  Scenario Outline: A parcel that breaks a rule is rejected at the boundary
    When I run "quote_shipping" with:
      | weight_grams   | zone   |
      | <weight_grams> | <zone> |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition   | weight_grams | zone     |
      | minimum  | weight_grams | 0            | domestic |
      | maximum  | weight_grams | 30001        | domestic |
      | enum     | zone         | 800          | moon     |
      | required | parcel       |              | domestic |

  Scenario Outline: A quote that breaks a rule is not a quote
    When I check a "quote" with:
      | price_cents   |
      | <price_cents> |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition  | price_cents |
      | minimum  | price_cents | -1          |
      | required | quote       |             |
