import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'urn-forge',
  description:
    'Write the contract of a domain in one YAML manifest: definitions, rules and operations. urn-forge generates Valibot schemas, types and a harness around your code. CI fails when the code, the scenarios or a change break the contract.',
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
      { text: 'Tutorial', link: '/tutorials/first-domain', activeMatch: '/tutorials/' },
      { text: 'Guides', link: '/how-to/rules-and-refusals', activeMatch: '/how-to/' },
      { text: 'Reference', link: '/reference/manifest', activeMatch: '/reference/' },
      { text: 'Why', link: '/explanation/why-urn-forge', activeMatch: '/explanation/' },
    ],
    sidebar: [
      {
        text: 'Start',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Tutorial: from init to a strict verify', link: '/tutorials/first-domain' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Write rules and refusals', link: '/how-to/rules-and-refusals' },
          { text: 'Write scenarios', link: '/how-to/write-scenarios' },
          { text: 'Call an operation', link: '/how-to/call-an-operation' },
          { text: 'Run verify in CI', link: '/how-to/run-verify-in-ci' },
          { text: 'Change the contract', link: '/how-to/change-the-contract' },
          { text: 'Store objects in Postgres', link: '/how-to/store-in-postgres' },
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
