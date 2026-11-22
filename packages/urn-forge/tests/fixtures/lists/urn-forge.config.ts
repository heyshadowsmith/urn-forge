// The lists target with two tables: a claim (a sum that SQL cannot check) and a reservation
// request (a UNIQUE over two columns of its child table).
export default {
  plugins: ['valibot', 'fcis', ['postgres', { tables: ['claim.entity.claim', 'reservation.entity.request'] }]],
};
