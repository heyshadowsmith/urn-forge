Feature: The failure message of a rule use

  A rule's failure message names each parameter in braces. A failure of a use of the rule gives the
  message with each argument in place. A name in braces with no argument stays as it is.

  Scenario Outline: The arguments go in place of their parameters
    When I run "fill_message" with:
      | message_text | message_arguments |
      | <message>    | <arguments>       |
    Then the output is "filled_message":
      | filled_text |
      | <filled>    |

    Examples:
      | message                  | arguments                                                                       | filled              |
      | Must be at least {bound} | [{"argument_name": "bound", "argument_text": "5"}]                              | Must be at least 5  |
      | Must be {a} or {b}       | [{"argument_name": "a", "argument_text": "x"}]                                  | Must be x or {b}    |
      | Must be {a} or {a}       | [{"argument_name": "a", "argument_text": "x"}]                                  | Must be x or x      |
      | Must be a list           | []                                                                              | Must be a list      |

  Scenario Outline: A request that breaks a rule is rejected at the boundary
    When I run "fill_message" with:
      | message_text | message_arguments |
      | <message>    | <arguments>       |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition       | message | arguments                                          |
      | pattern  | argument_name    | M       | [{"argument_name": "A", "argument_text": "x"}]     |
      | required | message_argument | M       | [{"argument_name": "a"}]                           |
      | required | message_request  | M       |                                                    |

  Scenario: An answer that breaks a rule is not an answer
    When I check a "filled_message" with:
      | filled_text |
      |             |
    Then the value is rejected by "required" of "filled_message"
