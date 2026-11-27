Feature: The fix of a code

  Each problem that urn-forge reports has a stable code, and the code has a fix: one sentence that
  says what to do about each case of the code. A tool or an agent acts on the code and its fix.

  Scenario Outline: A code has its meaning, its severity and its fix
    When I run "fix_of" with:
      | code   | severity   |
      | <code> | <severity> |
    Then the output is "code_fix":
      | code   | meaning   | severity   | fix   |
      | <code> | <meaning> | <is>       | <fix> |

    Examples:
      | code           | severity | meaning                                                                    | is         | fix                                                                                                                           |
      | drift          | error    | Gate 4: a generated file is not what `compile` writes now, or it is missing, or `compile` no longer writes it | error      | Run urn-forge compile, and do not edit a generated file by hand.                                                              |
      | usage          |          | The command line is wrong                                                  | error      | Run urn-forge --help, and call the command with the arguments and options that it shows.                                     |
      | deprecated-use | warning  | A live part uses a deprecated part                                         | warning    | Use a definition or a rule that is not deprecated, or remove deprecated: true if it is still the right one.                  |
      | removed-rule   | warning  | Gate 5: the contract is weaker than at the base, and the version does not allow it | by-version | Put the rule back; if the change is on purpose, stop and ask a person, because only a person decides a new manifest.version. |

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

  Scenario Outline: What a code is has its meaning, its severity and its fix
    When I check a "code_entry" with:
      | meaning   | severity   | fix   |
      | <meaning> | <severity> | <fix> |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition    | meaning                    | severity | fix                   |
      | pattern  | code_meaning  | " "                        | error    | Run urn-forge compile. |
      | enum     | code_severity | The command line is wrong  | fatal    | Run urn-forge compile. |
      | required | code_entry    | The command line is wrong  | error    |                       |
