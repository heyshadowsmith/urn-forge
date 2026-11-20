@urn:urn_forge:toolchain:naming:operation:to_urn
Feature: URNs

  The compiler expands every short key to a six-segment URN (spec §3), using the
  manifest's namespace and domain.

  Scenario Outline: Five segments become one URN
    When I run the operation with:
      | namespace   | domain   | context   | kind   | identifier   |
      | <namespace> | <domain> | <context> | <kind> | <identifier> |
    Then the output is:
      | urn   |
      | <urn> |

    Examples:
      | namespace | domain    | context    | kind      | identifier        | urn                                                   |
      | demo      | math      | arithmetic | operation | safe_divide       | urn:demo:math:arithmetic:operation:safe_divide        |
      | acme      | insurance | policy     | field     | deductible_amount | urn:acme:insurance:policy:field:deductible_amount     |
      | urn_forge | toolchain | naming     | entity    | atom_address      | urn:urn_forge:toolchain:naming:entity:atom_address    |

  Scenario Outline: A kind the compiler does not support is rejected at the boundary
    When I run the operation with:
      | namespace | domain | context  | kind   | identifier |
      | demo      | math   | geometry | <kind> | radius     |
    Then the input is rejected on "kind"

    Examples:
      | kind   |
      | event  |
      | widget |
      | Field  |
