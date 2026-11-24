# Model a stored record, the caller and the time

The core is a function of its input. It does not read a database, a session or a clock. If an operation depends on a stored record, on who calls, or on the time of the call, the shell puts that data in the input. The manifest declares it as properties of the input, and rules relate it to the rest of the request.

urn-forge has no keyword for a record, a caller or a clock. Each is an object or a value that you declare, with rules that you write.

## Before you start

- You know how to add an object and a rule. Refer to [Add an object or a list](add-an-object-or-a-list) and [Add a rule](add-a-rule).

## Give the core a stored record

1. Make a definition for the record as it is stored. Give it the type of the record:

   ```yaml
     stored_booking:
       description: The booking as it is stored, before the call
       type: booking
   ```

2. Add the stored record to the input object, next to the values of the request.
3. Add a rule to the input that ties the record to the request, for example that the record is the one the request names.
4. In the shell, load the record and put it in the input before you call `runOperation`.

These lines come from `packages/urn-forge/tests/fixtures/booking/domain.manifest.yaml`:

```yaml
definitions:
  seat_request:
    description: A request to seat a booking, with the booking as stored
    type: object
    properties: [reference, stored_booking]
    rules:
      - required: [reference, stored_booking]
      - names_the_booking

rules:
  names_the_booking:
    description: The request names the booking that was loaded
    rule: self.reference == self.stored_booking.reference
    message: The request names another booking than the one loaded
```

A shell that loads the wrong booking now gets `InputRejected`, and the core does not run.

### State before and after

The record in the input is the state before the call. The output is the state after. A rule of an output can compare them:

```yaml
rules:
  was_confirmed:
    description: The booking was confirmed
    rule: input.stored_booking.state == 'confirmed'
    message: The booking was not confirmed

  is_seated:
    description: The booking is seated
    rule: output.state == 'seated'
    message: The booking is not seated

  keeps_the_party:
    description: Seating changes the state only
    rule: >-
      output.reference == input.stored_booking.reference &&
      output.party_size == input.stored_booking.party_size &&
      output.contact == input.stored_booking.contact
    message: Seating may change only the state

operations:
  seat_booking:
    description: Seat the party of a booking
    input: seat_request
    output:
      - booking: [was_confirmed, is_seated, keeps_the_party]
      - invalid_state: [was_not_confirmed, names_the_request]
```

These rules state the moves between states: a booking is seated only from `confirmed`. Any other state gives `invalid_state`.

### A record that does not exist

If the shell can find no record, make the stored record optional: do not list it in `required`. Then add an output for the missing record, with a rule that reads `!has(input.stored_booking)`. The bookings contract in `contracts/bookings/domain.manifest.yaml` does this:

```yaml
  booking_was_not_found:
    description: No booking has the reference
    rule: '!has(input.stored_booking)'
    message: A booking has the reference
```

The output `booking_not_found` of each operation applies this rule.

## Give the core the caller

1. Make an object for the caller, as the shell authenticated them.
2. Add it to the input as a required property.
3. Write rules that say which callers may act, and an output for a caller who may not.

From `contracts/bookings/domain.manifest.yaml`:

```yaml
  role:
    description: Who calls, as the shell authenticated them; a guest presents the reference and the contact of a booking
    type: string
    rules:
      - enum: [guest, staff]

  caller:
    description: Who calls, as the shell authenticated them; staff carry the restaurant they work for
    type: object
    properties: [role, restaurant_id]
    rules:
      - required: [role]
      - staff_works_for_a_restaurant
```

The rule `caller_may_act` reads `input.caller.role` and `input.stored_booking`, and the output `forbidden` applies its opposite, `caller_may_not_act`. The shell authenticates the caller. The manifest states what each caller may do.

## Give the core the time

1. Make a definition for the time of the call: a `string` with `format: date-time`.
2. Add it to the input as a required property.
3. In a rule, compare it with `timestamp(...)` and `duration(...)`.
4. In the shell, read the clock and put the time in the input.

From `contracts/bookings/domain.manifest.yaml`:

```yaml
  now:
    description: The time of the call, in UTC, from the clock of the shell
    type: string
    rules:
      - format: date-time
      - in_utc
```

```yaml
  two_hours_before_start:
    description: The call is 2 hours or more before the start of the booking
    rule: has(input.stored_booking) && timestamp(input.now) <= timestamp(input.stored_booking.starts_at) - duration('2h')
    message: The booking starts in less than 2 hours
```

Thus the core and the scenarios are deterministic. A scenario gives the time as a cell of the input table. It does not wait for a clock.

The rule language has no calendar months and no time zones. A duration is in hours, minutes or seconds. A `format: date` string compares as text.

## Result

The operation depends only on its input. The harness checks the stored record, the caller and the time as it checks the rest of the input, and a scenario can give each one in a table cell, for example `stored_booking.state`.

## Related pages

- [The core and the shell](../explanation/core-and-shell)
- [The rule language](../reference/rule-language)
- [Write scenarios](write-scenarios)
