import { emit, fail, ok, type DomainCoreImplementation } from './generated/domain.runtime.generated';

// Every SKU at every location starts with this stock.
const ON_HAND = 500;
const RESERVED = 100;
const AVAILABLE = ON_HAND - RESERVED;
// Every known reservation holds this many units on each of its lines.
const RESERVED_PER_LINE = 10;

const NOW = '2026-11-22T10:00:00.000Z';
const EVENT_ID = '7d3f1c2a-5b4e-4a6d-9c8b-1e2f3a4b5c6d';
const UNKNOWN_SKU = 'NO-SUCH-SKU';
const UNKNOWN_LOCATION = 'ZZZ-Z-9999';
const CONFLICTING_KEY = 'conflict-key';
const NEW_RESERVATION = 'c0ffee00-1234-4abc-8def-0123456789ab';
const DEFAULT_TTL_MINUTES = 30;

const event = { event_id: EVENT_ID, sequence: 1, occurred_at: NOW };

function unknown(lines: readonly { sku: string; location: string }[]) {
  const sku = lines.find((line) => line.sku === UNKNOWN_SKU);
  if (sku) return fail('urn:corpus:inventory:stock:error:unknown_sku', { sku: sku.sku });
  const location = lines.find((line) => line.location === UNKNOWN_LOCATION);
  if (location) return fail('urn:corpus:inventory:stock:error:unknown_location', { location: location.location });
  return undefined;
}

const conflict = (idempotency_key: string) =>
  idempotency_key === CONFLICTING_KEY
    ? fail('urn:corpus:inventory:request:error:idempotency_conflict', { idempotency_key })
    : undefined;

const RESERVED_LINE = { sku: 'WIDGET-1', location: 'AMS-B-0142', quantity: RESERVED_PER_LINE };

export const core = {
  'urn:corpus:inventory:stock:operation:get_stock': ({ sku, location }) =>
    unknown([{ sku, location }]) ??
    ok({ sku, location, on_hand: ON_HAND, reserved: RESERVED, available: AVAILABLE }),

  'urn:corpus:inventory:receipt:operation:receive_goods': ({ idempotency_key, purchase_order_id, lines }) => {
    const refused = conflict(idempotency_key) ?? unknown(lines);
    if (refused) return refused;
    const levels = lines.map(({ sku, location, quantity }) => ({
      sku,
      location,
      on_hand: ON_HAND + quantity,
      reserved: RESERVED,
      available: AVAILABLE + quantity,
    }));
    return ok(
      { purchase_order_id, lines: levels },
      levels.map((level, i) =>
        emit('urn:corpus:inventory:stock:event:stock_received', { ...event, quantity_changed: lines[i].quantity, level }),
      ),
    );
  },

  'urn:corpus:inventory:reservation:operation:reserve_stock': ({ idempotency_key, order_id, lines, ttl_minutes }) => {
    const refused = conflict(idempotency_key) ?? unknown(lines);
    if (refused) return refused;
    const short = lines.filter((line) => line.quantity > AVAILABLE);
    if (short.length > 0) {
      return fail('urn:corpus:inventory:stock:error:insufficient_stock', {
        short_lines: short.map(({ sku, location, quantity }) => ({ sku, location, requested: quantity, available: AVAILABLE })),
      });
    }
    const events = lines.flatMap(({ sku, location, quantity }) => {
      const level = { sku, location, on_hand: ON_HAND, reserved: RESERVED + quantity, available: AVAILABLE - quantity };
      const reserved = emit('urn:corpus:inventory:reservation:event:stock_reserved', {
        ...event,
        reservation_id: NEW_RESERVATION,
        quantity_changed: quantity,
        level,
      });
      return level.available === 0
        ? [reserved, emit('urn:corpus:inventory:stock:event:stock_depleted', { ...event, sku, location })]
        : [reserved];
    });
    const expires = new Date(Date.parse(NOW) + (ttl_minutes ?? DEFAULT_TTL_MINUTES) * 60_000).toISOString();
    return ok(
      {
        result: 'RESERVED' as const,
        reservation_id: NEW_RESERVATION,
        order_id,
        state: 'ACTIVE' as const,
        lines: lines.map(({ sku, location, quantity }) => ({ sku, location, quantity })),
        expires_at: expires,
      },
      events,
    );
  },

  'urn:corpus:inventory:reservation:operation:release_reservation': ({ idempotency_key, reservation_id }) => {
    const refused = conflict(idempotency_key);
    if (refused) return refused;
    const { sku, location, quantity } = RESERVED_LINE;
    return ok({ reservation_id, state: 'RELEASED' as const }, [
      emit('urn:corpus:inventory:reservation:event:reservation_released', {
        ...event,
        reservation_id,
        quantity_changed: quantity,
        level: { sku, location, on_hand: ON_HAND, reserved: RESERVED - quantity, available: AVAILABLE + quantity },
      }),
    ]);
  },

  'urn:corpus:inventory:reservation:operation:ship_reservation': ({ idempotency_key, reservation_id, lines }) => {
    const refused = conflict(idempotency_key);
    if (refused) return refused;
    const shipped = lines ?? [RESERVED_LINE];
    const over = shipped.find((line) => line.quantity > RESERVED_PER_LINE);
    if (over) {
      return fail('urn:corpus:inventory:request:error:invalid_request', {
        detail: `${over.quantity} is more than the ${RESERVED_PER_LINE} units still reserved on ${over.sku} at ${over.location}`,
      });
    }
    const whole = shipped.every((line) => line.quantity === RESERVED_PER_LINE);
    return ok(
      { reservation_id, state: whole ? ('SHIPPED' as const) : ('PARTIALLY_SHIPPED' as const) },
      shipped.map(({ sku, location, quantity }) =>
        emit('urn:corpus:inventory:reservation:event:stock_shipped', {
          ...event,
          reservation_id,
          quantity_changed: -quantity,
          level: { sku, location, on_hand: ON_HAND - quantity, reserved: RESERVED - quantity, available: AVAILABLE },
        }),
      ),
    );
  },

  'urn:corpus:inventory:adjustment:operation:adjust_stock': ({ idempotency_key, sku, location, delta, reason }) => {
    const refused = conflict(idempotency_key) ?? unknown([{ sku, location }]);
    if (refused) return refused;
    const on_hand = ON_HAND + delta;
    if (on_hand < RESERVED) {
      return fail('urn:corpus:inventory:stock:error:insufficient_stock', {
        short_lines: [{ sku, location, requested: -delta, available: AVAILABLE }],
      });
    }
    const level = { sku, location, on_hand, reserved: RESERVED, available: on_hand - RESERVED };
    const adjusted = emit('urn:corpus:inventory:adjustment:event:stock_adjusted', {
      ...event,
      quantity_changed: delta,
      reason,
      level,
    });
    return ok(
      level,
      level.available === 0 ? [adjusted, emit('urn:corpus:inventory:stock:event:stock_depleted', { ...event, sku, location })] : [adjusted],
    );
  },
} satisfies DomainCoreImplementation;
