@urn:urn_forge:toolchain:naming:operation:parse_short_key
Feature: Short keys that are refused

  The error scenarios of parse_short_key. They join self/features/parse_short_key.feature
  in step 4 of the error kind plan, when the step `the operation fails with` exists.

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
