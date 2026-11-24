Feature: Type names

  The generated file names the TypeScript type of each definition: the PascalCase of its name.
  A name that the generated file declares itself gets Value after it.

  Scenario Outline: A definition name becomes one PascalCase name
    When I run "to_type_name" with:
      | definition_name   |
      | <definition_name> |
    Then the output is "named_type":
      | type_name   |
      | <type_name> |

    Examples:
      | definition_name | type_name       |
      | party_size      | PartySize       |
      | booking         | Booking         |
      | v2_key          | V2Key           |
      | a__b_           | AB              |
      | failure         | FailureValue    |
      | domain_core     | DomainCoreValue |

  Scenario Outline: A name that is not lowercase snake_case is rejected at the boundary
    When I run "to_type_name" with:
      | definition_name   |
      | <definition_name> |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition      | definition_name |
      | pattern  | definition_name | PartySize       |
      | pattern  | definition_name | 2fa             |
      | pattern  | definition_name | has-dash        |
      | required | naming_request  |                 |

  Scenario Outline: A type name that breaks a rule is not a type name
    When I check a "named_type" with:
      | type_name   |
      | <type_name> |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition | type_name  |
      | pattern  | type_name  | party_size |
      | required | named_type |            |
