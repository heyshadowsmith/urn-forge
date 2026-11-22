// The Valibot schemas and the Postgres schema of one manifest, so tests/postgres.test.ts can
// give both the same values.
export default {
  plugins: ['valibot', ['postgres', { tables: ['value.entity.sample'] }]],
};
