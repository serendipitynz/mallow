import { describe, expect, it } from 'vitest';
import { decodeCssString, rewriteCssValue, walkDeckCss } from './deck-css';

const images = { dir: '/talks', toAssetUrl: (path: string) => `asset://localhost${path}` };

describe('walkDeckCss', () => {
  it('keeps media, supports and container with the rules inside them', () => {
    const css =
      '@media print { h1 { color: red } } @supports (display: grid) { p { display: grid } } @container (min-width: 1px) { a { color: blue } }';
    const result = walkDeckCss(css, undefined);
    expect(result.css).toContain('@media print');
    expect(result.css).toContain('@supports');
    expect(result.css).toContain('@container');
    expect(result.removedAtRules).toEqual([]);
  });

  it('removes every other at-rule, nested ones included, naming each once', () => {
    const css =
      '@layer a { p { color: red } } @media screen { @font-face { font-family: X } } @font-face { font-family: Y } @property --x { syntax: "*"; inherits: false } @-webkit-keyframes k {}';
    const result = walkDeckCss(css, undefined);
    expect(result.css).not.toMatch(/@layer|@font-face|@property|keyframes/);
    expect(result.removedAtRules).toEqual(['@layer', '@font-face', '@property', '@-webkit-keyframes']);
  });

  it('returns nothing for CSS that cannot be parsed', () => {
    expect(walkDeckCss('h1 { color: red', undefined).css).toBe('');
  });

  it('resolves relative URLs and refuses asset: ones', () => {
    const result = walkDeckCss(
      'h1 { background: url(a.png) } h2 { background: url(asset://localhost/x); color: red }',
      images,
    );
    expect(result.css).toContain('url("asset://localhost/talks/a.png")');
    expect(result.css).not.toContain('asset://localhost/x');
    expect(result.css).toContain('color: red');
    expect(result.refusedAssetUrls).toBe(1);
  });
});

describe('rewriteCssValue', () => {
  it('leaves remote and data URLs alone', () => {
    expect(rewriteCssValue('url(https://example.com/a.png)', images)).toBe('url("https://example.com/a.png")');
    expect(rewriteCssValue('url("data:image/png;base64,AAAA")', images)).toBe('url("data:image/png;base64,AAAA")');
  });

  it('refuses the Windows spelling and an escaped spelling of an asset URL', () => {
    expect(rewriteCssValue('url("http://asset.localhost/x")', images)).toBeNull();
    expect(rewriteCssValue('url("\\61sset://localhost/x")', images)).toBeNull();
    expect(rewriteCssValue('url(\\61sset://localhost/x)', images)).toBeNull();
  });

  it('treats image-set strings as URLs', () => {
    expect(rewriteCssValue('image-set("a.png" 1x, "b.png" 2x)', images)).toBe(
      'image-set("asset://localhost/talks/a.png" 1x, "asset://localhost/talks/b.png" 2x)',
    );
    expect(rewriteCssValue('-webkit-image-set("asset://localhost/x" 1x)', images)).toBeNull();
  });

  it('refuses an asset URL carried as a plain string, which image-set(var()) would fetch', () => {
    expect(rewriteCssValue('"asset://localhost/x"', images)).toBeNull();
  });

  it('leaves text strings that are not asset URLs as written', () => {
    expect(rewriteCssValue('"img/a.png"', images)).toBe('"img/a.png"');
    expect(rewriteCssValue('linear-gradient(red, blue)', images)).toBe('linear-gradient(red, blue)');
  });
});

describe('decodeCssString', () => {
  it('decodes hex escapes with their optional space, and character escapes', () => {
    expect(decodeCssString('\\61 b')).toBe('ab');
    expect(decodeCssString('\\"q\\\\')).toBe('"q\\');
    expect(decodeCssString('\\0')).toBe('\uFFFD');
  });
});
