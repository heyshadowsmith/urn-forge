import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'urn-forge',
  description:
    'Write the contract of a domain in YAML: definitions, rules and operations. urn-forge makes a checked TypeScript harness, and CI fails when the core, the scenarios or a change break the contract.',
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
          { text: 'Add a refusal', link: '/tutorials/declared-errors' },
          { text: 'Make the domain strict', link: '/tutorials/strict-coverage' },
        ],
      },
      {
        text: 'How-to guides',
        link: '/how-to/',
        items: [
          { text: 'Install urn-forge', link: '/how-to/install' },
          { text: 'Set up a project', link: '/how-to/set-up-a-project' },
          { text: 'Add a definition', link: '/how-to/add-a-definition' },
          { text: 'Add an object or a list', link: '/how-to/add-an-object-or-a-list' },
          { text: 'Add a rule', link: '/how-to/add-a-rule' },
          { text: 'Add an operation', link: '/how-to/add-an-operation' },
          { text: 'Declare a refusal', link: '/how-to/declare-a-refusal' },
          { text: 'Model a stored record, the caller and the time', link: '/how-to/model-the-input' },
          { text: 'Write scenarios', link: '/how-to/write-scenarios' },
          { text: 'Call an operation', link: '/how-to/call-an-operation' },
          { text: 'Regenerate code', link: '/how-to/regenerate-code' },
          { text: 'Fix a failing gate', link: '/how-to/fix-a-failing-gate' },
          { text: 'Run verify in CI', link: '/how-to/run-verify-in-ci' },
          { text: 'Change the contract', link: '/how-to/change-the-contract' },
          { text: 'Store objects in Postgres', link: '/how-to/store-in-postgres' },
        ],
      },
      {
        text: 'Reference',
        link: '/reference/',
        items: [
          { text: 'The manifest', link: '/reference/manifest' },
          { text: 'Definitions and types', link: '/reference/definitions' },
          { text: 'Rules and the standard rules', link: '/reference/rules' },
          { text: 'The rule language', link: '/reference/rule-language' },
          { text: 'Operations and outputs', link: '/reference/operations' },
          { text: 'The generated code', link: '/reference/generated-code' },
          { text: 'Gherkin steps', link: '/reference/gherkin-steps' },
          { text: 'Verification gates', link: '/reference/verification-gates' },
          { text: 'Diff and versions', link: '/reference/diff' },
          { text: 'The Postgres schema', link: '/reference/postgres-schema' },
          { text: 'The configuration file', link: '/reference/configuration' },
          { text: 'The CLI', link: '/reference/cli' },
          { text: 'Diagnostics', link: '/reference/diagnostics' },
          { text: 'The package API', link: '/reference/public-api' },
          { text: 'Glossary', link: '/reference/glossary' },
        ],
      },
      {
        text: 'Explanation',
        link: '/explanation/',
        items: [
          { text: 'The contract', link: '/explanation/the-contract' },
          { text: 'General constructs only', link: '/explanation/general-constructs' },
          { text: "JSON Schema's words and CEL", link: '/explanation/json-schema-and-cel' },
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
