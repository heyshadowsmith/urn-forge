// A small ticketing core: fixed answers, and a few known values that give each declared error.
// The operations that change a hold or a ticket get the stored record as current.
import { emit, fail, ok, type DomainCoreImplementation } from './generated/domain.runtime.generated';

const EVENT = '6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f';
const CLOSED_EVENT = '00000000-0000-4000-8000-0000000000c1';
const HOLD = '3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b';
const ORDER = '7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f';
const TRANSFER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const REFUND = '1d2e3f40-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const UNAVAILABLE_ROW = 'Q';
const SOLD_OUT_SECTION = 'SOLD';
const DECLINED = 'DECLINED';
const USED_TICKET = 'USEDUSEDUSEDUSED';
/** The time of each answer and event that does not read the time of the call. */
const AT = '2026-12-01T19:00:00Z';
/** The start time of the event, in UTC. */
const STARTS_AT = '2026-12-12T20:00:00Z';
const SEATED_PRICE = 5000;
const STANDING_PRICE = 3000;
const FEE_PER_TICKET = 250;
const MAX_TICKETS = 10;

const eur = (amount_minor: number) => ({ amount_minor, currency: 'EUR' });
/** The instant a number of minutes after a UTC timestamp, as a UTC timestamp; whole seconds without milliseconds. */
const after = (at: string, minutes: number) => new Date(Date.parse(at) + minutes * 60_000).toISOString().replace('.000Z', 'Z');
const HOLD_MINUTES = 10;
const TRANSFER_MINUTES = 72 * 60;

const ticketA = {
  ticket_code: 'ABCDEFGH23456789',
  event_id: EVENT,
  place_kind: 'seated',
  section: 'A1',
  row: 'C',
  seat_number: 12,
  ticket_status: 'ISSUED',
  price: eur(SEATED_PRICE),
  starts_at: STARTS_AT,
} as const;
const ticketB = {
  ticket_code: 'ZYXWVUTS98765432',
  event_id: EVENT,
  place_kind: 'standing',
  section: 'FLOOR',
  ticket_status: 'ISSUED',
  price: eur(STANDING_PRICE),
  starts_at: STARTS_AT,
} as const;
const order = {
  order_id: ORDER,
  event_id: EVENT,
  starts_at: STARTS_AT,
  tickets: [ticketA, ticketB],
  fees: eur(2 * FEE_PER_TICKET),
  total: eur(SEATED_PRICE + STANDING_PRICE + 2 * FEE_PER_TICKET),
};

export const core = {
  // The hold is created at the time of the call, and expires 10 minutes later.
  'urn:corpus:ticketing:hold:operation:create_hold': ({ event_id, lines }, _current, now) => {
    if (event_id === CLOSED_EVENT) return fail('urn:corpus:ticketing:hold:error:sales_closed', { event_id });
    const count = lines.reduce((sum, line) => sum + (line.quantity ?? 1), 0);
    if (count > MAX_TICKETS) return fail('urn:corpus:ticketing:hold:error:limit_exceeded');
    const taken = lines.filter((line) => line.row === UNAVAILABLE_ROW);
    if (taken.length > 0) {
      const seats = taken.map((line) => ({ section: line.section, row: line.row ?? '', seat_number: line.seat_number ?? 1 }));
      return fail('urn:corpus:ticketing:hold:error:seat_unavailable', { seats });
    }
    const soldOut = lines.find((line) => line.place_kind === 'standing' && line.section === SOLD_OUT_SECTION);
    if (soldOut) return fail('urn:corpus:ticketing:hold:error:section_sold_out', { section: soldOut.section });
    const held = lines.map((line) => ({
      ...line,
      price: eur(line.place_kind === 'seated' ? SEATED_PRICE : STANDING_PRICE * (line.quantity ?? 1)),
    }));
    const total = held.reduce((sum, line) => sum + line.price.amount_minor, 0);
    return ok(
      { hold_id: HOLD, event_id, hold_status: 'ACTIVE', lines: held, total: eur(total), created_at: now, expires_at: after(now, HOLD_MINUTES) },
      [emit('urn:corpus:ticketing:hold:event:hold_created', { event_id, hold_id: HOLD, occurred_at: now })],
    );
  },

  // The shell's clock calls this for a hold after its expiry time; the runtime refuses a call before it.
  'urn:corpus:ticketing:hold:operation:expire_hold': ({ hold_id }, current, now) =>
    ok({ hold_id, hold_status: 'EXPIRED' }, [
      emit('urn:corpus:ticketing:hold:event:hold_expired', { event_id: current.event_id, hold_id, occurred_at: now }),
    ]),

  'urn:corpus:ticketing:hold:operation:release_hold': ({ hold_id }) => ok({ hold_id, hold_status: 'RELEASED' }),

  // The runtime refuses a checkout after the expiry of the hold before this runs; the events carry the time of the call.
  'urn:corpus:ticketing:order:operation:check_out': ({ hold_id, payment_reference }, current, now) => {
    if (payment_reference === DECLINED) return fail('urn:corpus:ticketing:order:error:payment_declined', { payment_reference });
    const { event_id } = current;
    return ok({ ...order, event_id, tickets: order.tickets.map((t) => ({ ...t, event_id })) }, [
      emit('urn:corpus:ticketing:order:event:order_placed', {
        event_id,
        order_id: ORDER,
        hold_id,
        ticket_codes: order.tickets.map((t) => t.ticket_code),
        occurred_at: now,
      }),
      ...order.tickets.map((t) =>
        emit('urn:corpus:ticketing:ticket:event:ticket_issued', { event_id, ticket_code: t.ticket_code, occurred_at: now }),
      ),
    ]);
  },

  'urn:corpus:ticketing:order:operation:get_order': ({ order_id }) => ok({ ...order, order_id }),

  // The offer is made at the time of the call, and can be accepted for 72 hours.
  'urn:corpus:ticketing:transfer:operation:transfer_ticket': ({ ticket_code, recipient_email }, current, now) =>
    ok({ transfer_id: TRANSFER, ticket_code, recipient_email, offered_at: now, accept_until: after(now, TRANSFER_MINUTES), starts_at: current.starts_at }),

  // The runtime refuses an acceptance 2 hours or less before the start of the event, or more than
  // 72 hours after the offer, before this runs.
  'urn:corpus:ticketing:transfer:operation:accept_transfer': (_input, current, now) => {
    const fresh = { ...ticketA, ticket_code: 'NEWXCDE234567892' };
    return ok(fresh, [
      emit('urn:corpus:ticketing:ticket:event:ticket_transferred', {
        event_id: EVENT,
        ticket_code: fresh.ticket_code,
        void_ticket_code: current.ticket_code,
        occurred_at: now,
      }),
    ]);
  },

  'urn:corpus:ticketing:transfer:operation:cancel_transfer': (_input, current) => ok({ ...current, ticket_status: 'ISSUED' }),

  // The runtime refuses a refund 48 hours or less before the start of the event before this runs.
  'urn:corpus:ticketing:refund:operation:request_refund': ({ order_id, ticket_codes }, current, now) => {
    const used = ticket_codes.find((code) => code === USED_TICKET);
    if (used) return fail('urn:corpus:ticketing:refund:error:ticket_not_refundable', { ticket_code: used });
    return ok(
      { refund_id: REFUND, order_id, ticket_codes: [...ticket_codes], amount: eur(SEATED_PRICE * ticket_codes.length) },
      ticket_codes.map((ticket_code) =>
        emit('urn:corpus:ticketing:ticket:event:ticket_refunded', { event_id: current.event_id, ticket_code, occurred_at: now }),
      ),
    );
  },

  'urn:corpus:ticketing:entry:operation:validate_ticket': ({ ticket_code, event_id }, _current, now) => {
    if (event_id !== EVENT) return ok({ ticket_code, event_id, verdict: 'WRONG_EVENT' });
    if (ticket_code === USED_TICKET) return ok({ ticket_code, event_id, verdict: 'ALREADY_USED' });
    if (ticket_code !== ticketA.ticket_code) return ok({ ticket_code, event_id, verdict: 'NOT_VALID' });
    return ok({ ticket_code, event_id, verdict: 'ADMIT' }, [
      emit('urn:corpus:ticketing:ticket:event:ticket_used', { event_id, ticket_code, occurred_at: now }),
    ]);
  },

  'urn:corpus:ticketing:show:operation:cancel_event': ({ event_id }) =>
    ok({ event_id, cancelled_at: AT }, [
      emit('urn:corpus:ticketing:show:event:event_cancelled', { event_id, occurred_at: AT }),
      ...order.tickets.map((t) =>
        emit('urn:corpus:ticketing:ticket:event:ticket_refunded', { event_id, ticket_code: t.ticket_code, occurred_at: AT }),
      ),
    ]),
} satisfies DomainCoreImplementation;
