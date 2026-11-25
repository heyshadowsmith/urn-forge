# urn-forge design system: MASTER

The source of truth for the look of the documentation site (`docs/`, VitePress).
A file in `pages/` overrides this one for its page. The tokens live in
`docs/.vitepress/theme/custom.css`. Change a token there, not in a component.

Generated with the ui-ux-pro-max skill ("developer tool documentation", Swiss
minimal, variance 3, motion 2, density 5). Its palette, navy with run green and
dark only, was replaced. The reasons are below.

## Product and reader

- **Reader:** a developer who already codes with a coding agent. They read
  YAML, TypeScript and terminal output all day.
- **Job of the site:** they understand the mechanism (contract → generate →
  verify) and try it in their own project.
- **Feel:** precise, calm, trustworthy. A serious engineering tool, not a
  marketing page. The site earns trust with exact examples, not with effects.

## Principles

1. **The content is the design.** Code, contracts and terminal output carry
   the story. Chrome stays quiet so they read first.
2. **One signal color, and it means something.** Green is the brand and the
   PASS state. Red is used only for FAIL and danger. No decorative color.
3. **The gate line is the signature.** `PASS` and `FAIL` in the terminal
   output are colored like a CI log. It is the one place the site is vivid.
4. **Nothing moves without a reason.** No blink, glow, scanlines or floating
   cards.
5. **Readable at the smallest size.** Code and table text are never below
   13px, and every text pair is AA (4.5:1) in both themes.

## Color

Semantic tokens map onto VitePress variables. The values were checked for
contrast against their background.

| Role | Light | Dark | VitePress variable |
| --- | --- | --- | --- |
| Page background | `#fbfbf8` | `#0f1210` | `--vp-c-bg` |
| Alternate surface (sidebar, code) | `#f4f4ef` | `#0b0d0c` | `--vp-c-bg-alt` |
| Soft surface (cards, table head) | `#eeeee7` | `#161a17` | `--vp-c-bg-soft` |
| Raised surface | `#ffffff` | `#141815` | `--vp-c-bg-elv` |
| Divider | `#e2e2da` | `#232924` | `--vp-c-divider` |
| Border | `#d3d3c9` | `#2e352f` | `--vp-c-border` |
| Text 1 (body) | `#1b1f1c` (16:1) | `#e7ebe7` (15.6:1) | `--vp-c-text-1` |
| Text 2 (secondary) | `#4b524c` (7.8:1) | `#a9b2aa` (8.6:1) | `--vp-c-text-2` |
| Text 3 (tertiary) | `#646c65` (5.2:1) | `#838d84` (5.5:1) | `--vp-c-text-3` |
| Brand (links, PASS) | `#0b6b35` (6.4:1) | `#5ad48a` (10:1) | `--vp-c-brand-1` |
| Brand hover | `#08572b` | `#7fe0a5` | `--vp-c-brand-2` |
| Brand soft (tints) | `rgb(11 107 53 / 0.09)` | `rgb(90 212 138 / 0.12)` | `--vp-c-brand-soft` |
| Button text on brand | `#ffffff` | `#06240f` | `--vp-button-brand-text` |
| Fail / danger | `#b42318` (6.3:1) | `#f2837a` (7.4:1) | `--uf-fail` |
| Warning | `#8a5a00` | `#e3b341` | `--vp-c-warning-1` |

The contrast ratios are against the page background.

- The theme follows the reader's system setting (`appearance: true`), with a
  toggle. Both themes are first-class and are tested separately.
- The ui-ux-pro-max anti-pattern "light mode default" was rejected. Docs are
  read for long sessions in either mode. We follow the system setting.

## Typography

| Role | Font | Size / line height | Weight |
| --- | --- | --- | --- |
| Body | IBM Plex Sans | 17px / 1.7, max 66ch (~75–80 characters) | 400 |
| Lead (hero tagline, intros) | IBM Plex Sans | 18–20px / 1.55 | 400 |
| Display (hero headline) | Newsreader | 44–56px / 1.1 | 500 |
| H1 | Newsreader | 36px / 1.2 | 500 |
| H2 | Newsreader | 28px / 1.25, top rule | 500 |
| H3 | IBM Plex Sans | 19px / 1.4 | 600 |
| Label (sidebar group, table head, pair label) | IBM Plex Sans | 13–15px | 600 |
| Inline code | IBM Plex Mono | 0.875em | 400 |
| Code block | IBM Plex Mono | 14px / 1.65 (13px min. in narrow pairs) | 400 |
| Table | IBM Plex Sans | 14.5px / 1.55; head 13px | 400 / 600 |

- Newsreader, an editorial serif, is used for the headlines only: the site is
  about a document a person signs off. Sans is for prose, and Mono is for
  anything a machine reads. Chakra Petch (sci-fi display) was removed. See
  PLAN.md.
- Headings use `text-wrap: balance`, prose uses `text-wrap: pretty`.
- Mono is only for code, files, commands and terminal output, never as a
  "technical" costume on labels. There is no eyebrow above a heading.
- Fonts load from Google Fonts with `display=swap`.

## Space, shape, elevation

- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 64, 96. Sections on the home
  page are 64–96px apart. Pairs inside a section are 24px apart.
- Radius: 6px for code blocks, inline badges and buttons; 10px for cards and
  the hero panel. No pill buttons.
- Elevation: a 1px border is the default. Only the hero panel gets a shadow,
  `0 1px 2px` + `0 12px 32px -16px` at low opacity. No colored glows.

## Components

- **Buttons:** the primary is brand-filled. The secondary has a border and a
  text-1 label. Each screen has one primary button.
- **Code blocks:** a 1px border, the alt surface and a copy button. No
  language label (it covered long first lines). Syntax colors come from
  `docs/.vitepress/shiki-themes.ts`: ink keywords, umber strings, teal
  constants, gray comments, and never red. Terminal output on the home page
  wraps, each line with a hanging indent, so no line is cut off.
- **Gate lines:** in terminal output, `PASS` is brand-colored and `FAIL` is
  fail-colored and bold. A Shiki transformer adds the classes `uf-pass` and
  `uf-fail`. The color always comes with the word, never alone.
- **Pairs (home):** plain English beside the code, under a 15px Sans label.
  They stack below 768px.
- **Tables (reference):** a Sans head on the soft surface, top-aligned cells, row
  dividers, a first column in `code` that does not wrap, and horizontal scroll
  inside the table, never on the page.
- **Custom blocks:** tip = brand tint, warning = amber tint, danger = fail
  tint. Each has a title. No side stripe.
- **Hero panel (HeroFlow):** three numbered steps joined by a rule, and a
  footer that shows the moment the product exists for: `gate 5 contract FAIL`,
  "The agent removed a rule. Only a person decides a new version." The
  product name is not repeated above the headline; it is in the nav.

## Motion

- Hover and color transitions take 150ms ease-out.
- The home hero fades in once (opacity + 8px, 400ms). There is no other
  entrance motion.
- `prefers-reduced-motion: reduce` turns all of it off.

## Accessibility

- Text pairs are AA in both themes (see the table above). The focus ring is
  2px brand with a 2px offset, and it is never removed.
- Color never carries meaning alone: PASS and FAIL are words.
- Diagrams that are pictures have a text alternative. The hero panel is a
  real list, so screen readers read it as text.
- No horizontal scroll on the page at 390px. Wide code and tables scroll
  inside themselves.

## Anti-patterns (do not bring back)

- Neon on near-black, glows, scanlines, grids, the blinking cursor, HUD
  corner brackets, gradient text in the hero name.
- Fake window chrome (traffic-light dots).
- Decorative `//` before headings.
- Emoji as icons.
- Text below 12px, or gray-on-gray below 4.5:1.

## Breakpoints

The VitePress breakpoints: 640, 768, 960, 1280px. Test every page at 390px and
1440px, in light and dark.
