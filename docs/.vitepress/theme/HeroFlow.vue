<script setup lang="ts">
// The home hero's visual: the three steps of urn-forge, as numbered clauses,
// and the moment they exist for: the agent weakens the contract, and CI stops it.
// It is a real list, so it reads as text.
const steps = [
  { n: '01', label: 'Contract', file: 'domain.manifest.yaml', note: 'The agent writes it. You review it.' },
  { n: '02', label: 'Generate', file: 'domain.generated.ts', note: 'Types, and a harness that checks each answer.' },
  { n: '03', label: 'Verify', file: 'urn-forge verify', note: 'Five gates fail CI when a rule breaks.' },
];
</script>

<template>
  <figure class="hf">
    <figcaption class="hf-cap">How urn-forge works</figcaption>
    <ol class="hf-steps">
      <li v-for="s in steps" :key="s.n" class="hf-step">
        <span class="hf-n" aria-hidden="true">{{ s.n }}</span>
        <div class="hf-body">
          <strong>{{ s.label }}</strong>
          <code translate="no">{{ s.file }}</code>
          <p>{{ s.note }}</p>
        </div>
      </li>
    </ol>
    <div class="hf-status">
      <p class="hf-line"><code translate="no">gate 5  contract</code><span class="hf-fail">FAIL</span></p>
      <p class="hf-why">The agent removed a rule. Only a person decides a new version.</p>
    </div>
  </figure>
</template>

<style scoped>
.hf {
  position: relative;
  z-index: 1;
  margin: 0;
  width: 100%;
  border: 1px solid var(--vp-c-border);
  border-radius: 10px;
  background: var(--vp-c-bg-elv);
  box-shadow: var(--uf-shadow-panel);
  text-align: left;
  font-family: var(--vp-font-family-base);
}
.hf-cap {
  padding: 14px 24px;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}
.hf-steps {
  margin: 0;
  padding: 8px 24px;
  list-style: none;
}
.hf-step {
  position: relative;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 16px;
  padding: 18px 0;
}
/* The rule that joins one step to the next. */
.hf-step:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 15px;
  top: 52px;
  bottom: -14px;
  width: 1px;
  background: var(--vp-c-border);
}
.hf-n {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
}
.hf-body strong {
  display: block;
  font-family: var(--uf-display);
  font-size: 22px;
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--vp-c-text-1);
}
.hf-body code {
  display: inline-block;
  margin-top: 6px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--vp-code-bg);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  color: var(--vp-c-text-1);
}
.hf-body p {
  margin: 6px 0 0;
  text-wrap: pretty;
  font-size: 14.5px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}
.hf-status {
  padding: 14px 24px 16px;
  border-top: 1px solid var(--vp-c-divider);
  border-radius: 0 0 10px 10px;
  background: var(--vp-c-bg-alt);
}
.hf-line {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
}
.hf-line code {
  font-family: inherit;
  white-space: pre;
  color: var(--vp-c-text-1);
}
.hf-fail {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--uf-fail-soft);
  color: var(--uf-fail);
  font-weight: 700;
  letter-spacing: 0.04em;
}
.hf-why {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
  text-wrap: pretty;
}
@media (max-width: 639px) {
  .hf-cap,
  .hf-steps,
  .hf-status {
    padding-inline: 18px;
  }
  .hf-step {
    padding: 14px 0;
  }
  .hf-step:not(:last-child)::after {
    top: 48px;
    bottom: -10px;
  }
  .hf-body strong {
    font-size: 20px;
  }
}
</style>
