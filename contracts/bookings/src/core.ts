// A small bookings core. The shell loads what a call needs into its input: the booking as stored
// (absent when no booking has the reference), the caller, the time of the call, and for create the
// first call with the same idempotency key. The harness, runOperation, checks the input before the core
// runs and the answer after, with the rules of the output that comes back: who may call, the states,
// the windows of time and the events are rules of the manifest, and the core answers by them.
import { answer, type Booking, type BookingEvent, type BookingRef, type DomainCore, type EventType } from './generated/domain.generated';

// The shell would give fresh ids; this core gives fixed ones, so that a scenario can check them.
const EVENT_ID = '16fd2706-8baf-433b-82eb-8c7fed5c9b0e';
const GUEST_ID = 'a8098c1a-f86e-41da-bd5c-00c04fd430c8';
const TIME_ZONE = 'Europe/Paris';
const DURATION = 120;
const DEPOSIT_PER_GUEST = 2000;
const HOUR = 3_600_000;

/** The start times that have no free table in this small core. */
const FULL = ['20:00', '23:45'];

const at = (text: string): number => Date.parse(text);

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
        starts_at: new Date(at(starts_at) + offset * 60_000).toISOString().replace('.000Z', 'Z'),
        local_date,
        local_time: `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`,
        party_size,
      };
    });
}

/** The event of a change to a booking. */
function eventOf(booking: Booking, event_type: EventType, occurred_at: string): BookingEvent {
  return {
    event_id: EVENT_ID,
    event_type,
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

/** Whether the caller may act on the booking: a guest who presents its email or phone, or staff of its restaurant. */
function mayAct({ caller, email, phone }: BookingRef, booking: Booking): boolean {
  if (caller.role === 'staff') return caller.restaurant_id !== undefined && caller.restaurant_id === booking.restaurant_id;
  return (email !== undefined && email === booking.email) || (phone !== undefined && phone === booking.phone);
}

const isStaffOf = ({ caller }: BookingRef, booking: Booking): boolean =>
  caller.role === 'staff' && caller.restaurant_id !== undefined && caller.restaurant_id === booking.restaurant_id;

/** The window of a booking: from 90 days to 2 hours before the start, both edges included. */
const inWindow = (now: string, starts_at: string): boolean => at(now) >= at(starts_at) - 90 * 24 * HOUR && at(now) <= at(starts_at) - 2 * HOUR;

/** The same value, item by item and property by property. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, i) => same(item, b[i]));
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null || Array.isArray(a) || Array.isArray(b)) return false;
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
  return [...keys].every((k) => same(x[k], y[k]));
}

export const core = {
  create_booking: ({ booking_request, now, first_call }) => {
    const { restaurant_id, starts_at, local_date, local_time, party_size, contact, idempotency_key, deposit_token } = booking_request;
    if (party_size >= 13) return answer('party_too_large_for_online', { party_size });
    if (party_size >= 7 && deposit_token === undefined) return answer('deposit_required', { party_size });
    if (first_call) {
      // A repeat with the same key in 24 hours gives the first answer, and stores and publishes nothing.
      if (same(first_call.booking_request, booking_request)) return answer('repeated', { confirmation: first_call.confirmation });
      return answer('invalid_request', { idempotency_key });
    }
    if (!inWindow(now, starts_at)) return answer('outside_booking_window', { starts_at, local_date, local_time });
    if (FULL.includes(local_time)) {
      return answer('no_availability', { local_date, local_time, time_zone: TIME_ZONE, party_size, alternatives: alternativesTo(starts_at, local_date, local_time, party_size) });
    }
    if (deposit_token === 'declined') return answer('payment_declined', { deposit_token });
    const deposit = party_size >= 7 ? { deposit_amount: party_size * DEPOSIT_PER_GUEST, deposit_per_guest: DEPOSIT_PER_GUEST, currency: 'EUR' } : {};
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
    const booking: Booking = {
      reference: confirmation.reference,
      restaurant_id,
      state: 'CONFIRMED',
      starts_at,
      local_date,
      local_time,
      time_zone: TIME_ZONE,
      party_size,
      duration_minutes: DURATION,
      ...(deposit.deposit_amount !== undefined ? { deposit_amount: deposit.deposit_amount } : {}),
      ...(contact.email !== undefined ? { email: contact.email } : {}),
      ...(contact.phone !== undefined ? { phone: contact.phone } : {}),
    };
    return answer('booked', { confirmation, booking, booking_event: eventOf(booking, 'BookingCreated', now) });
  },

  get_booking: (request) => {
    const { reference, stored_booking } = request;
    if (!stored_booking) return answer('booking_not_found', { reference });
    if (!mayAct(request, stored_booking)) return answer('forbidden', { reference });
    return answer('booking', stored_booking);
  },

  change_booking: (request) => {
    const { reference, stored_booking, now, starts_at, local_date, local_time, party_size, deposit_token } = request;
    if (!stored_booking) return answer('booking_not_found', { reference });
    if (!mayAct(request, stored_booking)) return answer('forbidden', { reference });
    if (stored_booking.state !== 'CONFIRMED') return answer('invalid_state', { reference, state: stored_booking.state });
    // The deadline reads the start as it is stored, before the change.
    if (at(now) > at(stored_booking.starts_at) - 2 * HOUR) return answer('change_deadline_passed', { reference });
    if (party_size !== undefined && party_size >= 13) return answer('party_too_large_for_online', { party_size });
    if (party_size !== undefined && party_size >= 7 && deposit_token === undefined) return answer('deposit_required', { party_size });
    if (starts_at !== undefined && !inWindow(now, starts_at)) {
      return answer('outside_booking_window', {
        starts_at,
        local_date: local_date ?? stored_booking.local_date,
        local_time: local_time ?? stored_booking.local_time,
      });
    }
    const booking: Booking = {
      ...stored_booking,
      starts_at: starts_at ?? stored_booking.starts_at,
      local_date: local_date ?? stored_booking.local_date,
      local_time: local_time ?? stored_booking.local_time,
      party_size: party_size ?? stored_booking.party_size,
    };
    return answer('booking_change', { booking, booking_event: eventOf(booking, 'BookingChanged', now) });
  },

  cancel_booking: (request) => {
    const { reference, stored_booking, now } = request;
    if (!stored_booking) return answer('booking_not_found', { reference });
    if (!mayAct(request, stored_booking)) return answer('forbidden', { reference });
    // A second cancellation gives the first answer again, at any time, and changes nothing.
    if (stored_booking.state === 'CANCELLED' && stored_booking.refund_amount !== undefined && stored_booking.cancelled_at !== undefined) {
      return answer('already_cancelled', {
        cancellation: { reference, state: 'CANCELLED' as const, refund_amount: stored_booking.refund_amount, cancelled_at: stored_booking.cancelled_at },
      });
    }
    if (stored_booking.state !== 'CONFIRMED') return answer('invalid_state', { reference, state: stored_booking.state });
    if (at(now) > at(stored_booking.starts_at) - 2 * HOUR) return answer('change_deadline_passed', { reference });
    const fullRefund = at(now) <= at(stored_booking.starts_at) - 24 * HOUR;
    const refund_amount = fullRefund ? (stored_booking.deposit_amount ?? 0) : 0;
    const booking: Booking = { ...stored_booking, state: 'CANCELLED', refund_amount, cancelled_at: now };
    return answer('cancelled', {
      cancellation: { reference, state: 'CANCELLED' as const, refund_amount, cancelled_at: now },
      booking,
      booking_event: eventOf(booking, 'BookingCancelled', now),
    });
  },

  seat_booking: (request) => {
    const { reference, stored_booking, now } = request;
    if (!stored_booking) return answer('booking_not_found', { reference });
    if (!isStaffOf(request, stored_booking)) return answer('forbidden', { reference });
    if (stored_booking.state !== 'CONFIRMED') return answer('invalid_state', { reference, state: stored_booking.state });
    const booking: Booking = { ...stored_booking, state: 'SEATED' };
    return answer('booking_change', { booking, booking_event: eventOf(booking, 'BookingSeated', now) });
  },

  complete_booking: (request) => {
    const { reference, stored_booking, now } = request;
    if (!stored_booking) return answer('booking_not_found', { reference });
    if (!isStaffOf(request, stored_booking)) return answer('forbidden', { reference });
    if (stored_booking.state !== 'SEATED') return answer('invalid_state', { reference, state: stored_booking.state });
    const booking: Booking = { ...stored_booking, state: 'COMPLETED' };
    return answer('booking_change', { booking, booking_event: eventOf(booking, 'BookingCompleted', now) });
  },

  mark_no_show: (request) => {
    const { reference, stored_booking, now } = request;
    if (!stored_booking) return answer('booking_not_found', { reference });
    if (!isStaffOf(request, stored_booking)) return answer('forbidden', { reference });
    // From 15 minutes after the start onward, that edge included.
    if (stored_booking.state !== 'CONFIRMED' || at(now) < at(stored_booking.starts_at) + 15 * 60_000) {
      return answer('invalid_state', { reference, state: stored_booking.state });
    }
    const booking: Booking = { ...stored_booking, state: 'NO_SHOW' };
    return answer('booking_change', { booking, booking_event: eventOf(booking, 'BookingNoShow', now) });
  },
} satisfies DomainCore;
