// The Valibot schemas and the Postgres schema of one manifest, so tests/postgres.test.ts can
// give both the same values (Postgres plan, decision 12).
export default {
  plugins: ['valibot', ['postgres', { tables: ['value.entity.sample'] }]],
};
