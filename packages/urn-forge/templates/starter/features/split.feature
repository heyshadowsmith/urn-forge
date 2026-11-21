@urn:{{namespace}}:{{domain}}:bill:operation:split
Feature: Split a bill

  Scenario: A bill is split into equal shares
    When I run the operation with:
      | total_cents | people                   |
      | 1000        | [Ada, Grace, Alan, Edsger] |
    Then the output is:
      | share_cents |
      | 250         |

  Scenario Outline: The smallest and largest values are accepted
    When I run the operation with:
      | total_cents   | people   |
      | <total_cents> | <people> |
    Then the output is:
      | share_cents   |
      | <share_cents> |

    Examples:
      | total_cents | people                         | share_cents |
      | 0           | [A]                            | 0           |
      | 100         | [A, B, C, D, E, F, G, H, I, J] | 10          |

  Scenario: A negative total is rejected at the boundary
    When I run the operation with:
      | total_cents | people |
      | -1          | [Ada]  |
    Then the input is rejected on "total_cents"

  Scenario Outline: A list of people that breaks its rules is rejected at the boundary
    When I run the operation with:
      | total_cents | people   |
      | 100         | <people> |
    Then the input is rejected on "people"

    Examples:
      | people                            |
      | []                                |
      | [A, B, C, D, E, F, G, H, I, J, K] |
      | [Ada, Ada]                        |
      | [Ada, ""]                         |

  Scenario: A total that does not divide evenly is refused
    When I run the operation with:
      | total_cents | people           |
      | 1000        | [Ada, Grace, Alan] |
    Then the operation fails with "urn:{{namespace}}:{{domain}}:bill:error:uneven_split":
      | total_cents |
      | 1000        |
