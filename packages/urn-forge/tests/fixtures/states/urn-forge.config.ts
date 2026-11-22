// The states target with its table, so the store file has replaceBookingBookingFrom.
export default {
  plugins: ['valibot', 'fcis', ['postgres', { tables: ['booking.entity.booking'] }]],
};
