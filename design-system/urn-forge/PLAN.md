# Design plan: "The signed contract"

This plan works within `MASTER.md`. It says how the site applies the system,
page by page.

## The idea

urn-forge is about one document that a person reviews and signs off, and a
machine that holds code to it. The site looks like that document: an editorial
serif for the headlines, as on a contract; plain Plex Sans for the clauses; Plex
Mono for everything a machine reads. Around it, the chrome is quiet paper (light)
or quiet slate (dark).

**What a reader remembers:** the CI log. Wherever `verify` output appears,
`PASS` is green and `FAIL` is red and bold, like a real CI run. The rest of the
page is calm, so those words stand out.

## Typography change to MASTER

- Display: **Newsreader** (Google Fonts, 500/600) for the hero headline, H1 and
  H2. It is an editorial serif that reads as "document", not "startup".
- H3 and below, the nav and the sidebar stay in IBM Plex Sans, so the long
  how-to pages stay easy to scan.

## Theme-wide (all pages)

1. Replace the phosphor tokens in `custom.css` with the MASTER palette, in
   light and dark. Remove the neon, the grid, the scanlines, the blinking cursor,
   the glows, the corner brackets and the `//` before headings.
2. `appearance: true` (follow the system), with a `theme-color` for each mode.
   Fonts: Newsreader, IBM Plex Sans, IBM Plex Mono. Chakra Petch is removed.
3. A Shiki transformer in `config.mts` marks `PASS` / `FAIL` in plain-text
   blocks (`uf-pass`, `uf-fail`).
4. Code blocks: a 1px border, 6px radius, 14px. Inline code: a quiet neutral
   tint, not green, so links stay the only green text in prose.
5. A 2px brand focus ring with an offset, everywhere.
6. Tables: a mono uppercase head, row dividers, a first column of code that
   does not wrap, and 14.5px text.
7. Custom blocks (tip, warning, danger) with a tint of their role color and
   their title. No side stripe.

## Home

- **Hero:** the headline "A contract your coding agent can't get around." in
  Newsreader, about 48–56px on desktop. No eyebrow: the product name is in the
  nav. Left-aligned on phones too. The tagline is in text-2. One primary
  button, "Try it in your project", and one secondary.
- **Hero visual (HeroFlow):** a paper card with three numbered clauses
  (contract → generate → verify). Each clause shows its file in mono, and they
  are joined by a thin vertical rule. The footer shows the catch:
  `gate 5 contract FAIL`, with one line on why (after the critique: a green
  PASS showed success, but the product is the FAIL that stops the agent). No window dots. It is a real `<ol>`, so it is
  readable as text.
- **How it works:** the step H3s keep their "1." numbers from the content. The pairs
  keep plain English on the left and code on the right, with a 32px gap and a
  hairline between rows.
- **The agent tries to cheat:** the four bold lead-ins read as a sequence of
  beats, and the closing `verify` block shows the colored gate lines.
- **Try it / Where next:** the install block is full width. "Where next" is
  three link rows with a title and a one-line description.

## Tutorial and guides

- Default VitePress doc layout (sidebar + outline), with the new type and
  code styles. Numbered steps use the H2/H3 hierarchy that is already there.
- Nothing per page: the system carries it.

## Reference

- The table styles above. Tables scroll inside their own container at 390px.
- Anchor links on headings stay visible on hover and focus.

## Explanation

- Long-form: body 16px / 1.7 at the default measure, Newsreader H2s, and
  more space above each H2 (56px).

## Check against the brief

| Brief | Plan |
| --- | --- |
| Precise, calm, trustworthy, not marketing | Paper/slate surfaces, one signal color, editorial serif, no effects |
| Hero headline and two buttons | Kept: brand primary + bordered secondary |
| 3-step flow as the hero visual | HeroFlow as numbered clauses + PASS footer |
| How it works → cheat → try it → where next | Content order kept, styled as above |
| Tutorial long, many code blocks | Code style: 14px, border, label, wraps where it is output |
| Guides: goal on top, steps, code | System type hierarchy; no change to content |
| Reference: dense, scannable tables, anchors | Table styles + inner scroll |
| Explanation: comfortable reading | Measure 688px, 1.7 line height |
| Code and small text readable, light + dark | AA everywhere, 13px minimum, both themes tested |
| Keep VitePress, content, nav, sidebar, DocComments | Theme-only changes; the tokens feed DocComments |
| "Coding agent", never a tool name | No copy changes beyond the existing text |
| Responsive | Tested at 390 and 1440 |

## Changes from the critique and polish (2026-11-25)

- Custom syntax themes, so red means only FAIL (and code tokens pass 4.5:1).
- Home terminal output wraps with a hanging indent; the climax `verify` block
  is no longer cut off.
- Labels in Sans, not mono; no eyebrow; no side stripe on custom blocks.
- Body 17px with a 66ch measure; language labels removed.
- Left open, because they change content: the length and order of the home
  page, and the install instructions that differ between the home page, the
  tutorial and the CI guide.
