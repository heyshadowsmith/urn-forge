@urn-forge:strict
@urn:urn_forge:toolchain:naming:operation:parse_short_key
Feature: Short keys

  Every manifest entry is written with a short key, <context>.<kind>.<identifier>. The
  compiler splits it before expanding it to a URN (spec §3), and refuses a key it cannot
  use with one of three declared errors.

  Scenario Outline: A valid key splits into its three segments
    When I run the operation with:
      | short_key   |
      | <short_key> |
    Then the output is:
      | context   | kind   | identifier   |
      | <context> | <kind> | <identifier> |

    Examples:
      | short_key                        | context    | kind      | identifier  |
      | geometry.field.radius            | geometry   | field     | radius      |
      | arithmetic.operation.safe_divide | arithmetic | operation | safe_divide |
      | shop.entity.line_2               | shop       | entity    | line_2      |

  Scenario Outline: A key that does not follow the grammar is refused
    When I run the operation with:
      | short_key   |
      | <short_key> |
    Then the operation fails with "urn:urn_forge:toolchain:naming:error:invalid_short_key"

    Examples:
      | short_key               |
      | geometry.radius         |
      | Geometry.field.radius   |
      | geometry.Field.radius   |
      | geometry.field.radius.x |

  Scenario: A kind from the spec that is not supported yet is refused
    When I run the operation with:
      | short_key           |
      | policy.event.placed |
    Then the operation fails with "urn:urn_forge:toolchain:naming:error:unsupported_kind":
      | short_key           | kind_segment |
      | policy.event.placed | event        |

  Scenario: A kind that is not a kind is refused
    When I run the operation with:
      | short_key       |
      | policy.widget.x |
    Then the operation fails with "urn:urn_forge:toolchain:naming:error:unknown_kind":
      | short_key       | kind_segment |
      | policy.widget.x | widget       |

  Scenario: A one-character key passes the boundary but is refused
    When I run the operation with:
      | short_key |
      | a         |
    Then the operation fails with "urn:urn_forge:toolchain:naming:error:invalid_short_key"

  Scenario: An empty key is rejected at the boundary
    When I run the operation with:
      | short_key |
      | ""        |
    Then the input is rejected on "short_key"
