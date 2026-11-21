@urn-forge:strict
@urn:demo:math:geometry:operation:compute_area
Feature: Circle area

  Scenario Outline: Valid radii
    When I run the operation with:
      | radius   |
      | <radius> |
    Then the output is:
      | area   |
      | <area> |

    Examples:
      | radius | area               |
      | 0      | 0                  |
      | 1      | 3.141592653589793  |
      | 2      | 12.566370614359172 |

  Scenario: A negative radius is rejected at the boundary
    When I run the operation with:
      | radius |
      | -1     |
    Then the input is rejected on "radius"
