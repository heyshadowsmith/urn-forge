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
      { text: 'Guide', link: '/guide/what-is-urn-forge', activeMatch: '/guide/' },
      { text: 'Reference', link: '/reference/cli', activeMatch: '/reference/' },
      { text: 'Project', link: '/project/mvp-plan', activeMatch: '/project/' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'What is urn-forge?', link: '/guide/what-is-urn-forge' },
          { text: 'First steps', link: '/guide/getting-started' },
          { text: 'The manifest', link: '/guide/manifest' },
          { text: 'Generated code', link: '/guide/generated-code' },
          { text: 'Gherkin steps', link: '/guide/gherkin-steps' },
          { text: 'Verification gates', link: '/guide/verify' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'CLI', link: '/reference/cli' },
          { text: 'Diagnostics', link: '/reference/diagnostics' },
          { text: 'MVP scope', link: '/reference/scope' },
        ],
      },
      {
        text: 'Project',
        items: [
          { text: 'MVP plan', link: '/project/mvp-plan' },
          { text: 'Spec v1.1', link: '/project/spec-v1-1' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/heyshadowsmith/urn-forge' }],
    search: { provider: 'local' },
    outline: [2, 3],
  },
});
