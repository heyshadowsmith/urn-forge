// The delivery target with the payment table, so the store file has the outbox.
export default {
  plugins: ['valibot', 'fcis', ['postgres', { tables: ['payment.entity.payment'] }]],
};
