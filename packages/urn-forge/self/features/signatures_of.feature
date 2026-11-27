Feature: The functions of the rule language

  Each function and method of the rule language has its signatures: the types that it takes and
  gives. A method shows the type of its target before the dot.

  Scenario Outline: A function has its signatures
    When I run "signatures_of" with:
      | function_name |
      | <name>        |
    Then the output is "function_signatures":
      | function_name | signature_text |
      | <name>        | <signatures>   |

    Examples:
      | name          | signatures                                                                                   |
      | startsWith    | string.startsWith(string)                                                                    |
      | math.greatest | math.greatest(int), math.greatest(double), math.greatest(list(int)), math.greatest(list(double)) |

  Scenario Outline: A request that breaks a rule is rejected at the boundary
    When I run "signatures_of" with:
      | function_name |
      | <name>        |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition       | name   |
      | enum     | function_name    | format |
      | required | function_request |        |

  Scenario Outline: An answer that breaks a rule is not an answer
    When I check a "function_signatures" with:
      | function_name | signature_text |
      | startsWith    | <signatures>   |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule      | definition          | signatures |
      | minLength | signature_text      | ""         |
      | required  | function_signatures |            |
