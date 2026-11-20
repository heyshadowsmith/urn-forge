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
