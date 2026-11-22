// The lists target with the reservation table: a UNIQUE over two columns of its child table.
export default {
  plugins: ['valibot', 'fcis', ['postgres', { tables: ['reservation.entity.request'] }]],
};
