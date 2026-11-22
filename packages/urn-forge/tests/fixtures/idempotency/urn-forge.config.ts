// The idempotency target with the Postgres extra, so the store file has the answers and runOnce.
export default {
  plugins: ['valibot', 'fcis', ['postgres', {}]],
};
