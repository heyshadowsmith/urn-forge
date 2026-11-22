// A small bookings core: a fixed set of stored bookings, enough for the scenarios.
import { emit, fail, ok, type DomainCoreImplementation } from './generated/domain.runtime.generated';

type State = 'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

interface Stored {
  readonly state: State;
  /** Hours from now to the start time. */
  readonly startsIn: number;
  readonly restaurant_id: string;
  readonly deposit_amount?: string;
}

const OWN_RESTAURANT = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const OTHER_RESTAURANT = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const GUEST_ID = 'a8098c1a-f86e-41da-bd5c-00c04fd430c8';
const EVENT_ID = '16fd2706-8baf-433b-82eb-8c7fed5c9b0e';
const NOW = '2026-11-22T10:00:00Z';
const TIME_ZONE = 'Europe/Paris';
const DURATION = 120;

const STORED: Readonly<Record<string, Stored>> = {
  CNFRMD22: { state: 'CONFIRMED', startsIn: 48, restaurant_id: OWN_RESTAURANT, deposit_amount: '80.00' },
  LATE3333: { state: 'CONFIRMED', startsIn: 5, restaurant_id: OWN_RESTAURANT, deposit_amount: '80.00' },
  LATE2222: { state: 'CONFIRMED', startsIn: 1, restaurant_id: OWN_RESTAURANT },
  PAST2222: { state: 'CONFIRMED', startsIn: -1, restaurant_id: OWN_RESTAURANT },
  SEATED22: { state: 'SEATED', startsIn: 0, restaurant_id: OWN_RESTAURANT },
  CANCLD22: { state: 'CANCELLED', startsIn: 48, restaurant_id: OWN_RESTAURANT, deposit_amount: '80.00' },
  FRBDDN22: { state: 'CONFIRMED', startsIn: 48, restaurant_id: OTHER_RESTAURANT },
};

function view(reference: string, stored: Stored, state: State = stored.state) {
  return {
    reference,
    restaurant_id: stored.restaurant_id,
    state,
    local_date: '2026-12-24',
    local_time: '19:30',
    time_zone: TIME_ZONE,
    party_size: 4,
    duration_minutes: DURATION,
    ...(stored.deposit_amount ? { deposit_amount: stored.deposit_amount } : {}),
  };
}

function eventOf(booking: ReturnType<typeof view>) {
  return {
    event_id: EVENT_ID,
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

/** The stored booking, or the reason the caller cannot act on it. */
function find(reference: string) {
  const stored = STORED[reference];
  if (!stored) return fail('urn:corpus:bookings:booking:error:booking_not_found', { reference });
  if (stored.restaurant_id !== OWN_RESTAURANT) return fail('urn:corpus:bookings:booking:error:forbidden', { reference });
  return { ok: true as const, stored };
}

/** A staff move from one state to the next. */
function move(reference: string, from: State, to: State) {
  const found = find(reference);
  if (!found.ok) return found;
  if (found.stored.state !== from) {
    return fail('urn:corpus:bookings:booking:error:invalid_state', { reference, state: found.stored.state });
  }
  return { ok: true as const, booking: view(reference, found.stored, to) };
}

export const core = {
  'urn:corpus:bookings:booking:operation:create_booking': (request) => {
    const { restaurant_id, local_date, local_time, party_size, idempotency_key, deposit_token } = request;
    if (party_size >= 13) return fail('urn:corpus:bookings:booking:error:party_too_large_for_online', { party_size });
    if (party_size >= 7 && deposit_token === undefined) return fail('urn:corpus:bookings:booking:error:deposit_required', { party_size });
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

  'urn:corpus:bookings:booking:operation:get_booking': ({ reference }) => {
    const found = find(reference);
    return found.ok ? ok(view(reference, found.stored)) : found;
  },

  'urn:corpus:bookings:booking:operation:change_booking': ({ reference, local_date, local_time, party_size }) => {
    const found = find(reference);
    if (!found.ok) return found;
    const { stored } = found;
    if (stored.state !== 'CONFIRMED') return fail('urn:corpus:bookings:booking:error:invalid_state', { reference, state: stored.state });
    if (stored.startsIn < 2) return fail('urn:corpus:bookings:booking:error:change_deadline_passed', { reference });
    const before = view(reference, stored);
    const booking = {
      ...before,
      local_date: local_date ?? before.local_date,
      local_time: local_time ?? before.local_time,
      party_size: party_size ?? before.party_size,
    };
    return ok(booking, [emit('urn:corpus:bookings:booking:event:booking_changed', eventOf(booking))]);
  },

  'urn:corpus:bookings:booking:operation:cancel_booking': ({ reference }) => {
    const found = find(reference);
    if (!found.ok) return found;
    const { stored } = found;
    const fullRefund = stored.startsIn >= 24 ? (stored.deposit_amount ?? '0.00') : '0.00';
    // A second cancellation gives the first answer again, and changes nothing.
    if (stored.state === 'CANCELLED') {
      return ok({ reference, state: 'CANCELLED' as const, refund_amount: fullRefund, cancelled_at: '2026-11-20T08:00:00Z' });
    }
    if (stored.state !== 'CONFIRMED') return fail('urn:corpus:bookings:booking:error:invalid_state', { reference, state: stored.state });
    if (stored.startsIn < 2) return fail('urn:corpus:bookings:booking:error:change_deadline_passed', { reference });
    return ok({ reference, state: 'CANCELLED' as const, refund_amount: fullRefund, cancelled_at: NOW }, [
      emit('urn:corpus:bookings:booking:event:booking_cancelled', eventOf(view(reference, stored, 'CANCELLED'))),
    ]);
  },

  'urn:corpus:bookings:booking:operation:seat_booking': ({ reference }) => {
    const moved = move(reference, 'CONFIRMED', 'SEATED');
    if (!moved.ok) return moved;
    return ok(moved.booking, [emit('urn:corpus:bookings:booking:event:booking_seated', eventOf(moved.booking))]);
  },

  'urn:corpus:bookings:booking:operation:complete_booking': ({ reference }) => {
    const moved = move(reference, 'SEATED', 'COMPLETED');
    if (!moved.ok) return moved;
    return ok(moved.booking, [emit('urn:corpus:bookings:booking:event:booking_completed', eventOf(moved.booking))]);
  },

  'urn:corpus:bookings:booking:operation:mark_no_show': ({ reference }) => {
    const found = find(reference);
    if (!found.ok) return found;
    // Only from 15 minutes after the start time onward.
    if (found.stored.state !== 'CONFIRMED' || found.stored.startsIn > -0.25) {
      return fail('urn:corpus:bookings:booking:error:invalid_state', { reference, state: found.stored.state });
    }
    const booking = view(reference, found.stored, 'NO_SHOW');
    return ok(booking, [emit('urn:corpus:bookings:booking:event:booking_no_show', eventOf(booking))]);
  },
} satisfies DomainCoreImplementation;
