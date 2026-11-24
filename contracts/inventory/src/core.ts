// The core of the inventory contract. The shell loads the stored records that a call needs (stock
// levels, the reservation) into the input; the core answers the new state of the records it changes,
// and the events of the change, or a refusal. runOperation checks the input, the answer and the rules.
import { randomUUID } from 'node:crypto';
import {
  answer,
  type Caller,
  type DomainCore,
  type Forbidden,
  type Line,
  type ReservedLine,
  type StockEvent,
  type StockLevel,
  type UnknownLocation,
  type UnknownSku,
} from './generated/domain.generated';

// This core has no catalogue of SKUs and locations: a pair with no stored level is unknown. The
// warehouse ZZZ does not exist, so its locations are unknown; any other pair has an unknown SKU.
const UNKNOWN_WAREHOUSE = 'ZZZ-';
const DEFAULT_TTL_MINUTES = 30;

type Pair = { readonly sku: string; readonly location: string };
const samePair = (a: Pair, b: Pair): boolean => a.sku === b.sku && a.location === b.location;
const levelOf = (levels: readonly StockLevel[], pair: Pair): StockLevel | undefined => levels.find((l) => samePair(l, pair));

const withOnHandAndReserved = (level: StockLevel, on_hand: number, reserved: number): StockLevel => ({
  sku: level.sku,
  location: level.location,
  on_hand,
  reserved,
  available: on_hand - reserved,
});

const unknown = (pair: Pair) =>
  pair.location.startsWith(UNKNOWN_WAREHOUSE)
    ? answer('unknown_location', { error_code: 'UNKNOWN_LOCATION', error_message: `The location ${pair.location} is not known`, location: pair.location } satisfies UnknownLocation)
    : answer('unknown_sku', { error_code: 'UNKNOWN_SKU', error_message: `The SKU ${pair.sku} is not known`, sku: pair.sku } satisfies UnknownSku);

const forbidden = (caller: Caller) =>
  answer('forbidden', { error_code: 'FORBIDDEN', error_message: `A caller with the role ${caller.role} may not call this operation`, role: caller.role } satisfies Forbidden);

const event = (event_type: StockEvent['event_type'], level: StockLevel, quantity_changed: number, occurred_at: string, more: Partial<StockEvent> = {}): StockEvent => ({
  event_id: randomUUID(),
  event_type,
  sku: level.sku,
  location: level.location,
  quantity_changed,
  level,
  occurred_at,
  ...more,
});

const depletionsOf = (levels: readonly StockLevel[], occurred_at: string) =>
  levels.filter((l) => l.available === 0).map((l) => ({ event_id: randomUUID(), sku: l.sku, location: l.location, occurred_at }));

const addMinutes = (time: string, minutes: number): string => new Date(Date.parse(time) + minutes * 60_000).toISOString();

const held = (line: ReservedLine): number => line.quantity - line.shipped;

export const core = {
  get_stock: ({ sku, location, stored_level }) => (stored_level ? answer('stock_level', stored_level) : unknown({ sku, location })),

  receive_goods: ({ caller, now, purchase_order_id, receipt_lines, stored_levels }) => {
    if (caller.role !== 'warehouse_staff' && caller.role !== 'purchasing_system') return forbidden(caller);
    const missing = receipt_lines.find((l) => !levelOf(stored_levels, l));
    if (missing) return unknown(missing);
    // Each line adds to the level after the lines before it.
    const current = new Map(stored_levels.map((l) => [`${l.sku} ${l.location}`, l]));
    const levels = receipt_lines.map((line) => {
      const key = `${line.sku} ${line.location}`;
      const before = current.get(key)!;
      const after = withOnHandAndReserved(before, before.on_hand + line.quantity, before.reserved);
      current.set(key, after);
      return after;
    });
    const events = receipt_lines.map((line, i) => event('StockReceived', levels[i]!, line.quantity, now));
    return answer('receipt', { purchase_order_id, levels, events });
  },

  reserve_stock: ({ caller, now, order_id, reserve_lines, ttl_minutes, stored_levels, open_reservation }) => {
    if (caller.role !== 'order_system') return forbidden(caller);
    const missing = reserve_lines.find((l) => !levelOf(stored_levels, l));
    if (missing) return unknown(missing);
    if (open_reservation) {
      return answer('open_reservation_exists', { error_code: 'INVALID_REQUEST', error_message: `The order ${order_id} already has an open reservation`, order_id });
    }
    const short_lines = reserve_lines.flatMap((line) => {
      const level = levelOf(stored_levels, line)!;
      return line.quantity > level.available ? [{ sku: line.sku, location: line.location, requested: line.quantity, available: level.available }] : [];
    });
    if (short_lines.length > 0) {
      return answer('insufficient_stock', { error_code: 'INSUFFICIENT_STOCK', error_message: 'The stock cannot cover the request', short_lines });
    }
    const reservation_id = randomUUID();
    const levels = reserve_lines.map((line) => {
      const level = levelOf(stored_levels, line)!;
      return withOnHandAndReserved(level, level.on_hand, level.reserved + line.quantity);
    });
    return answer('reservation_made', {
      result: 'RESERVED' as const,
      reservation: {
        reservation_id,
        order_id,
        state: 'ACTIVE' as const,
        reservation_lines: reserve_lines.map((l) => ({ sku: l.sku, location: l.location, quantity: l.quantity, shipped: 0 })),
        expires_at: addMinutes(now, ttl_minutes ?? DEFAULT_TTL_MINUTES),
      },
      levels,
      events: reserve_lines.map((line, i) => event('StockReserved', levels[i]!, line.quantity, now, { reservation_id })),
      depletions: depletionsOf(levels, now),
    });
  },

  release_reservation: ({ caller, now, reservation_id, stored_reservation, stored_levels }) => {
    if (caller.role !== 'order_system') return forbidden(caller);
    if (!stored_reservation) return answer('reservation_not_found', { error_code: 'RESERVATION_NOT_FOUND', error_message: `No reservation ${reservation_id}`, reservation_id });
    const { state } = stored_reservation;
    if (state !== 'ACTIVE' && state !== 'PARTIALLY_SHIPPED') {
      return answer('invalid_state', { error_code: 'INVALID_STATE', error_message: `The reservation ${reservation_id} is ${state}`, reservation_id, state });
    }
    return answer('reservation_changed', giveBack(stored_reservation, stored_levels, 'RELEASED', 'ReservationReleased', now));
  },

  ship_reservation: ({ caller, now, reservation_id, ship_lines, stored_reservation, stored_levels }) => {
    if (caller.role !== 'order_system') return forbidden(caller);
    if (!stored_reservation) return answer('reservation_not_found', { error_code: 'RESERVATION_NOT_FOUND', error_message: `No reservation ${reservation_id}`, reservation_id });
    const { state } = stored_reservation;
    if (state !== 'ACTIVE' && state !== 'PARTIALLY_SHIPPED') {
      return answer('invalid_state', { error_code: 'INVALID_STATE', error_message: `The reservation ${reservation_id} is ${state}`, reservation_id, state });
    }
    const toShip = (line: ReservedLine): number => (ship_lines ? (ship_lines.find((x: Line) => samePair(x, line))?.quantity ?? 0) : held(line));
    const tooMuch = ship_lines?.find((x) => {
      const line = stored_reservation.reservation_lines.find((r) => samePair(r, x));
      return !line || x.quantity > held(line);
    });
    if (tooMuch) {
      return answer('invalid_request', {
        error_code: 'INVALID_REQUEST',
        error_message: `The reservation does not hold ${tooMuch.quantity} units of ${tooMuch.sku} at ${tooMuch.location}`,
      });
    }
    const reservation_lines = stored_reservation.reservation_lines.map((r) => ({ ...r, shipped: r.shipped + toShip(r) }));
    const allShipped = reservation_lines.every((r) => r.shipped === r.quantity);
    const shippedLines = stored_reservation.reservation_lines.filter((r) => toShip(r) > 0);
    const levels = shippedLines.map((r) => {
      const level = levelOf(stored_levels, r)!;
      return withOnHandAndReserved(level, level.on_hand - toShip(r), level.reserved - toShip(r));
    });
    return answer('reservation_changed', {
      reservation: { ...stored_reservation, state: allShipped ? ('SHIPPED' as const) : ('PARTIALLY_SHIPPED' as const), reservation_lines },
      levels,
      events: shippedLines.map((r, i) => event('StockShipped', levels[i]!, toShip(r), now, { reservation_id })),
    });
  },

  expire_reservation: ({ caller, now, reservation_id, stored_reservation, stored_levels }) => {
    if (caller.role !== 'clock') return forbidden(caller);
    if (!stored_reservation) return answer('reservation_not_found', { error_code: 'RESERVATION_NOT_FOUND', error_message: `No reservation ${reservation_id}`, reservation_id });
    const { state } = stored_reservation;
    if (state !== 'ACTIVE') {
      return answer('invalid_state', { error_code: 'INVALID_STATE', error_message: `The reservation ${reservation_id} is ${state}`, reservation_id, state });
    }
    if (Date.parse(now) < Date.parse(stored_reservation.expires_at)) {
      return answer('invalid_request', { error_code: 'INVALID_REQUEST', error_message: `The reservation ${reservation_id} expires at ${stored_reservation.expires_at}` });
    }
    return answer('reservation_changed', giveBack(stored_reservation, stored_levels, 'EXPIRED', 'ReservationExpired', now));
  },

  adjust_stock: ({ caller, now, sku, location, delta, reason, stored_level }) => {
    if (caller.role !== 'warehouse_supervisor') return forbidden(caller);
    if (!stored_level) return unknown({ sku, location });
    if (stored_level.on_hand + delta < stored_level.reserved) {
      return answer('insufficient_stock', {
        error_code: 'INSUFFICIENT_STOCK',
        error_message: 'The stock cannot cover the request',
        short_lines: [{ sku, location, requested: -delta, available: stored_level.available }],
      });
    }
    const level = withOnHandAndReserved(stored_level, stored_level.on_hand + delta, stored_level.reserved);
    return answer('adjustment_made', {
      level,
      events: [event('StockAdjusted', level, delta, now, { reason })],
      depletions: depletionsOf([level], now),
    });
  },
} satisfies DomainCore;

/** Release or expire: the reservation takes the new state, and each line gives back the units it still holds. */
function giveBack(
  reservation: NonNullable<Parameters<DomainCore['release_reservation']>[0]['stored_reservation']>,
  stored_levels: readonly StockLevel[],
  state: 'RELEASED' | 'EXPIRED',
  event_type: 'ReservationReleased' | 'ReservationExpired',
  now: string,
) {
  const lines = reservation.reservation_lines.filter((r) => held(r) > 0);
  const levels = lines.map((r) => {
    const level = levelOf(stored_levels, r)!;
    return withOnHandAndReserved(level, level.on_hand, level.reserved - held(r));
  });
  return {
    reservation: { ...reservation, state },
    levels,
    events: lines.map((r, i) => event(event_type, levels[i]!, held(r), now, { reservation_id: reservation.reservation_id })),
  };
}
