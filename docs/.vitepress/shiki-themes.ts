// Restrained syntax themes for the code blocks: ink for keywords, umber for strings,
// teal for constants, gray for comments. No red, so red on the site means only FAIL.
// Each color is at least 4.5:1 on the code background, also on a highlighted line
// (design-system/urn-forge/MASTER.md).

type Palette = { fg: string; comment: string; keyword: string; string: string; constant: string };

function theme(name: string, type: 'light' | 'dark', c: Palette) {
  return {
    name,
    type,
    colors: { 'editor.foreground': c.fg, 'editor.background': '#00000000' },
    tokenColors: [
      { settings: { foreground: c.fg } },
      { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: c.comment, fontStyle: 'italic' } },
      {
        scope: [
          'keyword',
          'storage',
          'storage.type',
          'storage.modifier',
          'keyword.operator.new',
          'keyword.operator.expression',
          'keyword.control',
          'entity.name.tag',
          'entity.name.tag.yaml',
          'support.type.property-name',
          'keyword.other.unit',
        ],
        settings: { foreground: c.keyword },
      },
      { scope: ['string', 'string.quoted', 'string.template', 'string.unquoted.plain.out.yaml', 'markup.inline.raw'], settings: { foreground: c.string } },
      {
        scope: ['constant', 'constant.numeric', 'constant.language', 'support.constant', 'variable.other.constant', 'constant.other'],
        settings: { foreground: c.constant },
      },
      { scope: ['entity.name.function', 'support.function', 'entity.name.type', 'support.type', 'entity.other.inherited-class'], settings: { foreground: c.fg, fontStyle: 'bold' } },
      { scope: ['variable', 'variable.parameter', 'punctuation', 'keyword.operator', 'meta.brace'], settings: { foreground: c.fg } },
      { scope: ['markup.heading', 'keyword.control.directive', 'keyword.other.gherkin', 'keyword.language.gherkin'], settings: { foreground: c.keyword, fontStyle: 'bold' } },
    ],
  };
}

export const lightTheme = theme('urn-forge-light', 'light', {
  fg: '#1b1f1c',
  comment: '#5e665f',
  keyword: '#2d4590',
  string: '#7a4310',
  constant: '#0b5e66',
});

export const darkTheme = theme('urn-forge-dark', 'dark', {
  fg: '#e7ebe7',
  comment: '#8b958c',
  keyword: '#a3b8ff',
  string: '#e2b47e',
  constant: '#7fd0c4',
});
