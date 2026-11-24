Feature: Split a bill

  Scenario: A bill is split into equal shares
    When I run "split" with:
      | total_cents | people                     |
      | 1000        | [Ada, Grace, Alan, Edsger] |
    Then the output is "share":
      | share_cents |
      | 250         |

  Scenario: A total that does not divide evenly is refused
    When I run "split" with:
      | total_cents | people             |
      | 1000        | [Ada, Grace, Alan] |
    Then the output is "uneven_split":
      | total_cents |
      | 1000        |

  Scenario Outline: A request that breaks a rule is rejected
    When I run "split" with:
      | total_cents   | people   |
      | <total_cents> | <people> |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule        | definition    | total_cents | people                            |
      | minimum     | total_cents   | -1          | [Ada]                             |
      | minLength   | person        | 100         | [Ada, ""]                         |
      | minItems    | people        | 100         | []                                |
      | maxItems    | people        | 100         | [A, B, C, D, E, F, G, H, I, J, K] |
      | uniqueItems | people        | 100         | [Ada, Ada]                        |
      | required    | split_request | 100         |                                   |

  Scenario: A share below 0 is not a share
    When I check a "share" with:
      | share_cents |
      | -1          |
    Then the value is rejected by "minimum" of "share_cents"

  Scenario: A share needs its amount
    When I check a "share" with:
      | share_cents |
      |             |
    Then the value is rejected by "required" of "share"

  Scenario: A refusal needs the total
    When I check an "uneven_split" with:
      | total_cents |
      |             |
    Then the value is rejected by "required" of "uneven_split"
