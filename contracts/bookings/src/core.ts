// A small bookings core. Each operation on a booking gets it as `current` (get_booking through
// reads). Who may call is not the core's: the manifest states it in callers, and the runtime
// checks it before the handler runs.
import { emit, fail, ok, type DomainCoreImplementation } from './generated/domain.runtime.generated';
import type { BookingBookingInput } from './generated/domain.schemas.generated';

const GUEST_ID = 'a8098c1a-f86e-41da-bd5c-00c04fd430c8';
const NOW = '2026-11-22T10:00:00Z';
const TIME_ZONE = 'Europe/Paris';
const DURATION = 120;

type Booking = BookingBookingInput;

/** Hours from now to the start time of a booking, in the time zone of the restaurant. */
function startsIn({ local_date, local_time, time_zone }: Booking): number {
  const asUtc = Date.parse(`${local_date}T${local_time}:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: time_zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(asUtc)
      .map((part) => [part.type, part.value]),
  );
  const offset = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`) - asUtc;
  return (asUtc - offset - Date.parse(NOW)) / 3_600_000;
}

/** The event of a change; the shell gives its event_id (newEventId), and the outbox its order. */
function eventOf(booking: Booking) {
  return {
    occurred_at: NOW,
    reference: booking.reference,
    restaurant_id: booking.restaurant_id,
    state: booking.state,
    party_size: booking.party_size,
    local_date: booking.local_date,
    local_time: booking.local_time,
    time_zone: booking.time_zone,
    guest_id: GUEST_ID,
  };
}

export const core = {
  'urn:corpus:bookings:booking:operation:create_booking': (request) => {
    const { restaurant_id, local_date, local_time, party_size, idempotency_key, deposit_token } = request;
    if (deposit_token === 'declined') return fail('urn:corpus:bookings:booking:error:payment_declined');
    if (idempotency_key.startsWith('reused')) return fail('urn:corpus:bookings:booking:error:invalid_request', { idempotency_key });
    if (local_date < '2026-11-22' || local_date > '2027-02-20') {
      return fail('urn:corpus:bookings:booking:error:outside_booking_window', { local_date, local_time, time_zone: TIME_ZONE });
    }
    if (local_time === '23:45') {
      return fail('urn:corpus:bookings:booking:error:no_availability', { local_date, local_time, time_zone: TIME_ZONE, party_size, alternatives: ['22:00', '22:15'] });
    }
    const deposit = party_size >= 7 ? { deposit_amount: `${party_size * 20}.00`, deposit_per_guest: '20.00', currency: 'EUR' } : {};
    const confirmation = {
      reference: 'NEWBK234',
      restaurant_id,
      status: 'CONFIRMED' as const,
      local_date,
      local_time,
      time_zone: TIME_ZONE,
      party_size,
      duration_minutes: DURATION,
      ...deposit,
    };
    return ok(confirmation, [
      emit('urn:corpus:bookings:booking:event:booking_created', eventOf({ ...confirmation, state: 'CONFIRMED' })),
    ]);
  },

  'urn:corpus:bookings:booking:operation:get_booking': (_request, current) => ok(current),

  'urn:corpus:bookings:booking:operation:change_booking': ({ reference, local_date, local_time, party_size }, current) => {
    if (startsIn(current) < 2) return fail('urn:corpus:bookings:booking:error:change_deadline_passed', { reference });
    const booking = {
      ...current,
      local_date: local_date ?? current.local_date,
      local_time: local_time ?? current.local_time,
      party_size: party_size ?? current.party_size,
    };
    return ok(booking, [emit('urn:corpus:bookings:booking:event:booking_changed', eventOf(booking))]);
  },

  'urn:corpus:bookings:booking:operation:cancel_booking': ({ reference }, current) => {
    const hours = startsIn(current);
    const refund_amount = hours >= 24 ? (current.deposit_amount ?? '0.00') : '0.00';
    // A second cancellation gives the first answer again, and changes nothing.
    if (current.state === 'CANCELLED') {
      return ok({ reference, state: 'CANCELLED' as const, refund_amount, cancelled_at: '2026-11-20T08:00:00Z' });
    }
    if (hours < 2) return fail('urn:corpus:bookings:booking:error:change_deadline_passed', { reference });
    return ok({ reference, state: 'CANCELLED' as const, refund_amount, cancelled_at: NOW }, [
      emit('urn:corpus:bookings:booking:event:booking_cancelled', eventOf({ ...current, state: 'CANCELLED' })),
    ]);
  },

  'urn:corpus:bookings:booking:operation:seat_booking': (_request, current) => {
    const booking = { ...current, state: 'SEATED' as const };
    return ok(booking, [emit('urn:corpus:bookings:booking:event:booking_seated', eventOf(booking))]);
  },

  'urn:corpus:bookings:booking:operation:complete_booking': (_request, current) => {
    const booking = { ...current, state: 'COMPLETED' as const };
    return ok(booking, [emit('urn:corpus:bookings:booking:event:booking_completed', eventOf(booking))]);
  },

  'urn:corpus:bookings:booking:operation:mark_no_show': ({ reference }, current) => {
    // Only from 15 minutes after the start time onward.
    if (startsIn(current) > -0.25) return fail('urn:corpus:bookings:booking:error:invalid_state', { reference, state: current.state });
    const booking = { ...current, state: 'NO_SHOW' as const };
    return ok(booking, [emit('urn:corpus:bookings:booking:event:booking_no_show', eventOf(booking))]);
  },
} satisfies DomainCoreImplementation;
