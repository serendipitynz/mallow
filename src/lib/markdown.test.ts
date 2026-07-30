import { afterEach, describe, expect, it } from 'vitest';
import { renderMarkdown, setCustomEmoji } from './markdown';

// First render boots the Shiki highlighter (WASM + grammars), which can be slow.
const TIMEOUT = 20_000;

describe('renderMarkdown — untrusted-input security boundary', () => {
  it('escapes a raw <script> block instead of emitting live DOM', async () => {
    const { html } = await renderMarkdown('# t\n\n<script>alert(1)</script>\n');
    expect(html).not.toMatch(/<script\b/i);
    expect(html).toContain('&lt;script&gt;');
  }, TIMEOUT);

  it('escapes an inline <img onerror=...> instead of emitting a live element', async () => {
    const { html } = await renderMarkdown('before <img src=x onerror=alert(1)> after\n');
    expect(html).not.toMatch(/<img\b/i);
    expect(html).toContain('&lt;img');
  }, TIMEOUT);

  it('does not turn a javascript: link into a clickable href', async () => {
    const { html } = await renderMarkdown('[x](javascript:alert(1))\n');
    expect(html).not.toMatch(/href=["']?javascript:/i);
    // validateLink rejects the scheme, so markdown-it leaves it as plain text.
    expect(html).not.toMatch(/<a\b/i);
  }, TIMEOUT);

  it('drops a data:text/html link href', async () => {
    const { html } = await renderMarkdown('[x](data:text/html,<script>alert(1)</script>)\n');
    expect(html).not.toMatch(/href=["']?data:text\/html/i);
  }, TIMEOUT);

  it('drops a vbscript: link href', async () => {
    const { html } = await renderMarkdown('[x](vbscript:msgbox(1))\n');
    expect(html).not.toMatch(/href=["']?vbscript:/i);
  }, TIMEOUT);
});

describe('renderMarkdown — normal rendering still works', () => {
  it('renders headings, bold, and lists', async () => {
    const { html } = await renderMarkdown('# Title\n\n**bold** text\n\n- a\n- b\n');
    expect(html).toMatch(/<h1[^>]*>Title<\/h1>/);
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<li>a</li>');
  }, TIMEOUT);

  it('renders GFM alerts', async () => {
    const { html } = await renderMarkdown('> [!NOTE]\n> hello\n');
    expect(html).toMatch(/markdown-alert/);
  }, TIMEOUT);

  it('highlights fenced code blocks with Shiki', async () => {
    const { html } = await renderMarkdown('```js\nconst a = 1;\n```\n');
    expect(html).toMatch(/<pre class="shiki/);
  }, TIMEOUT);

  it('rewrites a mermaid fence to <pre class="mermaid"> with escaped content', async () => {
    const { html } = await renderMarkdown('```mermaid\ngraph TD;A--><B>;\n```\n');
    expect(html).toContain('<pre class="mermaid">');
    expect(html).not.toMatch(/<pre class="shiki/);
    expect(html).toContain('&lt;B&gt;');
  }, TIMEOUT);

  it('renders front-matter as a table above the body', async () => {
    const { html } = await renderMarkdown('---\ntitle: Hello\ncount: 3\n---\n# Body\n');
    expect(html).toMatch(/doc-frontmatter/);
    expect(html).toContain('Hello');
    expect(html).toMatch(/<h1[^>]*>Body<\/h1>/);
  }, TIMEOUT);

  it('keeps normal markdown images', async () => {
    const { html } = await renderMarkdown('![alt](https://example.com/x.png)\n');
    expect(html).toMatch(/<img[^>]+src="https:\/\/example\.com\/x\.png"/);
  }, TIMEOUT);

  it('keeps allowed data:image links', async () => {
    const { html } = await renderMarkdown('[x](data:image/png;base64,AAAA)\n');
    expect(html).toContain('href="data:image/png;base64,AAAA"');
  }, TIMEOUT);

  it('autolinks bare http(s) URLs (linkify)', async () => {
    const { html } = await renderMarkdown('see https://example.com here\n');
    expect(html).toMatch(/<a[^>]+href="https:\/\/example\.com"/);
  }, TIMEOUT);

  it('renders GFM task lists as disabled checkboxes', async () => {
    const { html } = await renderMarkdown('- [ ] ToDo\n- [x] Done\n');
    expect(html).toContain('<ul class="contains-task-list">');
    expect(html).toMatch(/<li class="task-list-item"><input class="task-list-item-checkbox" type="checkbox" disabled aria-label="ToDo">ToDo/);
    expect(html).toMatch(/type="checkbox" disabled checked aria-label="Done">Done/);
    // The class is added once per list, not once per item.
    expect(html.match(/contains-task-list/g)).toHaveLength(1);
  }, TIMEOUT);

  it('names each checkbox with its own task text', async () => {
    const { html } = await renderMarkdown('- [ ] write **docs**\n');
    // The name is the task itself, not a generic "incomplete task".
    expect(html).toContain('aria-label="write docs"');
  }, TIMEOUT);

  it('names a linked task without wrapping the link in a label', async () => {
    const { html } = await renderMarkdown('- [ ] review [PR #12](https://example.com)\n');
    // A <label> must not contain interactive content, so the link stays outside
    // any labelling element; the name uses the link text, not the URL.
    expect(html).not.toMatch(/<label\b/);
    expect(html).toContain('aria-label="review PR #12"');
    expect(html).toMatch(/<a[^>]+href="https:\/\/example\.com"/);
  }, TIMEOUT);

  it('escapes quotes in the generated accessible name', async () => {
    const { html } = await renderMarkdown('- [ ] say "hi" & <bye>\n');
    expect(html).toContain('aria-label="say &quot;hi&quot; &amp; &lt;bye&gt;"');
  }, TIMEOUT);

  it('accepts a tab inside the task marker', async () => {
    const { html } = await renderMarkdown('- [\t] tab-inside\n');
    expect(html).toMatch(/type="checkbox" disabled aria-label="tab-inside">tab-inside/);
    expect(html).not.toContain('[');
  }, TIMEOUT);

  it('renders task items in an ordered list too', async () => {
    const { html } = await renderMarkdown('1. [x] first\n');
    expect(html).toContain('<ol class="contains-task-list">');
    expect(html).toMatch(/type="checkbox" disabled checked aria-label="first">first/);
  }, TIMEOUT);

  it('leaves a non-task list item untouched', async () => {
    const { html } = await renderMarkdown('- [link](https://example.com)\n- [not a task]x\n');
    expect(html).not.toContain('task-list-item');
    expect(html).not.toMatch(/<input\b/);
  }, TIMEOUT);

  it('collects a heading outline', async () => {
    const { headings } = await renderMarkdown('# A\n\n## B\n\n### C\n');
    expect(headings.map((h) => [h.depth, h.text])).toEqual([
      [1, 'A'],
      [2, 'B'],
      [3, 'C'],
    ]);
  }, TIMEOUT);
});

describe('renderMarkdown — emoji', () => {
  afterEach(() => setCustomEmoji(null));

  it('wraps a built-in emoji so the colour emoji font can be targeted', async () => {
    const { html } = await renderMarkdown('done :ok:\n');
    // Without the wrapper the JP body font supplies U+1F197 as a monochrome glyph.
    expect(html).toContain('<span class="emoji">\u{1F197}</span>');
  }, TIMEOUT);

  it('leaves an unknown shortcode as literal text', async () => {
    const { html } = await renderMarkdown(':tmnf: nope\n');
    expect(html).toContain(':tmnf:');
    expect(html).not.toContain('class="emoji"');
  }, TIMEOUT);

  it('substitutes a custom unicode shortcode', async () => {
    setCustomEmoji({ unicode: { 'flag-nz': '\u{1F1F3}\u{1F1FF}' }, images: {} });
    const { html } = await renderMarkdown(':flag-nz: kia ora\n');
    expect(html).toContain('<span class="emoji">\u{1F1F3}\u{1F1FF}</span>');
  }, TIMEOUT);

  it('renders a custom image shortcode as an inline image', async () => {
    setCustomEmoji({ unicode: {}, images: { tmnf: 'asset://localhost/tmnf.png' } });
    const { html } = await renderMarkdown(':tmnf: rinse-dev\n');
    expect(html).toContain('<img class="emoji emoji--custom" src="asset://localhost/tmnf.png" alt=":tmnf:"');
  }, TIMEOUT);

  it('matches adjacent shortcodes with hyphens in their names', async () => {
    setCustomEmoji({ unicode: {}, images: { progress: 'asset://p.png', 'male-support': 'asset://m.png' } });
    const { html } = await renderMarkdown(':progress::male-support: both\n');
    expect(html).toContain('src="asset://p.png"');
    expect(html).toContain('src="asset://m.png"');
    // Both were consumed — nothing of the run survives as literal text.
    expect(html).toMatch(/^<p><img[^>]*><img[^>]*> both<\/p>/);
  }, TIMEOUT);

  it('keeps built-in shortcodes working alongside custom ones', async () => {
    setCustomEmoji({ unicode: {}, images: { tmnf: 'asset://tmnf.png' } });
    const { html } = await renderMarkdown(':ok: :tmnf:\n');
    expect(html).toContain('<span class="emoji">\u{1F197}</span>');
    expect(html).toContain('src="asset://tmnf.png"');
  }, TIMEOUT);

  it('names a task-list checkbox with the shortcode for an image emoji', async () => {
    setCustomEmoji({ unicode: {}, images: { tmnf: 'asset://tmnf.png' } });
    const { html } = await renderMarkdown('- [x] :tmnf: ship it\n');
    expect(html).toContain('aria-label=":tmnf: ship it"');
  }, TIMEOUT);

  it('leaves an Object.prototype name undefined when the set does not define it', async () => {
    setCustomEmoji({ unicode: {}, images: { tmnf: 'asset://tmnf.png' } });
    const { html } = await renderMarkdown(':constructor: :toString:\n');
    expect(html).toContain(':constructor:');
    expect(html).toContain(':toString:');
    expect(html).not.toMatch(/<img\b/);
  }, TIMEOUT);

  it('renders a shortcode that shares its name with an Object.prototype member', async () => {
    setCustomEmoji({ unicode: { toString: '\u{1F44D}' }, images: { constructor: 'asset://c.png' } });
    const { html } = await renderMarkdown(':constructor: :toString:\n');
    expect(html).toContain('src="asset://c.png"');
    // A plain-object image lookup for `toString` would hit Object.prototype and
    // emit an <img> whose src is that function's source text.
    expect(html).toContain('<span class="emoji">\u{1F44D}</span>');
    expect(html).not.toContain('native code');
  }, TIMEOUT);

  it('drops a custom set again when cleared', async () => {
    setCustomEmoji({ unicode: {}, images: { tmnf: 'asset://tmnf.png' } });
    setCustomEmoji(null);
    const { html } = await renderMarkdown(':tmnf:\n');
    expect(html).toContain(':tmnf:');
    expect(html).not.toMatch(/<img\b/);
  }, TIMEOUT);
});
