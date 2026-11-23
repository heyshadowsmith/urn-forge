// The UTC times target with the Postgres extra, so the receipt is a table and precision is a CHECK.
export default {
  plugins: ['valibot', 'fcis', ['postgres', { tables: ['stock.entity.receipt', 'billing.entity.plan'] }]],
};
