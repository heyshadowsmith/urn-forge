Feature: The rules that gate 3 reports

  Each rule that a definition applies needs a scenario that breaks it: a rule that no scenario breaks
  could be removed, or made weaker, and no scenario would fail. Gate 3 reports each such rule once, as
  uncovered-rule, and no rule that a scenario breaks.

  Scenario Outline: Gate 3 reports each rule that no scenario breaks
    When I run "find_uncovered_rules" with:
      | applied_rules | broken_rules |
      | <applied>     | <broken>     |
    Then the output is "rules_found":
      | uncovered_rules |
      | <uncovered>     |

    Examples:
      | applied                                                    | broken                                     | uncovered                 |
      | ["party_size minimum", "party_size maximum"]               | ["party_size minimum"]                     | ["party_size maximum"]    |
      | ["party_size minimum", "party_size minimum"]               | []                                         | ["party_size minimum"]    |
      | ["party_size minimum", "note maxLength"]                   | ["party_size minimum", "note maxLength"]   | []                        |
      | []                                                         | ["booking type"]                           | []                        |

  Scenario Outline: A request that breaks a rule is rejected at the boundary
    When I run "find_uncovered_rules" with:
      | applied_rules | broken_rules |
      | <applied>     | <broken>     |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition     | applied                | broken |
      | pattern  | rule_place     | ["party_size"]         | []     |
      | required | coverage_facts | ["party_size minimum"] |        |

  Scenario Outline: An answer that breaks a rule is not an answer
    When I check a "rules_found" with:
      | uncovered_rules |
      | <uncovered>     |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule        | definition      | uncovered                                    |
      | uniqueItems | uncovered_rules | ["party_size minimum", "party_size minimum"] |
      | required    | rules_found     |                                              |
