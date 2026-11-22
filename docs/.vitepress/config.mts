import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'urn-forge',
  description:
    'Write a domain in YAML. urn-forge generates typed contracts and a runtime gatekeeper. CI fails if the chain from a URN to a scenario breaks.',
  cleanUrls: true,
  appearance: 'dark',
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#070a08' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap',
      },
    ],
  ],
  themeConfig: {
    logo: { light: '/logo-light.svg', dark: '/logo-dark.svg', alt: '' },
    nav: [
      { text: 'Tutorials', link: '/tutorials/', activeMatch: '/tutorials/' },
      { text: 'How-to guides', link: '/how-to/', activeMatch: '/how-to/' },
      { text: 'Reference', link: '/reference/', activeMatch: '/reference/' },
      { text: 'Explanation', link: '/explanation/', activeMatch: '/explanation/' },
    ],
    sidebar: [
      {
        text: 'Tutorials',
        link: '/tutorials/',
        items: [
          { text: 'Build the shipping domain', link: '/tutorials/first-domain' },
          { text: 'Add a declared error', link: '/tutorials/declared-errors' },
          { text: 'Make the domain strict', link: '/tutorials/strict-coverage' },
        ],
      },
      {
        text: 'How-to guides',
        link: '/how-to/',
        items: [
          { text: 'Install urn-forge', link: '/how-to/install' },
          { text: 'Set up a project', link: '/how-to/set-up-a-project' },
          { text: 'Add a field', link: '/how-to/add-a-field' },
          { text: 'Add an entity', link: '/how-to/add-an-entity' },
          { text: 'Add an invariant', link: '/how-to/add-an-invariant' },
          { text: 'Add an operation', link: '/how-to/add-an-operation' },
          { text: 'Declare an error', link: '/how-to/declare-an-error' },
          { text: 'Write scenarios', link: '/how-to/write-scenarios' },
          { text: 'Call an operation', link: '/how-to/call-an-operation' },
          { text: 'Use branded values', link: '/how-to/use-branded-values' },
          { text: 'Fix a failing gate', link: '/how-to/fix-a-failing-gate' },
          { text: 'Regenerate code', link: '/how-to/regenerate-code' },
          { text: 'Run verify in CI', link: '/how-to/run-verify-in-ci' },
        ],
      },
      {
        text: 'Extras',
        collapsed: false,
        items: [
          { text: 'Change the contract', link: '/how-to/change-the-contract' },
          { text: 'Declare states and moves', link: '/how-to/declare-states' },
          { text: 'Declare preconditions and postconditions', link: '/how-to/declare-conditions' },
          { text: 'Declare who may call', link: '/how-to/declare-callers' },
          { text: 'Run changes on a clock', link: '/how-to/run-changes-on-a-clock' },
          { text: 'Make a call safe to repeat', link: '/how-to/make-a-call-safe-to-repeat' },
          { text: 'Declare what a refusal carries', link: '/how-to/declare-refusals' },
          { text: 'Emit an event', link: '/how-to/emit-an-event' },
          { text: 'Store entities in Postgres', link: '/how-to/store-in-postgres' },
          { text: 'Close boundary gaps', link: '/how-to/close-boundary-gaps' },
        ],
      },
      {
        text: 'Reference',
        link: '/reference/',
        items: [
          { text: 'The manifest', link: '/reference/manifest' },
          { text: 'The rule language', link: '/reference/rule-language' },
          { text: 'Primitives and constraints', link: '/reference/primitives' },
          { text: 'The CLI', link: '/reference/cli' },
          { text: 'The configuration file', link: '/reference/configuration' },
          { text: 'Diagnostics', link: '/reference/diagnostics' },
          { text: 'Verification gates', link: '/reference/verification-gates' },
          { text: 'Gherkin steps', link: '/reference/gherkin-steps' },
          { text: 'The generated code', link: '/reference/generated-code' },
          { text: 'The Postgres schema', link: '/reference/postgres-schema' },
          { text: 'The package API', link: '/reference/public-api' },
          { text: 'Glossary', link: '/reference/glossary' },
        ],
      },
      {
        text: 'Explanation',
        link: '/explanation/',
        items: [
          { text: 'The contract', link: '/explanation/the-contract' },
          { text: 'The core and the shell', link: '/explanation/core-and-shell' },
          { text: 'How urn-forge proves it', link: '/explanation/how-urn-forge-proves-it' },
          { text: 'Compatibility', link: '/explanation/compatibility' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/heyshadowsmith/urn-forge' }],
    search: { provider: 'local' },
    outline: [2, 3],
  },
});
