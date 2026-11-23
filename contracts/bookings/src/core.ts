// A small bookings core. Each operation on a booking gets it as `current` (get_booking through
// reads). Who may call is not the core's: the manifest states it in callers, and the runtime
// checks it before the handler runs.
import { emit, fail, ok, type DomainCoreImplementation } from './generated/domain.runtime.generated';
import type { BookingBookingInput } from './generated/domain.schemas.generated';

const GUEST_ID = 'a8098c1a-f86e-41da-bd5c-00c04fd430c8';
// seat_booking and complete_booking read no time, so the shell gives them none: their events carry this one.
const NOW = '2026-11-22T10:00:00Z';
const TIME_ZONE = 'Europe/Paris';
const DURATION = 120;

type Booking = BookingBookingInput;

// The windows of time (booking, change and cancel deadline, refund, no-show) are requires and ensures rules over
// now and starts_at in the manifest: the runtime refuses before this core runs. The core converts no time zone:
// starts_at is the start, which the client gives in UTC, and the local date, time and zone are the guest's values.

/** The start times that have no free table in this small core. */
const FULL = ['20:00', '23:45'];

/**
 * Up to 5 other start times for a full one: on the same local date, at most 2 hours before or after it,
 * for the same party. starts_at moves by the same minutes as the local time.
 */
function alternativesTo(starts_at: string, local_date: string, local_time: string, party_size: number) {
  const [hours, minutes] = local_time.split(':').map(Number) as [number, number];
  const requested = hours * 60 + minutes;
  return [-120, -60, -15, 15, 120]
    .filter((offset) => requested + offset >= 0 && requested + offset < 24 * 60)
    .map((offset) => {
      const start = requested + offset;
      return {
        starts_at: new Date(Date.parse(starts_at) + offset * 60_000).toISOString().replace('.000Z', 'Z'),
        local_date,
        local_time: `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`,
        party_size,
      };
    });
}

/** The event of a change; the shell gives its event_id (newEventId), and the outbox its order. */
function eventOf(booking: Booking, occurred_at: string) {
  return {
    occurred_at,
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
  'urn:corpus:bookings:booking:operation:create_booking': (request, _current, now) => {
    // A repeat with the same idempotency key never reaches the core: runOnce in the store file answers it.
    const { restaurant_id, starts_at, local_date, local_time, party_size, deposit_token } = request;
    if (deposit_token === 'declined') return fail('urn:corpus:bookings:booking:error:payment_declined');
    if (FULL.includes(local_time)) {
      return fail('urn:corpus:bookings:booking:error:no_availability', { local_date, local_time, time_zone: TIME_ZONE, party_size, alternatives: alternativesTo(starts_at, local_date, local_time, party_size) });
    }
    const deposit = party_size >= 7 ? { deposit_amount: `${party_size * 20}.00`, deposit_per_guest: '20.00', currency: 'EUR' } : {};
    const confirmation = {
      reference: 'NEWBK234',
      restaurant_id,
      status: 'CONFIRMED' as const,
      starts_at,
      local_date,
      local_time,
      time_zone: TIME_ZONE,
      party_size,
      duration_minutes: DURATION,
      ...deposit,
    };
    return ok(confirmation, [
      emit('urn:corpus:bookings:booking:event:booking_created', eventOf({ ...confirmation, state: 'CONFIRMED' }, now)),
    ]);
  },

  'urn:corpus:bookings:booking:operation:get_booking': (_request, current) => ok(current),

  'urn:corpus:bookings:booking:operation:change_booking': ({ starts_at, local_date, local_time, party_size }, current, now) => {
    const booking = {
      ...current,
      starts_at: starts_at ?? current.starts_at,
      local_date: local_date ?? current.local_date,
      local_time: local_time ?? current.local_time,
      party_size: party_size ?? current.party_size,
    };
    return ok(booking, [emit('urn:corpus:bookings:booking:event:booking_changed', eventOf(booking, now))]);
  },

  'urn:corpus:bookings:booking:operation:cancel_booking': ({ reference }, current, now) => {
    // A second cancellation gives the first answer again, and changes nothing.
    if (current.state === 'CANCELLED') {
      return ok({ reference, state: 'CANCELLED' as const, refund_amount: current.deposit_amount ?? '0.00', cancelled_at: '2026-11-20T08:00:00Z' });
    }
    const fullRefund = Date.parse(now) <= Date.parse(current.starts_at) - 24 * 3_600_000;
    const refund_amount = fullRefund ? (current.deposit_amount ?? '0.00') : '0.00';
    return ok({ reference, state: 'CANCELLED' as const, refund_amount, cancelled_at: now }, [
      emit('urn:corpus:bookings:booking:event:booking_cancelled', eventOf({ ...current, state: 'CANCELLED' }, now)),
    ]);
  },

  'urn:corpus:bookings:booking:operation:seat_booking': (_request, current) => {
    const booking = { ...current, state: 'SEATED' as const };
    return ok(booking, [emit('urn:corpus:bookings:booking:event:booking_seated', eventOf(booking, NOW))]);
  },

  'urn:corpus:bookings:booking:operation:complete_booking': (_request, current) => {
    const booking = { ...current, state: 'COMPLETED' as const };
    return ok(booking, [emit('urn:corpus:bookings:booking:event:booking_completed', eventOf(booking, NOW))]);
  },

  'urn:corpus:bookings:booking:operation:mark_no_show': (_request, current, now) => {
    const booking = { ...current, state: 'NO_SHOW' as const };
    return ok(booking, [emit('urn:corpus:bookings:booking:event:booking_no_show', eventOf(booking, now))]);
  },
} satisfies DomainCoreImplementation;
