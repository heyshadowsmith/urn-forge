// A small ticketing core: it decides from the input alone, which carries the caller, the time of the
// call and the stored records that the shell loaded. A few known values give the refusals that need
// state the input does not carry (seat availability, section capacity, the buyer's other holds, sales).
import { answer, type DomainCore, type HeldLine, type Hold, type Order, type Ticket, type TicketCode } from './generated/domain.generated';

const CLOSED_EVENT = '00000000-0000-4000-8000-0000000000c1';
const HOLD = '3b8e7a10-2c4d-4e6f-9a1b-2c3d4e5f6a7b';
const ORDER = '7c9d8e10-3a4b-4c5d-8e6f-7a8b9c0d1e2f';
const TRANSFER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const REFUND = '1d2e3f40-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
/** A row whose seats are all taken. */
const UNAVAILABLE_ROW = 'Q';
/** A standing section with no capacity left. */
const SOLD_OUT_SECTION = 'SOLD';
/** A buyer who already holds 10 tickets of every event. */
const BUYER_AT_LIMIT = 'buyer-at-limit';
const SEATED_PRICE = 5000;
const STANDING_PRICE = 3000;
const FEE_PER_TICKET = 250;
const HOLD_MINUTES = 10;
const TRANSFER_MINUTES = 72 * 60;
const MINUTE = 60_000;

/** The id of the nth message of an answer: 00000000-0000-4000-8000-000000000001, 2, ... */
const message = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
/** The instant some minutes after a UTC time, as a UTC time; whole seconds without milliseconds. */
const after = (at: string, minutes: number) => new Date(Date.parse(at) + minutes * MINUTE).toISOString().replace('.000Z', 'Z');
const ms = (at: string) => Date.parse(at);

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** The nth new ticket code: ABCDEFGHJKLMNPAA, ABCDEFGHJKLMNPAB, ... */
const newCode = (n: number): TicketCode => `ABCDEFGHJKLMNP${CODE_LETTERS[Math.floor(n / 32) % 32]}${CODE_LETTERS[n % 32]}`;

/** The tickets of a hold: one per seated line, the quantity per standing line; a line's price split over its tickets. */
function ticketsOf(hold: Hold): Ticket[] {
  const tickets: Ticket[] = [];
  for (const line of hold.held_lines) {
    const base = Math.floor(line.price.amount_minor / line.quantity);
    for (let i = 0; i < line.quantity; i++) {
      const amount_minor = base + (i === 0 ? line.price.amount_minor % line.quantity : 0);
      tickets.push({
        ticket_code: newCode(tickets.length),
        event_id: hold.event_id,
        buyer_id: hold.buyer_id,
        place_kind: line.place_kind,
        section: line.section,
        ...(line.row !== undefined ? { row: line.row } : {}),
        ...(line.seat_number !== undefined ? { seat_number: line.seat_number } : {}),
        ticket_status: 'ISSUED',
        price: { amount_minor, currency: line.price.currency },
      });
    }
  }
  return tickets;
}

export const core = {
  create_hold: ({ event_id, hold_lines, caller, called_at }) => {
    if (event_id === CLOSED_EVENT) return answer('sales_closed', { event_id });
    if (caller.caller_id === BUYER_AT_LIMIT) return answer('limit_exceeded', { event_id });
    const taken = hold_lines.flatMap((l) => (l.row === UNAVAILABLE_ROW && l.seat_number !== undefined ? [{ section: l.section, row: l.row, seat_number: l.seat_number }] : []));
    if (taken.length > 0) return answer('seat_unavailable', { seats: taken });
    const soldOut = hold_lines.find((l) => l.place_kind === 'standing' && l.section === SOLD_OUT_SECTION);
    if (soldOut) return answer('section_sold_out', { section: soldOut.section });
    const held_lines: HeldLine[] = hold_lines.map((l) => ({
      ...l,
      price: { amount_minor: l.place_kind === 'seated' ? SEATED_PRICE : STANDING_PRICE * l.quantity, currency: 'EUR' },
    }));
    const total = held_lines.reduce((sum, l) => sum + l.price.amount_minor, 0);
    const hold: Hold = {
      hold_id: HOLD,
      event_id,
      buyer_id: caller.caller_id,
      hold_status: 'ACTIVE',
      held_lines,
      total: { amount_minor: total, currency: 'EUR' },
      created_at: called_at,
      expires_at: after(called_at, HOLD_MINUTES),
    };
    return answer('new_hold', { hold, hold_created: { message_id: message(1), event_id, hold_id: HOLD, occurred_at: called_at } });
  },

  // The shell's clock calls this for a hold after its expiry time.
  expire_hold: ({ hold_id, called_at, stored_hold }) => {
    if (!stored_hold) return answer('hold_not_found', { hold_id });
    if (stored_hold.hold_status !== 'ACTIVE') return answer('hold_not_active', { hold_id, hold_status: stored_hold.hold_status });
    if (ms(called_at) <= ms(stored_hold.expires_at)) return answer('hold_not_due', { hold_id, expires_at: stored_hold.expires_at });
    return answer('expired_hold', {
      hold_id,
      hold_status: 'EXPIRED' as const,
      hold_expired: { message_id: message(1), event_id: stored_hold.event_id, hold_id, occurred_at: called_at },
    });
  },

  release_hold: ({ hold_id, stored_hold }) => {
    if (!stored_hold) return answer('hold_not_found', { hold_id });
    if (stored_hold.hold_status !== 'ACTIVE') return answer('hold_not_active', { hold_id, hold_status: stored_hold.hold_status });
    return answer('hold_state', { hold_id, hold_status: 'RELEASED' as const });
  },

  check_out: ({ hold_id, payment_reference, payment_outcome, caller, called_at, stored_hold }) => {
    if (!stored_hold) return answer('hold_not_found', { hold_id });
    if (caller.caller_id !== stored_hold.buyer_id) return answer('forbidden', { caller_id: caller.caller_id });
    if (stored_hold.hold_status !== 'ACTIVE' || ms(called_at) > ms(stored_hold.expires_at)) {
      return answer('hold_expired_refusal', { hold_id, expires_at: stored_hold.expires_at });
    }
    if (payment_outcome === 'declined') return answer('payment_declined', { payment_reference });
    const { currency } = stored_hold.total;
    const tickets = ticketsOf(stored_hold);
    const fees = FEE_PER_TICKET * tickets.length;
    const order: Order = {
      order_id: ORDER,
      event_id: stored_hold.event_id,
      buyer_id: stored_hold.buyer_id,
      hold_id,
      tickets,
      fees: { amount_minor: fees, currency },
      total: { amount_minor: stored_hold.total.amount_minor + fees, currency },
    };
    return answer('placed_order', {
      order,
      converted_hold: { hold_id, hold_status: 'CONVERTED' as const },
      order_placed: {
        message_id: message(1),
        event_id: order.event_id,
        order_id: ORDER,
        hold_id,
        ticket_codes: tickets.map((t) => t.ticket_code),
        occurred_at: called_at,
      },
      tickets_issued: tickets.map((t, i) => ({ message_id: message(i + 2), event_id: order.event_id, ticket_code: t.ticket_code, occurred_at: called_at })),
    });
  },

  get_order: ({ order_id, stored_order }) => (stored_order ? answer('order', stored_order) : answer('order_not_found', { order_id })),

  // The offer is made at the time of the call, and can be accepted for 72 hours.
  transfer_ticket: ({ ticket_code, recipient_email, caller, called_at, stored_ticket, show }) => {
    if (!stored_ticket || !show) return answer('ticket_not_found', { ticket_code });
    if (caller.caller_id !== stored_ticket.buyer_id) return answer('forbidden', { caller_id: caller.caller_id });
    if (stored_ticket.ticket_status !== 'ISSUED') return answer('invalid_ticket_state', { ticket_code, ticket_status: stored_ticket.ticket_status });
    if (ms(called_at) >= ms(show.starts_at) - 120 * MINUTE) return answer('transfer_window_closed', { ticket_code, starts_at: show.starts_at });
    return answer('offered_transfer', {
      transfer: { transfer_id: TRANSFER, ticket_code, recipient_email, offered_at: called_at, accept_until: after(called_at, TRANSFER_MINUTES) },
      pending_ticket: { ticket_code, ticket_status: 'TRANSFER_PENDING' as const },
    });
  },

  accept_transfer: ({ transfer_id, caller, called_at, stored_transfer, stored_ticket, show }) => {
    if (!stored_transfer || !stored_ticket || !show) return answer('transfer_not_found', { transfer_id });
    if (caller.caller_email !== stored_transfer.recipient_email) return answer('forbidden', { caller_id: caller.caller_id });
    if (stored_ticket.ticket_status !== 'TRANSFER_PENDING') return answer('invalid_ticket_state', { ticket_code: stored_ticket.ticket_code, ticket_status: stored_ticket.ticket_status });
    if (ms(called_at) >= ms(show.starts_at) - 120 * MINUTE) return answer('transfer_window_closed', { ticket_code: stored_ticket.ticket_code, starts_at: show.starts_at });
    if (ms(called_at) > ms(stored_transfer.offered_at) + TRANSFER_MINUTES * MINUTE) {
      return answer('transfer_expired', { transfer_id, accept_until: stored_transfer.accept_until });
    }
    const code = newCode(stored_ticket.ticket_code === newCode(0) ? 1 : 0);
    const new_ticket: Ticket = { ...stored_ticket, ticket_code: code, buyer_id: caller.caller_id, ticket_status: 'ISSUED' };
    return answer('accepted_transfer', {
      new_ticket,
      void_ticket: { ticket_code: stored_ticket.ticket_code, ticket_status: 'VOID' as const },
      ticket_transferred: {
        message_id: message(1),
        event_id: stored_ticket.event_id,
        ticket_code: code,
        void_ticket_code: stored_ticket.ticket_code,
        occurred_at: called_at,
      },
    });
  },

  cancel_transfer: ({ transfer_id, stored_transfer, stored_ticket }) => {
    if (!stored_transfer || !stored_ticket) return answer('transfer_not_found', { transfer_id });
    if (stored_ticket.ticket_status !== 'TRANSFER_PENDING') return answer('invalid_ticket_state', { ticket_code: stored_ticket.ticket_code, ticket_status: stored_ticket.ticket_status });
    return answer('ticket_state', { ticket_code: stored_ticket.ticket_code, ticket_status: 'ISSUED' as const });
  },

  // A refund pays back the prices paid for the tickets, without the fees.
  request_refund: ({ order_id, ticket_codes, caller, called_at, stored_order, stored_tickets, show }) => {
    if (!stored_order || !stored_tickets || !show) return answer('order_not_found', { order_id });
    if (caller.caller_id !== stored_order.buyer_id) return answer('forbidden', { caller_id: caller.caller_id });
    if (ms(called_at) >= ms(show.starts_at) - 48 * 60 * MINUTE) return answer('refund_window_closed', { order_id, starts_at: show.starts_at });
    const spent = stored_tickets.find((t) => t.ticket_status === 'USED' || t.ticket_status === 'REFUNDED' || t.ticket_status === 'VOID');
    if (spent) return answer('ticket_not_refundable', { ticket_code: spent.ticket_code });
    const amount_minor = stored_tickets.reduce((sum, t) => sum + t.price.amount_minor, 0);
    return answer('granted_refund', {
      refund: { refund_id: REFUND, order_id, ticket_codes, refund_amount: { amount_minor, currency: stored_order.total.currency } },
      refunded_tickets: ticket_codes.map((ticket_code) => ({ ticket_code, ticket_status: 'REFUNDED' as const })),
      tickets_refunded: ticket_codes.map((ticket_code, i) => ({ message_id: message(i + 1), event_id: stored_order.event_id, ticket_code, occurred_at: called_at })),
    });
  },

  validate_ticket: ({ ticket_code, event_id, caller, called_at, stored_ticket }) => {
    if (caller.caller_role !== 'box_office' || !caller.assigned_events?.includes(event_id)) return answer('forbidden', { caller_id: caller.caller_id });
    if (!stored_ticket) return answer('entry_result', { ticket_code, event_id, verdict: 'NOT_VALID' as const });
    if (stored_ticket.event_id !== event_id) return answer('entry_result', { ticket_code, event_id, verdict: 'WRONG_EVENT' as const });
    if (stored_ticket.ticket_status === 'USED') return answer('entry_result', { ticket_code, event_id, verdict: 'ALREADY_USED' as const });
    if (stored_ticket.ticket_status !== 'ISSUED') return answer('entry_result', { ticket_code, event_id, verdict: 'NOT_VALID' as const });
    return answer('entry_result', {
      ticket_code,
      event_id,
      verdict: 'ADMIT' as const,
      used_ticket: { ticket_code, ticket_status: 'USED' as const },
      ticket_used: { message_id: message(1), event_id, ticket_code, occurred_at: called_at },
    });
  },

  cancel_event: ({ event_id, caller, called_at, show, stored_tickets }) => {
    if (caller.caller_id !== show.organizer_id) return answer('forbidden', { caller_id: caller.caller_id });
    const live = stored_tickets.filter((t) => t.ticket_status === 'ISSUED' || t.ticket_status === 'TRANSFER_PENDING');
    return answer('cancelled_event', {
      event_id,
      cancelled_at: called_at,
      event_cancelled: { message_id: message(1), event_id, affected_tickets: live.map((t) => t.ticket_code), occurred_at: called_at },
      refunded_tickets: live.map((t) => ({ ticket_code: t.ticket_code, ticket_status: 'REFUNDED' as const })),
      tickets_refunded: live.map((t, i) => ({ message_id: message(i + 2), event_id, ticket_code: t.ticket_code, occurred_at: called_at })),
    });
  },
} satisfies DomainCore;
