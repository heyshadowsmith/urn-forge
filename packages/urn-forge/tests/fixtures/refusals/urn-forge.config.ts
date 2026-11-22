// The refusals target with the Postgres extra, so the store file has the table of the bookings and commit.
export default {
  plugins: ['valibot', 'fcis', ['postgres', { tables: ['booking.entity.booking'] }]],
};
