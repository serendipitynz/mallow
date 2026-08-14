import { describe, expect, it } from 'vitest';
import { ancestorDirs, basename, isInside, join } from './path';

describe('join', () => {
  it('appends components with the input separator', () => {
    expect(join('/Users/me/emoji', 'images', 'a.png')).toBe('/Users/me/emoji/images/a.png');
    expect(join('C:\\Users\\me\\emoji', 'images')).toBe('C:\\Users\\me\\emoji\\images');
  });

  it('does not double a trailing separator', () => {
    expect(join('/Users/me/emoji/', 'emoji.json')).toBe('/Users/me/emoji/emoji.json');
    expect(join('C:\\emoji\\', 'emoji.json')).toBe('C:\\emoji\\emoji.json');
  });
});

describe('basename', () => {
  it('takes the last component of a POSIX path', () => {
    expect(basename('/Users/me/docs/README.md')).toBe('README.md');
  });

  it('takes the last component of a Windows path', () => {
    expect(basename('C:\\Users\\me\\docs\\README.md')).toBe('README.md');
  });

  it('ignores a trailing separator', () => {
    expect(basename('/Users/me/docs/')).toBe('docs');
    expect(basename('C:\\Users\\me\\docs\\')).toBe('docs');
  });

  it('handles a UNC path', () => {
    expect(basename('\\\\server\\share\\notes.md')).toBe('notes.md');
  });

  it('falls back to the input when there is nothing to split', () => {
    expect(basename('README.md')).toBe('README.md');
    expect(basename('/')).toBe('/');
  });
});

describe('isInside', () => {
  it('is true for a file under the root (POSIX)', () => {
    expect(isInside('/Users/me/docs', '/Users/me/docs/a/README.md')).toBe(true);
  });

  it('is true for a file under the root (Windows)', () => {
    expect(isInside('C:\\Users\\me\\docs', 'C:\\Users\\me\\docs\\a\\README.md')).toBe(true);
  });

  it('is true for the root itself', () => {
    expect(isInside('/Users/me/docs', '/Users/me/docs')).toBe(true);
  });

  it('rejects a sibling that shares a name prefix', () => {
    expect(isInside('C:\\foo', 'C:\\foobar\\file.md')).toBe(false);
    expect(isInside('/foo', '/foobar/file.md')).toBe(false);
  });

  it('rejects a path outside the root', () => {
    expect(isInside('/Users/me/docs', '/Users/me/other/README.md')).toBe(false);
  });
});

describe('ancestorDirs', () => {
  it('returns the intermediate directories for a POSIX path', () => {
    expect(ancestorDirs('/Users/me/docs', '/Users/me/docs/a/b/README.md')).toEqual([
      '/Users/me/docs/a',
      '/Users/me/docs/a/b',
    ]);
  });

  it('returns the intermediate directories for a Windows path', () => {
    expect(ancestorDirs('C:\\Users\\me\\docs', 'C:\\Users\\me\\docs\\a\\b\\README.md')).toEqual([
      'C:\\Users\\me\\docs\\a',
      'C:\\Users\\me\\docs\\a\\b',
    ]);
  });

  it('returns an empty array for a sibling that shares a name prefix', () => {
    expect(ancestorDirs('C:\\Users\\me\\docs', 'C:\\Users\\me\\docs-other\\README.md')).toEqual([]);
  });

  it('returns an empty array when the file is a direct child of the root', () => {
    expect(ancestorDirs('/Users/me/docs', '/Users/me/docs/README.md')).toEqual([]);
  });

  it('tolerates a trailing separator on the root', () => {
    expect(ancestorDirs('/Users/me/docs/', '/Users/me/docs/a/README.md')).toEqual(['/Users/me/docs/a']);
    expect(ancestorDirs('C:\\Users\\me\\docs\\', 'C:\\Users\\me\\docs\\a\\README.md')).toEqual([
      'C:\\Users\\me\\docs\\a',
    ]);
  });

  it('returns an empty array when the file is not inside the root', () => {
    expect(ancestorDirs('/Users/me/docs', '/etc/hosts')).toEqual([]);
  });
});
