@urn-forge:strict
@urn:corpus:ticketing:order:operation:get_order
Feature: Get an order

  Scenario: An order has its tickets, its fees and its total
    When I run the operation with:
      | order_id                             |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f |
    Then the output is:
      | order_id                             | tickets                                                                                                                                                                                                                                                                                                                                                                    | total                                 |
      | 7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f | [{ ticket_code: ABCDEFGH23456789, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: seated, section: A1, row: C, seat_number: 12, ticket_status: ISSUED, price: { amount_minor: 5000, currency: EUR } }, { ticket_code: ZYXWVUTS98765432, event_id: 6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f, place_kind: standing, section: FLOOR, ticket_status: ISSUED, price: { amount_minor: 3000, currency: EUR } }] | { amount_minor: 8500, currency: EUR } |

  Scenario: An order identifier that is not a UUID is rejected at the boundary
    When I run the operation with:
      | order_id |
      | order-1  |
    Then the input is rejected on "order_id"
