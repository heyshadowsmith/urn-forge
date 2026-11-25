import { defineConfig } from 'vitepress';
import { darkTheme, lightTheme } from './shiki-themes';

export default defineConfig({
  title: 'urn-forge',
  description:
    'Coding agents write the code. You own the contract. urn-forge checks each input and each answer of the code against the rules of a domain, and fails CI when the code, the tests or a change break a rule.',
  cleanUrls: true,
  markdown: {
    theme: { light: lightTheme, dark: darkTheme },
    // In plain-text blocks (the output of verify), color PASS and FAIL like a CI log.
    codeTransformers: [
      {
        name: 'urn-forge-gate-status',
        // Code is not prose: keep browser translation out of it.
        pre(node) {
          node.properties.translate = 'no';
        },
        postprocess(html) {
          if (!['txt', 'text', 'plaintext', ''].includes(this.options.lang ?? '')) return;
          return html.replace(/\b(PASS|FAIL)\b/g, (word) =>
            `<span class="uf-${word.toLowerCase()}">${word}</span>`,
          );
        },
      },
    ],
  },
  // Follow the reader's system setting; the toggle still works.
  appearance: true,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['meta', { name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#fbfbf8' }],
    ['meta', { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#0f1210' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,500;6..72,600&display=swap',
      },
    ],
  ],
  themeConfig: {
    logo: { light: '/logo-light.svg', dark: '/logo-dark.svg', alt: '' },
    nav: [
      { text: 'Tutorial', link: '/tutorials/first-domain', activeMatch: '/tutorials/' },
      { text: 'Guides', link: '/how-to/work-with-a-coding-agent', activeMatch: '/how-to/' },
      { text: 'Reference', link: '/reference/manifest', activeMatch: '/reference/' },
      { text: 'Why', link: '/explanation/why-urn-forge', activeMatch: '/explanation/' },
    ],
    sidebar: [
      {
        text: 'Start',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Tutorial: build a domain with a coding agent', link: '/tutorials/first-domain' },
        ],
      },
      {
        text: 'Your work',
        items: [
          { text: 'Set up a project for an agent', link: '/how-to/work-with-a-coding-agent' },
          { text: "Review an agent's change", link: '/how-to/review-an-agents-change' },
          { text: 'Run the gates in CI', link: '/how-to/run-verify-in-ci' },
          { text: 'Change the contract', link: '/how-to/change-the-contract' },
        ],
      },
      {
        text: 'The parts of a domain',
        items: [
          { text: 'Rules and refusals', link: '/how-to/rules-and-refusals' },
          { text: 'Scenarios', link: '/how-to/write-scenarios' },
          { text: 'Calls to an operation', link: '/how-to/call-an-operation' },
          { text: 'Objects in Postgres', link: '/how-to/store-in-postgres' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'The manifest and its rules', link: '/reference/manifest' },
          { text: 'The CLI, the config and diagnostics', link: '/reference/cli' },
        ],
      },
      {
        text: 'Explanation',
        items: [{ text: 'Why urn-forge works this way', link: '/explanation/why-urn-forge' }],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/heyshadowsmith/urn-forge' }],
    search: { provider: 'local' },
    outline: [2, 3],
  },
});
