Feature: The results of a check and of a call

  check of a generated file gives the value, or the rules that it breaks. runOperation gives the
  answer of the core, or refuses the call by its kind: InputRejected when the caller sent an input
  that breaks the contract, and ContractViolation when the core answered what the contract does not
  allow. Each failure names the definition, the rule, the place of the value and the message.

  Scenario: An accepted check gives the value
    When I check a "check_accepted" with:
      | ok   | domain                | value         |
      | true | urn:demo:booking      | {"seats": 4}  |
    Then the value is accepted

  Scenario: A refused check gives each failure
    When I check a "check_refused" with:
      | ok    | domain           | failures                                                                                                   |
      | false | urn:demo:booking | [{"definition": "party_size", "rule": "minimum", "path": "party_size", "failure_message": "Must be at least 1"}] |
    Then the value is accepted

  Scenario: An answered call gives the output and its value
    When I check a "call_answered" with:
      | ok   | domain           | operation    | output  | value                  |
      | true | urn:demo:booking | book_a_table | booking | {"reference": "ABCD"} |
    Then the value is accepted

  Scenario Outline: A refused call gives its kind and each failure
    When I check a "call_refused" with:
      | ok    | domain           | operation    | kind   | failures                                                                                     |
      | false | urn:demo:booking | book_a_table | <kind> | [{"definition": "booking", "rule": "required", "path": "", "failure_message": "Must have each required property"}] |
    Then the value is accepted

    Examples:
      | kind              |
      | InputRejected     |
      | ContractViolation |

  Scenario Outline: A result that breaks a rule is not a result
    When I check a "<result>" with:
      | ok   | domain           | operation    | kind   | value   | failures   |
      | <ok> | urn:demo:booking | <operation>  | <kind> | <value> | <failures> |
    Then the value is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition         | result             | ok    | operation    | kind              | value | failures                                                                       |
      | is_true  | accepted           | check_accepted     | false |              |                   | 1     |                                                                                |
      | required | check_accepted     | check_accepted     | true  |              |                   |       |                                                                                |
      | is_false | refused            | check_refused      | true  |              |                   |       | [{"definition": "a", "rule": "b", "path": "", "failure_message": "C"}]         |
      | required | check_refused      | check_refused      | false |              |                   |       |                                                                                |
      | minItems | failures           | check_refused      | false |              |                   |       | []                                                                             |
      | required | failure            | check_refused      | false |              |                   |       | [{"definition": "a", "rule": "b", "path": ""}]                                 |
      | required | call_answered      | call_answered      | true  | book_a_table |                   | 1     |                                                                                |
      | required | input_rejected     | input_rejected     | false | book_a_table | InputRejected     |       |                                                                                |
      | required | contract_violation | contract_violation | false | book_a_table | ContractViolation |       |                                                                                |
      | enum     | refusal_kind       | input_rejected     | false | book_a_table | Rejected          |       | [{"definition": "a", "rule": "b", "path": "", "failure_message": "C"}]         |
