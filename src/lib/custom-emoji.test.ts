import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileEntry } from './types';

// The loader is the one place that talks to Tauri, so the backend is stubbed
// with an in-memory folder. `convertFileSrc` becomes an identifiable prefix so
// the assertions can read the resolved path straight out of the URL.
const files = new Map<string, string>();
const dirs = new Map<string, FileEntry[]>();
/** Paths that exist but cannot be read, so the read-failure branch is reachable. */
const unreadable = new Set<string>();

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://localhost/${path}`,
}));

vi.mock('./tauri', () => ({
  allowMediaDir: vi.fn(async () => {}),
  pathExists: async (path: string) => files.has(path) || dirs.has(path) || unreadable.has(path),
  readFile: async (path: string) => {
    const content = files.get(path);
    if (content === undefined) {
      return { ok: false, error: { kind: 'io', path, message: `${path}: no such file` } };
    }
    return { ok: true, text: content };
  },
  readDirTree: async (path: string) => {
    const entries = dirs.get(path);
    if (!entries) {
      throw new Error(`no such dir: ${path}`);
    }
    return entries;
  },
}));

const { loadCustomEmoji } = await import('./custom-emoji');
const { allowMediaDir } = await import('./tauri');

const ROOT = '/emoji';

/** An image file entry as `read_dir_tree` would report it. */
function image(dir: string, name: string): FileEntry {
  return { name, path: `${dir}/${name}`, isDir: false, kind: 'image' };
}

beforeEach(() => {
  files.clear();
  dirs.clear();
  unreadable.clear();
  vi.mocked(allowMediaDir).mockClear();
});

describe('loadCustomEmoji', () => {
  it('grants the asset protocol access to the folder', async () => {
    dirs.set(ROOT, []);
    await loadCustomEmoji(ROOT);
    expect(allowMediaDir).toHaveBeenCalledWith(ROOT);
  });

  it('names each image after its file, with no manifest at all', async () => {
    dirs.set(ROOT, [{ name: 'images', path: `${ROOT}/images`, isDir: true, kind: 'directory' }]);
    dirs.set(`${ROOT}/images`, [image(`${ROOT}/images`, 'tmnf.png'), image(`${ROOT}/images`, 'male-support.png')]);

    const { set, count } = await loadCustomEmoji(ROOT);
    expect(set.images).toEqual({
      tmnf: 'asset://localhost//emoji/images/tmnf.png',
      'male-support': 'asset://localhost//emoji/images/male-support.png',
    });
    expect(count).toBe(2);
  });

  it('reads a flat folder when there is no images/ subfolder', async () => {
    dirs.set(ROOT, [image(ROOT, 'jict.png')]);
    const { set } = await loadCustomEmoji(ROOT);
    expect(set.images).toHaveProperty('jict');
  });

  it('takes unicode entries from the manifest', async () => {
    dirs.set(ROOT, []);
    files.set(`${ROOT}/emoji.json`, JSON.stringify({ unicode: [{ name: 'flag-nz', char: '🇳🇿' }] }));

    const { set, count } = await loadCustomEmoji(ROOT);
    expect(set.unicode).toEqual({ 'flag-nz': '🇳🇿' });
    expect(count).toBe(1);
  });

  it('falls back to a same-named file when the manifest names a missing one', async () => {
    // The exported manifest says .gif but what was saved is .png — the common
    // case with a Slack export.
    dirs.set(ROOT, [{ name: 'images', path: `${ROOT}/images`, isDir: true, kind: 'directory' }]);
    dirs.set(`${ROOT}/images`, [image(`${ROOT}/images`, 'progress.png')]);
    files.set(`${ROOT}/emoji.json`, JSON.stringify({ images: [{ name: 'progress', file: 'progress.gif' }] }));

    const { set } = await loadCustomEmoji(ROOT);
    expect(set.images.progress).toBe('asset://localhost//emoji/images/progress.png');
  });

  it('honours a manifest entry that points at a differently named file', async () => {
    dirs.set(ROOT, [image(ROOT, 'raw-export-01.png')]);
    files.set(`${ROOT}/emoji.json`, JSON.stringify({ images: [{ name: 'jic', file: 'raw-export-01.png' }] }));

    const { set } = await loadCustomEmoji(ROOT);
    expect(set.images.jic).toBe('asset://localhost//emoji/raw-export-01.png');
    // The file is still reachable under its own name too.
    expect(set.images['raw-export-01']).toBe('asset://localhost//emoji/raw-export-01.png');
  });

  it('honours a custom image_dir', async () => {
    dirs.set(ROOT, [{ name: 'pics', path: `${ROOT}/pics`, isDir: true, kind: 'directory' }]);
    dirs.set(`${ROOT}/pics`, [image(`${ROOT}/pics`, 'falcon.png')]);
    files.set(`${ROOT}/emoji.json`, JSON.stringify({ image_dir: 'pics' }));

    const { set } = await loadCustomEmoji(ROOT);
    expect(set.images.falcon).toBe('asset://localhost//emoji/pics/falcon.png');
  });

  it('ignores an image_dir that tries to escape the chosen folder', async () => {
    dirs.set(ROOT, [image(ROOT, 'inside.png')]);
    files.set(`${ROOT}/emoji.json`, JSON.stringify({ image_dir: '../elsewhere' }));

    // Rejected outright, so the scan stays on the folder the user picked (the
    // only one inside the asset-protocol scope).
    const { set } = await loadCustomEmoji(ROOT);
    expect(set.images).toEqual({ inside: 'asset://localhost//emoji/inside.png' });
  });

  it('skips names that are not valid shortcodes', async () => {
    dirs.set(ROOT, [image(ROOT, 'has space.png'), image(ROOT, 'ok.png')]);
    files.set(
      `${ROOT}/emoji.json`,
      JSON.stringify({
        unicode: [
          { name: 'a:b', char: 'x' },
          { name: 42, char: 'y' },
        ],
      }),
    );

    const { set } = await loadCustomEmoji(ROOT);
    expect(Object.keys(set.images)).toEqual(['ok']);
    expect(set.unicode).toEqual({});
  });

  it('keeps a file whose name collides with an Object.prototype member', async () => {
    dirs.set(ROOT, [image(ROOT, 'constructor.png'), image(ROOT, 'toString.png')]);

    // On a plain object the `already claimed` check would report both as taken.
    const { set } = await loadCustomEmoji(ROOT);
    expect(set.images.constructor).toBe('asset://localhost//emoji/constructor.png');
    expect(set.images.toString).toBe('asset://localhost//emoji/toString.png');
  });

  it('ignores a malformed manifest but keeps the folder scan', async () => {
    dirs.set(ROOT, [image(ROOT, 'jic.png')]);
    files.set(`${ROOT}/emoji.json`, 'not json at all');

    const { set } = await loadCustomEmoji(ROOT);
    expect(set.images).toHaveProperty('jic');
  });

  it('ignores a manifest that exists but cannot be read', async () => {
    dirs.set(ROOT, [image(ROOT, 'jic.png')]);
    unreadable.add(`${ROOT}/emoji.json`);

    const { set } = await loadCustomEmoji(ROOT);
    expect(set.images).toHaveProperty('jic');
  });

  it('rejects when the folder itself cannot be listed', async () => {
    await expect(loadCustomEmoji('/missing')).rejects.toThrow();
  });
});
