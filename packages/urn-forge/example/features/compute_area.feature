Feature: Circle area

  Scenario Outline: The area of a circle is pi times the square of its radius
    When I run "compute_area" with:
      | radius   |
      | <radius> |
    Then the output is "circle_area":
      | area   |
      | <area> |

    Examples:
      | radius | area               |
      | 0      | 0                  |
      | 1      | 3.141592653589793  |
      | 2      | 12.566370614359172 |

  Scenario Outline: A circle that breaks a rule is rejected at the boundary
    When I run "compute_area" with:
      | radius   |
      | <radius> |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition | radius |
      | minimum  | radius     | -1     |
      | required | circle     |        |

  Scenario Outline: An area that breaks a rule is not an area
    When I check a "circle_area" with:
      | area   |
      | <area> |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition  | area |
      | minimum  | area        | -1   |
      | required | circle_area |      |
