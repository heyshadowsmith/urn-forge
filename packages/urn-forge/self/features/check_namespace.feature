@target
Feature: URN namespaces

  The namespace of a manifest is also the namespace of its URNs, so it takes the form of a URN
  namespace: 2 to 32 lowercase letters, digits and hyphens, starting with a letter.

  Scenario Outline: A URN namespace is accepted
    When I run "check_namespace" with:
      | candidate   |
      | <candidate> |
    Then the output is "namespace_accepted":
      | candidate   |
      | <candidate> |

    Examples:
      | candidate                        |
      | demo                             |
      | my-shop                          |
      | ab                               |
      | a2345678901234567890123456789012 |

  Scenario Outline: A text that is not a URN namespace is refused
    When I run "check_namespace" with:
      | candidate   |
      | <candidate> |
    Then the output is "namespace_refused":
      | candidate   |
      | <candidate> |

    Examples:
      | candidate                         |
      | my_shop                           |
      | a                                 |
      | 2shop                             |
      | Shop                              |
      | a23456789012345678901234567890123 |

  Scenario Outline: A text to check must be there
    When I run "check_namespace" with:
      | candidate   |
      | <candidate> |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule      | definition          | candidate |
      | minLength | candidate           | ""        |
      | required  | namespace_candidate |           |

  Scenario Outline: An answer names its text
    When I check a "<definition>" with:
      | candidate |
      |           |
    Then the value is rejected by "required" of "<definition>"

    Examples:
      | definition         |
      | namespace_accepted |
      | namespace_refused  |
