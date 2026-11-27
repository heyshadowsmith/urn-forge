Feature: The standard rules

  A manifest uses a rule of the standard set by its name, with no declaration. Each standard rule has
  its parameters, what it checks, and what its failure says, with each argument in braces.

  Scenario Outline: A standard rule is described
    When I run "describe_standard_rule" with:
      | standard_rule_name |
      | <name>             |
    Then the output is "standard_rule":
      | standard_rule_name | parameter_names | rule_description | failure_text |
      | <name>             | <parameters>    | <description>    | <failure>    |

    Examples:
      | name        | parameters | description                          | failure                         |
      | minimum     | ["bound"]  | The value is the bound or more       | Must be at least {bound}        |
      | uniqueItems | []         | No item of the list occurs two times | Must not have an item two times |

  Scenario Outline: A request that breaks a rule is rejected at the boundary
    When I run "describe_standard_rule" with:
      | standard_rule_name |
      | <name>             |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition            | name    |
      | enum     | standard_rule_name    | minimal |
      | required | standard_rule_request |         |

  Scenario Outline: An answer that breaks a rule is not an answer
    When I check a "standard_rule" with:
      | standard_rule_name | parameter_names | rule_description | failure_text |
      | minimum            | <parameters>    | <description>    | <failure>    |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule      | definition       | parameters | description | failure |
      | pattern   | parameter_name   | ["Bound"]  | A bound     | F       |
      | minLength | rule_description | ["bound"]  | ""          | F       |
      | minLength | failure_text     | ["bound"]  | A bound     | ""      |
      | required  | standard_rule    | ["bound"]  | A bound     |         |
