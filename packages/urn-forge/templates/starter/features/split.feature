@urn:{{namespace}}:{{domain}}:bill:operation:split
Feature: Split a bill

  Scenario: A bill is split into equal shares
    When I run the operation with:
      | total_cents | people |
      | 1000        | 4      |
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
      | total_cents | people | share_cents |
      | 0           | 1      | 0           |
      | 100         | 100    | 1           |

  Scenario: A negative total is rejected at the boundary
    When I run the operation with:
      | total_cents | people |
      | -1          | 1      |
    Then the input is rejected on "total_cents"

  Scenario Outline: A number of people outside 1 to 100 is rejected at the boundary
    When I run the operation with:
      | total_cents | people   |
      | 100         | <people> |
    Then the input is rejected on "people"

    Examples:
      | people |
      | 0      |
      | 101    |

  Scenario: A total that does not divide evenly is refused
    When I run the operation with:
      | total_cents | people |
      | 1000        | 3      |
    Then the operation fails with "urn:{{namespace}}:{{domain}}:bill:error:uneven_split":
      | total_cents | people |
      | 1000        | 3      |
