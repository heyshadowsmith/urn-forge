Feature: Safe division

  Scenario Outline: A number is divided by another
    When I run "safe_divide" with:
      | dividend   | divisor   |
      | <dividend> | <divisor> |
    Then the output is "division_result":
      | quotient   |
      | <quotient> |

    Examples:
      | dividend | divisor | quotient |
      | 10       | 2       | 5        |
      | -9       | 3       | -3       |
      | 0        | -4      | 0        |
      | 1        | 4       | 0.25     |

  Scenario Outline: A division that breaks a rule is rejected at the boundary
    When I run "safe_divide" with:
      | dividend   | divisor   |
      | <dividend> | <divisor> |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition | dividend | divisor |
      | not_zero | divisor    | 1        | 0       |
      | required | division   | 1        |         |

  Scenario: A result needs its quotient
    When I check a "division_result" with:
      | quotient |
      |          |
    Then the value is rejected by "required" of "division_result"
