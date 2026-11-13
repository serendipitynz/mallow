import { describe, expect, it, vi } from 'vitest';
import { renderDeck } from './deck';
import { isDeck } from './is-deck';
import type { DeckThemes } from './slide-themes';

// The first render boots the Shiki highlighter; see markdown.test.ts.
vi.setConfig({ testTimeout: 20_000 });

/** Builds the URL the app would, so a second pass over it would refuse it. */
const images = { dir: '/talks/deck', toAssetUrl: (path: string) => `asset://localhost/${encodeURIComponent(path)}` };

const deck = (body: string, front = '') => `---\nmarp: true\n${front}---\n\n${body}`;

describe('isDeck', () => {
  it('takes YAML front matter whose marp is the boolean true', () => {
    expect(isDeck('---\nmarp: true\n---\n\n# a\n')).toBe(true);
  });

  it('refuses a string, a missing key, TOML front matter and no front matter', () => {
    expect(isDeck('---\nmarp: "true"\n---\n# a\n')).toBe(false);
    expect(isDeck('---\ntitle: x\n---\n# a\n')).toBe(false);
    expect(isDeck('+++\nmarp = true\n+++\n# a\n')).toBe(false);
    expect(isDeck('# a\n\n---\n\nmarp: true\n')).toBe(false);
  });
});

describe('renderDeck — the split and the directives', () => {
  it('splits at every horizontal rule, one inline SVG per slide', async () => {
    const { slides, size } = await renderDeck(deck('# One\n\n---\n\n# Two\n\n---\n\n# Three\n'));
    expect(slides).toHaveLength(3);
    expect(slides[1]).toContain('<h1');
    expect(slides[1]).toContain('Two');
    for (const slide of slides) {
      expect(slide.startsWith('<svg data-marpit-svg')).toBe(true);
    }
    expect(size).toBe('16:9');
  });

  it('applies a local class directive to its own slide only', async () => {
    const { slides } = await renderDeck(deck('<!-- _class: lead -->\n# One\n\n---\n\n# Two\n'));
    expect(slides[0]).toContain('class="lead"');
    expect(slides[1]).not.toContain('class="lead"');
  });

  it('applies an unquoted colour, as Marp writes it (looseYAML)', async () => {
    const { slides } = await renderDeck(deck('<!-- _backgroundColor: #123456 -->\n# One\n'));
    expect(slides[0]).toContain('#123456');
  });

  it('carries the footer and paginates from front matter', async () => {
    const { slides } = await renderDeck(deck('# One\n\n---\n\n# Two\n', 'paginate: true\nfooter: Talk\n'));
    expect(slides[1]).toContain('<footer>Talk</footer>');
    expect(slides[1]).toContain('data-marpit-pagination="2"');
  });

  it('lays a 4:3 deck out at 960x720', async () => {
    const result = await renderDeck(deck('# One\n', 'size: 4:3\n'));
    expect(result.size).toBe('4:3');
    expect(result.slides[0]).toContain('viewBox="0 0 960 720"');
    expect(result.css).toContain('960px');
  });

  it('keeps speaker notes off the slide', async () => {
    const { slides } = await renderDeck(deck('# One\n\n<!-- say hello -->\n'));
    expect(slides[0]).not.toContain('say hello');
  });

  it('leaves the preview pipeline as it was', async () => {
    const { renderMarkdown } = await import('./markdown');
    await renderDeck(deck('# One\n\n---\n\n# Two\n'));
    const { html } = await renderMarkdown('# A\n\n---\n\n# B\n');
    expect(html).toContain('<hr>');
    expect(html).not.toContain('<section');
  });
});

describe('renderDeck — images (decision-17 on the token)', () => {
  it('resolves an inline image and a background image relative to the document', async () => {
    const { slides } = await renderDeck(deck('![w:200](img/a.png)\n\n![bg](img/cover.png)\n'), { images });
    expect(slides[0]).toContain(`src="asset://localhost/${encodeURIComponent('/talks/deck/img/a.png')}"`);
    expect(slides[0]).toContain(encodeURIComponent('/talks/deck/img/cover.png'));
  });

  it('refuses an asset: URL the deck wrote, as an image and as a background', async () => {
    const { slides } = await renderDeck(deck('![](asset://localhost/x.png)\n\n![bg](asset://localhost/y.png)\n'), {
      images,
    });
    expect(slides[0]).not.toContain('asset://localhost/x.png');
    expect(slides[0]).not.toContain('asset://localhost/y.png');
  });
});

describe('renderDeck — deck CSS (decision-18 §6)', () => {
  it('applies a style tag scoped to the slides, and its url() under decision-17', async () => {
    const { css } = await renderDeck(deck('<style>\nh1 { color: red; background: url(bg.png) }\n</style>\n\n# One\n'), {
      images,
    });
    expect(css).toMatch(/div\.marpit > svg > foreignObject > section[^{]*h1/);
    expect(css).toContain(encodeURIComponent('/talks/deck/bg.png'));
  });

  it('removes at-rules other than media, supports and container, and names them', async () => {
    const css =
      '@import url(x.css);\n@font-face { font-family: F; src: url(f.woff) }\n@media (min-width: 1px) { h2 { color: blue } }';
    const result = await renderDeck(deck(`<style>\n${css}\n</style>\n\n# One\n`));
    expect(result.css).not.toContain('@import');
    expect(result.css).not.toContain('@font-face');
    expect(result.css).toContain('@media');
    expect(result.unsupported).toEqual([
      { kind: 'cssAtRule', name: '@import' },
      { kind: 'cssAtRule', name: '@font-face' },
    ]);
  });

  it('walks the style directive as well as style tags', async () => {
    const result = await renderDeck(
      deck('# One\n', 'style: |\n  @keyframes k { from { opacity: 0 } }\n  h1 { color: red }\n'),
    );
    expect(result.css).not.toContain('@keyframes');
    expect(result.unsupported).toEqual([{ kind: 'cssAtRule', name: '@keyframes' }]);
  });

  it('does not report the theme pack, whose structural CSS the deck never wrote', async () => {
    const result = await renderDeck(deck('# One\n'));
    expect(result.unsupported).toEqual([]);
  });

  it('removes a declaration naming an asset: URL and reports it', async () => {
    const result = await renderDeck(
      deck('<style scoped>\nh1 { background-image: url("asset://localhost/etc"); color: red }\n</style>\n\n# One\n'),
    );
    expect(result.css).not.toContain('asset://localhost/etc');
    expect(result.css).toContain('color: red');
    expect(result.unsupported).toEqual([{ kind: 'cssAssetUrl' }]);
  });
});

describe('renderDeck — the notice (decision-18 §3)', () => {
  it('names raw HTML only where a tag is written', async () => {
    expect((await renderDeck(deck('Costs a < b and 3 > 2\n'))).unsupported).toEqual([]);
    expect((await renderDeck(deck('Escaped \\<div> text\n'))).unsupported).toEqual([]);
    expect((await renderDeck(deck('Some <b>bold</b> text\n'))).unsupported).toEqual([{ kind: 'rawHtml' }]);
  });

  it('keeps raw HTML escaped', async () => {
    const { slides } = await renderDeck(deck('<div onclick="x()">hi</div>\n'));
    expect(slides[0]).not.toContain('<div onclick');
    expect(slides[0]).toContain('&lt;div');
  });

  it('names the math directive but not a dollar sign in prose', async () => {
    expect((await renderDeck(deck('Price $5 and $6\n'))).unsupported).toEqual([]);
    expect((await renderDeck(deck('# One\n', 'math: katex\n'))).unsupported).toEqual([{ kind: 'math' }]);
  });

  it('names a theme other than default and draws it with the slide theme', async () => {
    const result = await renderDeck(deck('# One\n', 'theme: gaia\n'));
    expect(result.unsupported).toEqual([{ kind: 'theme', name: 'gaia', drawn: 'default' }]);
    expect(result.css).toContain('var(--color-bg)');
    expect((await renderDeck(deck('# One\n', 'theme: default\n'))).unsupported).toEqual([]);
  });

  it('names an unsupported size and a fit heading', async () => {
    expect((await renderDeck(deck('# One\n', 'size: A4\n'))).unsupported).toEqual([{ kind: 'size', value: 'A4' }]);
    expect((await renderDeck(deck('# <!-- fit --> Big\n'))).unsupported).toEqual([{ kind: 'fit' }]);
  });

  it('names CSS that cannot be parsed and drops it', async () => {
    const result = await renderDeck(deck('<style>\nh1 { color: red\n</style>\n\n# One\n'));
    expect(result.unsupported).toEqual([{ kind: 'cssUnparsed' }]);
  });

  it('names a closing tag and a tag with attributes, but not an autolink', async () => {
    expect((await renderDeck(deck('a </span> b\n'))).unsupported).toEqual([{ kind: 'rawHtml' }]);
    expect((await renderDeck(deck('<img src="x.png" alt=a>\n'))).unsupported).toEqual([{ kind: 'rawHtml' }]);
    expect((await renderDeck(deck('see <https://example.com>\n'))).unsupported).toEqual([]);
  });
});

describe('renderDeck — heading ids', () => {
  it('gives the same ids however many times the deck is rendered', async () => {
    const source = deck('# Intro\n\n---\n\n# Intro\n');
    const first = await renderDeck(source);
    const second = await renderDeck(source);
    expect(second.slides).toEqual(first.slides);
  });
});

describe('renderDeck — the theme set (decision-19)', () => {
  const paper: DeckThemes = {
    themes: [
      {
        name: 'paper',
        css: '/* @theme paper */\nsection { width: 1280px; height: 720px; color: light-dark(#111, #eee); }\n',
        sizes: { '16:9': { width: '1280px', height: '720px' }, '4:3': { width: '960px', height: '720px' } },
      },
      { name: 'square', css: '/* @theme square */\nsection { width: 800px; height: 800px; }\n', sizes: {} },
    ],
    defaultName: 'default',
  };
  const withDefault = (defaultName: string): DeckThemes => ({ themes: paper.themes, defaultName });

  it('draws a deck with the folder theme it names', async () => {
    const result = await renderDeck(deck('# One\n', 'theme: paper\n'), { themes: paper });
    expect(result.theme).toBe('paper');
    expect(result.css).toContain('light-dark(#111, #eee)');
    expect(result.css).not.toContain('var(--color-bg)');
    expect(result.unsupported).toEqual([]);
  });

  it('keeps default for a deck naming it, whatever the preference', async () => {
    const result = await renderDeck(deck('# One\n', 'theme: default\n'), { themes: withDefault('paper') });
    expect(result.theme).toBe('default');
    expect(result.css).toContain('var(--color-bg)');
  });

  it('draws a deck naming no theme with the default-theme preference', async () => {
    const result = await renderDeck(deck('# One\n'), { themes: withDefault('paper') });
    expect(result.theme).toBe('paper');
    expect(result.unsupported).toEqual([]);
  });

  it('draws an unknown name with the preference and says so', async () => {
    const result = await renderDeck(deck('# One\n', 'theme: gaia\n'), { themes: withDefault('paper') });
    expect(result.theme).toBe('paper');
    expect(result.unsupported).toEqual([{ kind: 'theme', name: 'gaia', drawn: 'paper' }]);
  });

  it('falls back to the slide theme for a preference the set does not hold', async () => {
    const result = await renderDeck(deck('# One\n'), { themes: withDefault('gone') });
    expect(result.theme).toBe('default');
    expect(result.css).toContain('var(--color-bg)');
  });

  it("draws a deck naming kinari with mallow's copy, with or without a folder", async () => {
    for (const themes of [paper, undefined]) {
      const result = await renderDeck(deck('# One\n', 'theme: kinari\n'), { themes });
      expect(result.theme).toBe('kinari');
      expect(result.css).toContain('--kinari-paper: light-dark(');
      expect(result.css).not.toContain('var(--color-bg)');
      expect(result.unsupported).toEqual([]);
    }
  });

  it("takes a kinari deck's size from kinari's own @size entries", async () => {
    const result = await renderDeck(deck('# One\n', 'theme: kinari\nsize: 4:3\n'), { themes: paper });
    expect(result.size).toBe('4:3');
    expect(result.slides[0]).toContain('viewBox="0 0 960 720"');
    expect(result.unsupported).toEqual([]);
  });

  it('draws a deck naming no theme with kinari when the preference names it', async () => {
    const result = await renderDeck(deck('# One\n'), { themes: { themes: [], defaultName: 'kinari' } });
    expect(result.theme).toBe('kinari');
    expect(result.css).toContain('--kinari-paper: light-dark(');
  });

  it("takes a deck's size from the theme's @size entry", async () => {
    const result = await renderDeck(deck('# One\n', 'theme: paper\nsize: 4:3\n'), { themes: paper });
    expect(result.size).toBe('4:3');
    expect(result.slides[0]).toContain('viewBox="0 0 960 720"');
    expect(result.unsupported).toEqual([]);
  });

  it('draws a theme with no entry for the size at its own size, and reports it', async () => {
    const result = await renderDeck(deck('# One\n', 'theme: square\nsize: 4:3\n'), { themes: paper });
    expect(result.size).toBeNull();
    expect(result.slides[0]).toContain('viewBox="0 0 800 800"');
    expect(result.unsupported).toEqual([{ kind: 'size', value: '4:3' }]);
  });

  it("keeps mallow's two generated sizes under the slide theme", async () => {
    const result = await renderDeck(deck('# One\n', 'size: 4:3\n'), { themes: paper });
    expect(result.theme).toBe('default');
    expect(result.size).toBe('4:3');
    expect(result.slides[0]).toContain('viewBox="0 0 960 720"');
  });
});
