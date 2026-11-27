Feature: The steps of a scenario

  The scenarios of a domain use seven steps of urn-forge. A step text is the step whose form it has.
  A text of another form is no step of urn-forge, and Cucumber reports it as undefined.

  Scenario Outline: A step text is a step of urn-forge
    When I run "match_step" with:
      | step_text |
      | <text>    |
    Then the output is "matched_step":
      | step_text | step_kind |
      | <text>    | <kind>    |

    Examples:
      | text                                                   | kind          |
      | I run "seat_booking" with:                             | run           |
      | I check a "booking" with:                              | check         |
      | I check an "order" with:                               | check         |
      | the output is "booking"                                | output        |
      | the output is "booking":                               | outputWith    |
      | the input is rejected by "minimum" of "party_size"     | inputRejected |
      | the value is rejected by "required" of "booking"       | valueRejected |
      | the value is accepted                                  | accepted      |

  Scenario Outline: A text of another form is no step
    When I run "match_step" with:
      | step_text |
      | <text>    |
    Then the output is "unmatched_step":
      | step_text |
      | <text>    |

    Examples:
      | text                        |
      | I run seat_booking with:    |
      | the output is "booking" now |
      | the value is refused        |

  Scenario Outline: A request that breaks a rule is rejected at the boundary
    When I run "match_step" with:
      | step_text |
      | <text>    |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule      | definition   | text |
      | minLength | step_text    | ""   |
      | required  | step_request |      |

  Scenario Outline: An answer that breaks a rule is not an answer
    When I check a "<definition>" with:
      | step_text | step_kind |
      | <text>    | <kind>    |
    Then the value is rejected by "<rule>" of "<failing>"

    Examples:
      | definition     | rule       | failing        | text                  | kind |
      | matched_step   | enum       | step_kind      | the value is accepted | then |
      | matched_step   | required   | matched_step   | the value is accepted |      |
      | unmatched_step | required   | unmatched_step |                       |      |
