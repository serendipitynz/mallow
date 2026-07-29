import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

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
    expect(html).toMatch(/<li class="task-list-item"><label[^>]*><input class="task-list-item-checkbox" type="checkbox" disabled>ToDo<\/label>/);
    expect(html).toMatch(/type="checkbox" disabled checked>Done<\/label>/);
    // The class is added once per list, not once per item.
    expect(html.match(/contains-task-list/g)).toHaveLength(1);
  }, TIMEOUT);

  it('names each checkbox with its own task text (label wrapper)', async () => {
    const { html } = await renderMarkdown('- [ ] write **docs**\n');
    // The label wraps the checkbox AND the item text, so the accessible name is
    // the task itself rather than a generic "incomplete task".
    expect(html).toMatch(
      /<label class="task-list-item-label"><input class="task-list-item-checkbox"[^>]*>write <strong>docs<\/strong><\/label>/,
    );
  }, TIMEOUT);

  it('accepts a tab inside the task marker', async () => {
    const { html } = await renderMarkdown('- [\t] tab-inside\n');
    expect(html).toMatch(/type="checkbox" disabled>tab-inside/);
    expect(html).not.toContain('[');
  }, TIMEOUT);

  it('renders task items in an ordered list too', async () => {
    const { html } = await renderMarkdown('1. [x] first\n');
    expect(html).toContain('<ol class="contains-task-list">');
    expect(html).toMatch(/type="checkbox" disabled checked>first/);
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
