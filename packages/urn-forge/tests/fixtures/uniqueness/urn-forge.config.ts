// The uniqueness target with the Postgres extra, so the subscription is a table with its indexes.
export default {
  plugins: ['valibot', 'fcis', ['postgres', { tables: ['subscription.entity.subscription'] }]],
};
