import { describe, expect, it } from 'vitest';
import { documentTitle, windowTitle } from './title';
import type { FileEntry } from './types';

function file(name: string, kind: FileEntry['kind']): FileEntry {
  return { name, path: `/x/${name}`, isDir: false, kind };
}

describe('documentTitle', () => {
  it('uses a markdown front-matter title when present', () => {
    const content = '---\ntitle: My Doc\n---\n# Heading\n';
    expect(documentTitle(file('readme.md', 'markdown'), content)).toBe('My Doc');
  });

  it('trims a front-matter title', () => {
    const content = '---\ntitle: "  Spaced  "\n---\n';
    expect(documentTitle(file('a.md', 'markdown'), content)).toBe('Spaced');
  });

  it('falls back to the file name when the front-matter title is blank', () => {
    const content = '---\ntitle: "   "\n---\n';
    expect(documentTitle(file('a.md', 'markdown'), content)).toBe('a.md');
  });

  it('falls back to the file name when there is no front-matter', () => {
    expect(documentTitle(file('notes.md', 'markdown'), '# just a heading\n')).toBe('notes.md');
  });

  it('ignores front-matter for non-markdown files', () => {
    const content = '---\ntitle: Nope\n---\n';
    expect(documentTitle(file('config.yaml', 'yaml'), content)).toBe('config.yaml');
  });
});

describe('windowTitle', () => {
  it('combines the document label with the app name', () => {
    expect(windowTitle('My Doc')).toBe('My Doc — mallow');
  });

  it('is just the app name when no document is open', () => {
    expect(windowTitle(null)).toBe('mallow');
  });
});
