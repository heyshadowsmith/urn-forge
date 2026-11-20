@urn:urn_forge:toolchain:naming:operation:to_brand_identifier
Feature: Brand identifiers

  The compiler names every generated export after an atom's brand identifier: the
  PascalCase of its context and identifier (spec §3).

  Scenario Outline: Context and identifier become one PascalCase name
    When I run the operation with:
      | context   | identifier   |
      | <context> | <identifier> |
    Then the output is:
      | brand_identifier   |
      | <brand_identifier> |

    Examples:
      | context  | identifier        | brand_identifier       |
      | policy   | deductible_amount | PolicyDeductibleAmount |
      | geometry | circle_area       | GeometryCircleArea     |
      | api      | v2_key            | ApiV2Key               |
      | a        | b_                | AB                     |

  Scenario Outline: Different short keys can share a brand identifier
    The IR builder's uniqueness pass reports this collision as a compile error.

    When I run the operation with:
      | context   | identifier   |
      | <context> | <identifier> |
    Then the output is:
      | brand_identifier |
      | GeoMetryRadius   |

    Examples:
      | context   | identifier   |
      | geo_metry | radius       |
      | geo       | metry_radius |

  Scenario: A context longer than 63 characters is rejected at the boundary
    When I run the operation with:
      | context                                                          | identifier |
      | aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa | radius     |
    Then the input is rejected on "context"

  Scenario Outline: A context that is not lowercase snake_case is rejected at the boundary
    When I run the operation with:
      | context   | identifier |
      | <context> | radius     |
    Then the input is rejected on "context"

    Examples:
      | context  |
      | Policy   |
      | 2fa      |
      | has-dash |

  Scenario: A missing identifier is rejected at the boundary
    When I run the operation with:
      | context  | identifier |
      | geometry |            |
    Then the input is rejected on "identifier"
