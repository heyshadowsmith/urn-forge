@urn-forge:strict
@urn:demo:math:arithmetic:operation:safe_divide
Feature: Safe division

  Scenario Outline: Valid divisions
    When I run the operation with:
      | dividend   | divisor   |
      | <dividend> | <divisor> |
    Then the output is:
      | quotient   |
      | <quotient> |

    Examples:
      | dividend | divisor | quotient |
      | 10       | 2       | 5        |
      | -9       | 3       | -3       |

  Scenario: A zero divisor is rejected at the boundary
    When I run the operation with:
      | dividend | divisor |
      | 1        | 0       |
    Then the input is rejected on "divisor"
