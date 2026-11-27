Feature: The verdict of a gate

  Each gate of verify passes when none of its problems is an error. A warning, such as a weaker
  contract that a new version allows, does not fail it. So a gate that fails names its problem.

  Scenario Outline: A gate with no error passes
    When I run "judge_gate" with:
      | gate_number | gate_problems |
      | <number>    | <problems>    |
    Then the output is "gate_passed":
      | gate_number | gate_name |
      | <number>    | <name>    |

    Examples:
      | number | name         | problems                                            |
      | 1      | completeness | []                                                  |
      | 5      | contract     | [{"code": "removed-rule", "severity": "warning"}]   |

  Scenario Outline: A gate with an error fails
    When I run "judge_gate" with:
      | gate_number | gate_problems |
      | <number>    | <problems>    |
    Then the output is "gate_failed":
      | gate_number | gate_name |
      | <number>    | <name>    |

    Examples:
      | number | name     | problems                                                                                      |
      | 2      | boundary | [{"code": "direct-call", "severity": "error"}]                                                |
      | 3      | gherkin  | [{"code": "uncovered-rule", "severity": "error"}, {"code": "unknown-name", "severity": "warning"}] |
      | 4      | drift    | [{"code": "drift", "severity": "error"}]                                                      |

  Scenario Outline: A request that breaks a rule is rejected at the boundary
    When I run "judge_gate" with:
      | gate_number | gate_problems |
      | <number>    | <problems>    |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition   | number | problems                                    |
      | minimum  | gate_number  | 0      | []                                          |
      | maximum  | gate_number  | 6      | []                                          |
      | enum     | severity     | 1      | [{"code": "drift", "severity": "fatal"}]    |
      | enum     | code         | 1      | [{"code": "no-such", "severity": "error"}]  |
      | required | gate_problem | 1      | [{"code": "drift"}]                         |
      | required | gate_facts   | 1      |                                             |

  Scenario Outline: An answer that breaks a rule is not an answer
    When I check a "<definition>" with:
      | gate_number | gate_name |
      | 1           | <name>    |
    Then the value is rejected by "<rule>" of "<failing>"

    Examples:
      | definition  | rule     | failing     | name  |
      | gate_passed | enum     | gate_name   | first |
      | gate_passed | required | gate_passed |       |
      | gate_failed | required | gate_failed |       |

  Scenario Outline: What a gate is has its name, what makes it fail, and its codes
    When I check a "gate_meaning" with:
      | gate_name | gate_check | gate_codes |
      | drift     | <check>    | <codes>    |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule        | definition   | check                                       | codes            |
      | pattern     | gate_check   | " "                                         | [drift]          |
      | uniqueItems | gate_codes   | A generated file is not what compile writes | [drift, drift]   |
      | required    | gate_meaning | A generated file is not what compile writes |                  |
