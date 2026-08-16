import { describe, expect, it } from 'vitest';
import { fileEntryFromPath, kindFromName } from './file';

describe('kindFromName', () => {
  it('maps supported extensions (case-insensitive)', () => {
    expect(kindFromName('README.md')).toBe('markdown');
    expect(kindFromName('flow.mmd')).toBe('mermaid');
    expect(kindFromName('data.JSON')).toBe('json');
    expect(kindFromName('config.yml')).toBe('yaml');
    expect(kindFromName('Cargo.toml')).toBe('toml');
  });

  it('maps the source-view extensions', () => {
    expect(kindFromName('notes.txt')).toBe('text');
    expect(kindFromName('readme.text')).toBe('text');
    expect(kindFromName('server.LOG')).toBe('text');
    expect(kindFromName('app.ini')).toBe('ini');
    expect(kindFromName('nginx.conf')).toBe('ini');
    expect(kindFromName('tool.cfg')).toBe('ini');
    expect(kindFromName('gradle.properties')).toBe('ini');
    expect(kindFromName('.editorconfig')).toBe('ini');
    expect(kindFromName('fix.diff')).toBe('diff');
    expect(kindFromName('fix.patch')).toBe('diff');
    expect(kindFromName('schema.sql')).toBe('sql');
    expect(kindFromName('index.html')).toBe('html');
    expect(kindFromName('index.HTM')).toBe('html');
  });

  it('maps media extensions', () => {
    expect(kindFromName('photo.PNG')).toBe('image');
    expect(kindFromName('pic.jpeg')).toBe('image');
    expect(kindFromName('anim.gif')).toBe('image');
    expect(kindFromName('logo.svg')).toBe('image');
    expect(kindFromName('shot.heic')).toBe('image');
    expect(kindFromName('paper.pdf')).toBe('pdf');
    expect(kindFromName('clip.webm')).toBe('video');
    expect(kindFromName('clip.mp4')).toBe('video');
    expect(kindFromName('clip.mov')).toBe('video');
  });

  // Null, not a fallback kind: `file_kind` keeps these out of the tree, and the
  // two mappings have to agree on what is out of scope.
  it('returns null for an extension the backend does not map', () => {
    expect(kindFromName('archive.zip')).toBeNull();
    expect(kindFromName('Makefile')).toBeNull();
    expect(kindFromName('.gitignore')).toBeNull();
  });
});

describe('fileEntryFromPath', () => {
  it('takes the file name from a POSIX path', () => {
    const entry = fileEntryFromPath('/Users/me/docs/README.md');
    expect(entry?.name).toBe('README.md');
    expect(entry?.kind).toBe('markdown');
    expect(entry?.isDir).toBe(false);
    expect(entry?.path).toBe('/Users/me/docs/README.md');
  });

  it('takes the file name from a Windows path', () => {
    const entry = fileEntryFromPath('C:\\Users\\me\\docs\\README.md');
    expect(entry?.name).toBe('README.md');
    expect(entry?.kind).toBe('markdown');
    // The original path is preserved verbatim so it matches Rust's tree entries.
    expect(entry?.path).toBe('C:\\Users\\me\\docs\\README.md');
  });

  it('is null when the extension maps to no kind', () => {
    expect(fileEntryFromPath('/Users/me/docs/archive.zip')).toBeNull();
  });
});
