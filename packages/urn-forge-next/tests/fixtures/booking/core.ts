// The core of the booking fixture: a confirmed booking is seated; any other is refused.
import { answer, type DomainCore } from './generated/domain.generated.js';

export const core = {
  seat_booking: ({ reference, stored_booking }) =>
    stored_booking.state === 'confirmed'
      ? answer('booking', { ...stored_booking, state: 'seated' })
      : answer('invalid_state', { reference, state: stored_booking.state }),
} satisfies DomainCore;
