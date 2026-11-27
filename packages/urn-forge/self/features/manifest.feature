Feature: The language of a manifest

  A manifest has a header, and its definitions, rules and operations by name. Each key has one
  meaning in its place: rules is a map of declarations at the top, and a list of uses in a
  definition or an operation. A manifest that breaks a rule here fails compile with manifest-shape.

  Scenario: A manifest with each form of its language is accepted
    When I check a "manifest" with:
      | manifest                                                                                          | definitions | rules | operations |
      | {"namespace": "shop", "domain": "orders", "version": "1.0.0", "compatibility": {"callers": "ignore-unknown"}} | {"sku": {"description": "A product", "type": "string", "rules": [{"pattern": "^[A-Z]+$"}, "short"]}, "line": {"description": "A line", "type": "object", "properties": ["sku", {"count": "quantity"}], "identifier": "sku", "rules": [{"required": ["sku"]}]}, "quantity": {"description": "A count", "type": "integer", "rules": [{"minimum": 1}, {"between": {"low": 1, "high": 9}}, {"const": true}, {"enum": [1, 2]}]}, "lines": {"description": "Lines", "type": "array", "items": "line"}, "stock": {"description": "Stock", "type": "map", "keys": "sku", "values": "quantity"}, "value": {"description": "A value", "type": "union", "variants": ["sku", "quantity"]}, "shape": {"description": "A shape", "type": "union", "tag": "kind", "variants": {"line": "line"}}} | {"short": {"description": "Short", "parameters": [], "rule": "size(self) < 9", "failure_message": "Must be short", "deprecated": false}} | {"order": {"description": "Order", "input": "line", "output": ["line", {"lines": ["short"]}], "rules": ["short"]}} |
    Then the value is accepted

  Scenario Outline: A header that breaks a rule is rejected
    When I check a "manifest" with:
      | manifest | definitions |
      | <header> | {}          |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition      | header                                                                                     |
      | required | manifest        |                                                                                            |
      | required | manifest_header | {"namespace": "shop", "domain": "orders"}                                                  |
      | pattern  | namespace_name  | {"namespace": "Shop", "domain": "orders", "version": "1.0.0"}                              |
      | pattern  | domain_name     | {"namespace": "shop", "domain": "Orders", "version": "1.0.0"}                              |
      | pattern  | version         | {"namespace": "shop", "domain": "orders", "version": "1.0"}                                |
      | required | compatibility   | {"namespace": "shop", "domain": "orders", "version": "1.0.0", "compatibility": {}}         |
      | enum     | callers         | {"namespace": "shop", "domain": "orders", "version": "1.0.0", "compatibility": {"callers": "all"}} |

  Scenario Outline: A definition that breaks a rule is rejected
    When I check a "manifest" with:
      | manifest                                                       | definitions   |
      | {"namespace": "shop", "domain": "orders", "version": "1.0.0"} | <definitions> |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule                   | definition               | definitions                                                                                      |
      | pattern                | definition_name          | {"Sku": {"description": "A product", "type": "string"}}                                          |
      | required               | definition_declaration   | {"sku": {"type": "string"}}                                                                      |
      | pattern                | description              | {"sku": {"description": " ", "type": "string"}}                                                  |
      | pattern                | type_reference           | {"sku": {"description": "A product", "type": "String"}}                                          |
      | structure_of_an_object | definition_declaration   | {"line": {"description": "A line", "type": "object"}}                                            |
      | structure_of_an_object | definition_declaration   | {"sku": {"description": "A product", "type": "string", "identifier": "sku"}}                     |
      | structure_of_an_array  | definition_declaration   | {"lines": {"description": "Lines", "type": "array"}}                                             |
      | structure_of_an_array  | definition_declaration   | {"sku": {"description": "A product", "type": "string", "items": "sku"}}                          |
      | structure_of_a_map     | definition_declaration   | {"stock": {"description": "Stock", "type": "map", "keys": "sku"}}                                |
      | structure_of_a_union   | definition_declaration   | {"value": {"description": "A value", "type": "union"}}                                           |
      | structure_of_a_union   | definition_declaration   | {"sku": {"description": "A product", "type": "string", "tag": "kind"}}                           |
      | pattern                | property_name            | {"line": {"description": "A line", "type": "object", "properties": [], "identifier": "Sku"}}     |
      | one_entry              | property_with_definition | {"line": {"description": "A line", "type": "object", "properties": [{"a": "b", "c": "d"}]}}      |
      | pattern                | rule_use_name            | {"sku": {"description": "A product", "type": "string", "rules": ["Short"]}}                      |
      | one_entry              | rule_with_argument       | {"sku": {"description": "A product", "type": "string", "rules": [{"minLength": 1, "maxLength": 2}]}} |
      | properties             | definition_declaration   | {"sku": {"description": "A product", "type": "string", "minimum": 1}}                            |

  Scenario Outline: A rule that breaks a rule is rejected
    When I check a "manifest" with:
      | manifest                                                       | rules   |
      | {"namespace": "shop", "domain": "orders", "version": "1.0.0"} | <rules> |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition       | rules                                                                                          |
      | pattern  | rule_name        | {"Short": {"description": "Short", "rule": "size(self) < 9", "failure_message": "Too long"}}  |
      | required | rule_declaration | {"short": {"description": "Short", "rule": "size(self) < 9"}}                                  |
      | pattern  | rule_text        | {"short": {"description": "Short", "rule": " ", "failure_message": "Too long"}}               |
      | pattern  | failure_text     | {"short": {"description": "Short", "rule": "size(self) < 9", "failure_message": " "}}         |

  Scenario Outline: An operation that breaks a rule is rejected
    When I check a "manifest" with:
      | manifest                                                       | operations   |
      | {"namespace": "shop", "domain": "orders", "version": "1.0.0"} | <operations> |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule      | definition            | operations                                                                                 |
      | pattern   | operation_name        | {"Order": {"description": "Order", "input": "line", "output": ["line"]}}                   |
      | required  | operation_declaration | {"order": {"description": "Order", "input": "line"}}                                       |
      | minItems  | output_entries        | {"order": {"description": "Order", "input": "line", "output": []}}                         |
      | one_entry | output_with_rules     | {"order": {"description": "Order", "input": "line", "output": [{"a": [], "b": []}]}}       |
