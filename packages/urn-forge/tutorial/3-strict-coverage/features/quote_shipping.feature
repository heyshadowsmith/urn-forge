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

  Scenario: An express parcel over 5000 grams is refused
    When I run "quote_shipping" with:
      | weight_grams | zone     | express |
      | 5001         | domestic | true    |
    Then the output is "too_heavy_for_express":
      | weight_grams |
      | 5001         |

  Scenario Outline: The lightest and heaviest parcels are accepted
    When I run "quote_shipping" with:
      | weight_grams   | zone     |
      | <weight_grams> | domestic |
    Then the output is "quote":
      | price_cents   |
      | <price_cents> |

    Examples:
      | weight_grams | price_cents |
      | 1            | 600         |
      | 30000        | 3500        |

  Scenario: An express parcel of exactly 5000 grams is quoted
    When I run "quote_shipping" with:
      | weight_grams | zone     | express |
      | 5000         | domestic | true    |
    Then the output is "quote":
      | price_cents |
      | 2000        |

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

  Scenario: A refusal needs the weight
    When I check a "too_heavy_for_express" with:
      | weight_grams |
      |              |
    Then the value is rejected by "required" of "too_heavy_for_express"
