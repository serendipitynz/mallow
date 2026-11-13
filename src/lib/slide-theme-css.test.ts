import { describe, expect, it } from 'vitest';
import { readThemeMeta, registerFolderThemes } from './slide-theme-css';
import type { ThemeFile } from './slide-themes';

const toAssetUrl = (path: string) => `asset://localhost/${encodeURIComponent(path)}`;

describe('readThemeMeta', () => {
  it('reads @theme and @size the way Marp writes them', () => {
    const meta = readThemeMeta('/* @theme paper */\n/* @size 16:9 1280px 720px */\n/* @size 4:3 960px 720px */\n');
    expect(meta?.name).toBe('paper');
    expect({ ...meta?.sizes }).toEqual({
      '16:9': { width: '1280px', height: '720px' },
      '4:3': { width: '960px', height: '720px' },
    });
  });

  it('reads them from a block comment written over several lines', () => {
    const meta = readThemeMeta('/*!\n * @theme paper\n * @size A4 297mm 210mm\n */\nsection {}');
    expect(meta?.name).toBe('paper');
    expect(meta?.sizes.A4).toEqual({ width: '297mm', height: '210mm' });
  });

  it('takes the last @theme, as Marpit does', () => {
    expect(readThemeMeta('/* @theme one */\n/* @theme two */')?.name).toBe('two');
  });

  it('has no name without an @theme comment', () => {
    expect(readThemeMeta('section { color: red; }')?.name).toBeNull();
  });

  it('drops a size Marpit could not lay out or that would carry more than a length', () => {
    const meta = readThemeMeta(
      '/* @theme t */\n/* @size wide 50% 720px */\n/* @size bad 1280px 720px; color:red */\n/* @size two 1280px */',
    );
    expect(Object.keys(meta?.sizes ?? {})).toEqual([]);
  });

  it('answers null for CSS that does not parse', () => {
    expect(readThemeMeta('/* @theme t */\nsection { color: red')).toBeNull();
  });
});

describe('registerFolderThemes', () => {
  const css = (name: string, body = 'section { color: red; }') => `/* @theme ${name} */\n${body}\n`;
  const file = (name: string, text: string): ThemeFile => ({ path: `/themes/${name}`, text });

  it('registers each file carrying @theme under its name', () => {
    const result = registerFolderThemes([file('a.css', css('alpha')), file('b.css', css('beta'))], toAssetUrl);
    expect(result.themes.map((t) => [t.name, t.path])).toEqual([
      ['alpha', '/themes/a.css'],
      ['beta', '/themes/b.css'],
    ]);
    expect(result.skipped).toEqual([]);
  });

  it('skips a file with no @theme, an unreadable one and one that does not parse', () => {
    const result = registerFolderThemes(
      [
        file('plain.css', 'section {}'),
        { path: '/themes/locked.css', error: 'denied' },
        file('broken.css', css('broken', 'section { color: red')),
      ],
      toAssetUrl,
    );
    expect(result.themes).toEqual([]);
    expect(result.skipped).toEqual([
      { path: '/themes/plain.css', reason: 'noTheme' },
      { path: '/themes/locked.css', reason: 'unreadable' },
      { path: '/themes/broken.css', reason: 'unparsed' },
    ]);
  });

  it('refuses the reserved names default and kinari', () => {
    const result = registerFolderThemes([file('d.css', css('default')), file('k.css', css('kinari'))], toAssetUrl);
    expect(result.themes).toEqual([]);
    expect(result.skipped).toEqual([
      { path: '/themes/d.css', reason: 'reserved', name: 'default' },
      { path: '/themes/k.css', reason: 'reserved', name: 'kinari' },
    ]);
  });

  it('registers neither of two files claiming one name, in either order', () => {
    const one = file('one.css', css('same'));
    const two = file('two.css', css('same'));
    for (const files of [
      [one, two],
      [two, one],
    ]) {
      const result = registerFolderThemes([...files, file('other.css', css('other'))], toAssetUrl);
      expect(result.themes.map((t) => t.name)).toEqual(['other']);
      expect(result.skipped.map((s) => [s.path, s.reason, s.name]).sort()).toEqual([
        ['/themes/one.css', 'conflict', 'same'],
        ['/themes/two.css', 'conflict', 'same'],
      ]);
    }
  });

  it("walks the theme as a deck's CSS, resolving url() against the theme file's directory", () => {
    const text = css(
      'paper',
      '@font-face { font-family: X; src: url(x.woff2); }\n@import "default";\n' +
        'section { background: url(img/grain.png); }\nh1 { background: url("asset://localhost/x"); }\n' +
        '@media (min-width: 1px) { h2 { color: red; } }',
    );
    const [theme] = registerFolderThemes([file('paper.css', text)], toAssetUrl).themes;
    expect(theme.css).toContain(`url("${toAssetUrl('/themes/img/grain.png')}")`);
    expect(theme.css).not.toContain('asset://localhost/x');
    expect(theme.css).not.toContain('@font-face');
    expect(theme.css).toContain('@media');
    expect(theme.removed).toEqual({ atRules: ['@font-face', '@import'], assetUrls: 1 });
  });

  it('keeps a data: URL, as the kinari draft writes its paper', () => {
    const text = css('paper', 'section { background-image: url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E"); }');
    const [theme] = registerFolderThemes([file('paper.css', text)], toAssetUrl).themes;
    expect(theme.css).toContain('data:image/svg+xml');
    expect(theme.removed).toEqual({ atRules: [], assetUrls: 0 });
  });
});
