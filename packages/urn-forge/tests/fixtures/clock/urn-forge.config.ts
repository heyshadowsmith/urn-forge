// The clock target with its tables, so the store file has the queries of the timed changes.
export default {
  plugins: ['valibot', 'fcis', ['postgres', { tables: ['payment.entity.payment', 'claim.entity.claim'] }]],
};
