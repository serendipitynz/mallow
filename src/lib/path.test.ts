import { describe, expect, it } from 'vitest';
import { ancestorDirs, basename, dirname, isInside, join, resolvePath } from './path';

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

describe('dirname', () => {
  it('drops the last component of either separator style', () => {
    expect(dirname('/Users/me/docs/README.md')).toBe('/Users/me/docs');
    expect(dirname('C:\\Users\\me\\docs\\README.md')).toBe('C:\\Users\\me\\docs');
  });

  it('ignores a trailing separator', () => {
    expect(dirname('/Users/me/docs/')).toBe('/Users/me');
  });

  it('keeps the root separator for a file directly under it', () => {
    expect(dirname('/README.md')).toBe('/');
  });

  it('has no directory for a bare name', () => {
    expect(dirname('README.md')).toBe('');
  });
});

describe('resolvePath', () => {
  it('appends a document-relative reference', () => {
    expect(resolvePath('/Users/me/docs', 'img/logo.png')).toBe('/Users/me/docs/img/logo.png');
    expect(resolvePath('/Users/me/docs', './img/logo.png')).toBe('/Users/me/docs/img/logo.png');
  });

  it('climbs with ..', () => {
    expect(resolvePath('/Users/me/docs', '../assets/logo.png')).toBe('/Users/me/assets/logo.png');
    expect(resolvePath('/Users/me/docs', 'img/../logo.png')).toBe('/Users/me/docs/logo.png');
  });

  // Climbing above the folder the user opened is resolved like any other path:
  // the asset-protocol grant decides whether it can be read, and this function
  // does not widen it.
  it('resolves a climb above the opened folder rather than clamping it', () => {
    expect(resolvePath('/Users/me/docs', '../../etc/hosts')).toBe('/Users/etc/hosts');
  });

  it('stops climbing at the root', () => {
    expect(resolvePath('/docs', '../../../logo.png')).toBe('/logo.png');
  });

  // The asset scope sets require_literal_leading_dot on unix, so a `**` grant
  // does not match these — the path is still resolved, and the reference simply
  // does not load. Nothing here treats a leading dot specially.
  it('keeps a dot-prefixed directory as written', () => {
    expect(resolvePath('/Users/me/docs', './.assets/logo.png')).toBe('/Users/me/docs/.assets/logo.png');
  });

  it('keeps the Windows separator style', () => {
    expect(resolvePath('C:\\Users\\me\\docs', '../img/logo.png')).toBe('C:\\Users\\me\\img\\logo.png');
  });

  // A climb that reaches the drive root leaves `C:`, which carries no separator
  // of its own — the style has to come from the input, not from what is left of it.
  it('keeps the Windows separator style at the drive root', () => {
    expect(resolvePath('C:\\docs', '../img/logo.png')).toBe('C:\\img\\logo.png');
    expect(resolvePath('C:\\', 'img/logo.png')).toBe('C:\\img\\logo.png');
  });
});
