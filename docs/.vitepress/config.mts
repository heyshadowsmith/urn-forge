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
    nav: [{ text: 'Methodology', link: '/methodology' }],
    socialLinks: [{ icon: 'github', link: 'https://github.com/heyshadowsmith/urn-forge' }],
    search: { provider: 'local' },
    outline: [2, 3],
  },
});
