Feature: The URN of a part

  Each part of a manifest has a URN: urn, the namespace, the domain, the section of the part and
  its name, joined by colons. The generated file, diff and gate 5 name parts by it.

  Scenario Outline: A part gets its URN
    When I run "name_part" with:
      | namespace_name   | domain_name   | part_kind   | part_name   |
      | <namespace_name> | <domain_name> | <part_kind> | <part_name> |
    Then the output is "part_urn":
      | urn   |
      | <urn> |

    Examples:
      | namespace_name | domain_name | part_kind  | part_name    | urn                                       |
      | demo           | booking     | definition | party_size   | urn:demo:booking:definition:party_size    |
      | demo           | booking     | operation  | seat_booking | urn:demo:booking:operation:seat_booking   |
      | urn-forge      | standard    | rule       | minLength    | urn:urn-forge:standard:rule:minLength     |

  Scenario Outline: A part that is not a part of a manifest is rejected at the boundary
    When I run "name_part" with:
      | namespace_name   | domain_name   | part_kind   | part_name   |
      | <namespace_name> | <domain_name> | <part_kind> | <part_name> |
    Then the input is rejected by "<rule>" of "<definition>"

    Examples:
      | rule     | definition     | namespace_name | domain_name | part_kind  | part_name  |
      | pattern  | namespace_name | my_shop        | booking     | definition | party_size |
      | pattern  | domain_name    | demo           | Booking     | definition | party_size |
      | enum     | part_kind      | demo           | booking     | output     | party_size |
      | pattern  | part_name      | demo           | booking     | definition | Party      |
      | required | part           | demo           | booking     | definition |            |

  Scenario: A URN needs its text
    When I check a "part_urn" with:
      | urn |
      |     |
    Then the value is rejected by "required" of "part_urn"
