@urn-forge:strict
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
      | urn_forge | toolchain | naming     | error     | invalid_short_key | urn:urn_forge:toolchain:naming:error:invalid_short_key |

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

  Scenario: A namespace that is not lowercase snake_case is rejected at the boundary
    When I run the operation with:
      | namespace | domain | context  | kind  | identifier |
      | Demo      | math   | geometry | field | radius     |
    Then the input is rejected on "namespace"

  Scenario: A domain that is not lowercase snake_case is rejected at the boundary
    When I run the operation with:
      | namespace | domain | context  | kind  | identifier |
      | demo      | Math   | geometry | field | radius     |
    Then the input is rejected on "domain"

  Scenario: A context that is not lowercase snake_case is rejected at the boundary
    When I run the operation with:
      | namespace | domain | context   | kind  | identifier |
      | demo      | math   | geo-metry | field | radius     |
    Then the input is rejected on "context"

  Scenario: An identifier that is not lowercase snake_case is rejected at the boundary
    When I run the operation with:
      | namespace | domain | context  | kind  | identifier |
      | demo      | math   | geometry | field | 2radius    |
    Then the input is rejected on "identifier"
