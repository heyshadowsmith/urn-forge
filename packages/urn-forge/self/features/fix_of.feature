Feature: The fix of a code

  Each problem that urn-forge reports has a stable code, and the code has a fix: one sentence that
  says what to do about each case of the code. A tool or an agent acts on the code and its fix.

  Scenario Outline: A code has its fix
    When I run "fix_of" with:
      | code   |
      | <code> |
    Then the output is "code_fix":
      | code   | fix   |
      | <code> | <fix> |

    Examples:
      | code       | fix                                                                                            |
      | drift      | Run urn-forge compile, and do not edit a generated file by hand.                               |
      | usage      | Run urn-forge --help, and call the command with the arguments and options that it shows.      |
      | type-error | Correct the type error at the line that the problem gives; do not suppress it.                 |

  Scenario Outline: A request that breaks a rule is rejected at the boundary
    When I run "fix_of" with:
      | code   |
      | <code> |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition   | code       |
      | enum     | code         | no-such    |
      | required | code_request |            |

  Scenario Outline: An answer that breaks a rule is not an answer
    When I check a "code_fix" with:
      | code   | fix   |
      | <code> | <fix> |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule      | definition | code  | fix |
      | minLength | fix        | drift | ""  |
      | required  | code_fix   | drift |     |
