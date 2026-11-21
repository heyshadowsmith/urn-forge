// The stock entity is a Postgres table, so its values have the Stored use.
export default { plugins: ['valibot', 'fcis', ['postgres', { tables: ['order.entity.stock'] }]] };
