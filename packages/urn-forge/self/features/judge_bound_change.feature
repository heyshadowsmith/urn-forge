@target
Feature: The direction of a new bound

  diff and gate 5 compare a new bound of a standard rule by the form of the rule. A larger bound of a
  lower limit accepts fewer values (narrower); a larger bound of an upper limit accepts more (wider).

  Scenario Outline: A new bound accepts fewer values, more, or the same
    When I run "judge_bound_change" with:
      | bound_rule   | old_bound   | new_bound   |
      | <bound_rule> | <old_bound> | <new_bound> |
    Then the output is "bound_judged":
      | direction   |
      | <direction> |

    Examples:
      | bound_rule       | old_bound | new_bound | direction |
      | minimum          | 1         | 2         | narrower  |
      | minimum          | 2         | 1         | wider     |
      | exclusiveMinimum | 0         | 1         | narrower  |
      | minLength        | 1         | 3         | narrower  |
      | minItems         | 2         | 0         | wider     |
      | maximum          | 12        | 10        | narrower  |
      | maximum          | 10        | 12        | wider     |
      | exclusiveMaximum | 5         | 6         | wider     |
      | maxLength        | 200       | 100       | narrower  |
      | maxItems         | 4         | 8         | wider     |
      | maximum          | 12        | 12        | same      |

  Scenario Outline: A rule with no bound, or no change, is rejected at the boundary
    When I run "judge_bound_change" with:
      | bound_rule   | old_bound   | new_bound   |
      | <bound_rule> | <old_bound> | <new_bound> |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition   | bound_rule | old_bound | new_bound |
      | enum     | bound_rule   | pattern    | 1         | 2         |
      | required | bound_change | minimum    | 1         |           |

  Scenario: A direction is one of three
    When I check a "direction" with:
      | direction |
      | up        |
    Then the value is rejected by "enum" of "direction"

  Scenario: A judged bound needs its direction
    When I check a "bound_judged" with:
      | direction |
      |           |
    Then the value is rejected by "required" of "bound_judged"
