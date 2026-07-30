/**
 * Loads a user-provided custom emoji set from a folder, so Slack-style
 * shortcodes (`:tmnf:`, `:male-support:`) render as pictures instead of staying
 * literal text.
 *
 * Folder layout (all parts optional):
 *
 *     <folder>/emoji.json     manifest: { image_dir, images: [{name, file}], unicode: [{name, char}] }
 *     <folder>/images/*.png   the pictures themselves
 *
 * The images on disk are the source of truth, not the manifest: an exported
 * manifest routinely disagrees with what was actually downloaded (a `.gif`
 * listed but a `.png` saved), and a folder with no manifest at all should still
 * work — dropping `foo.png` in is enough to get `:foo:`. So the folder is
 * scanned and the manifest only supplies unicode entries plus a preferred file
 * per name. Everything is resolved here rather than in `lib/markdown` to keep
 * that module free of Tauri APIs.
 */
import { convertFileSrc } from '@tauri-apps/api/core';
import type { CustomEmojiSet } from './markdown';
import { join } from './path';
import { allowMediaDir, pathExists, readDirTree, readFile } from './tauri';

const MANIFEST_NAME = 'emoji.json';
const DEFAULT_IMAGE_DIR = 'images';

/** Shortcode syntax accepted by markdown-it-emoji in practice, and narrow enough
 *  that a name can never smuggle path or markup characters into the output. */
const NAME_RE = /^[a-z0-9][a-z0-9_+-]*$/i;

/** Guards against a runaway substitution string in a hand-edited manifest. */
const MAX_CHAR_LENGTH = 32;

interface Manifest {
  image_dir?: unknown;
  images?: unknown;
  unicode?: unknown;
}

export interface CustomEmojiLoad {
  set: CustomEmojiSet;
  /** How many shortcodes are usable, for the settings screen. */
  count: number;
}

/** What the settings screen reports about the configured folder. */
export interface CustomEmojiStatus {
  dir: string | null;
  count: number;
  error: string | null;
}

export const NO_CUSTOM_EMOJI: CustomEmojiStatus = { dir: null, count: 0, error: null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validName(value: unknown): value is string {
  return typeof value === 'string' && NAME_RE.test(value);
}

/** A single plain folder name — rejects `..`, absolute paths and nesting, so a
 *  manifest cannot point the scan outside the folder the user picked (and thus
 *  outside the asset-protocol scope granted for it). */
function safeDirName(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && !/[/\\]|^\.+$/.test(value) ? value : null;
}

/** The manifest, or null when there is none / it is unreadable or malformed.
 *  A missing manifest is the normal case for a plain folder of images. */
async function readManifest(path: string): Promise<Manifest | null> {
  if (!(await pathExists(path))) return null;
  try {
    const parsed: unknown = JSON.parse(await readFile(path));
    return isRecord(parsed) ? parsed : null;
  } catch (e) {
    console.error(`Ignoring unreadable ${MANIFEST_NAME}`, e);
    return null;
  }
}

/** Image files directly inside `dir`, indexed both by file name and by the name
 *  without its extension (which is the shortcode). */
async function scanImages(dir: string): Promise<{ byFile: Map<string, string>; byStem: Map<string, string> }> {
  const byFile = new Map<string, string>();
  const byStem = new Map<string, string>();
  for (const entry of await readDirTree(dir)) {
    if (entry.isDir || entry.kind !== 'image') continue;
    byFile.set(entry.name, entry.path);
    const stem = entry.name.replace(/\.[^.]+$/, '');
    // First file wins when two extensions share a stem, so the set is stable.
    if (!byStem.has(stem)) byStem.set(stem, entry.path);
  }
  return { byFile, byStem };
}

/**
 * Read `dir` into a set of shortcode definitions. Rejects with the underlying
 * error when the folder itself cannot be listed; a missing or broken manifest is
 * tolerated and simply yields whatever the folder scan found.
 */
export async function loadCustomEmoji(dir: string): Promise<CustomEmojiLoad> {
  // The images are served to the WebView over the asset protocol, whose scope
  // starts empty — without this the <img> URLs resolve to nothing.
  await allowMediaDir(dir);

  const manifest = await readManifest(join(dir, MANIFEST_NAME));
  const declaredDir = join(dir, safeDirName(manifest?.image_dir) ?? DEFAULT_IMAGE_DIR);
  // A flat folder of images (no `images/` subfolder) is equally valid.
  const imageDir = (await pathExists(declaredDir)) ? declaredDir : dir;
  const { byFile, byStem } = await scanImages(imageDir);

  const images: Record<string, string> = {};
  // Manifest entries first: they get to pick which file backs their name.
  if (Array.isArray(manifest?.images)) {
    for (const entry of manifest.images) {
      if (!isRecord(entry) || !validName(entry.name)) continue;
      const path = (typeof entry.file === 'string' ? byFile.get(entry.file) : undefined) ?? byStem.get(entry.name);
      if (path) images[entry.name] = convertFileSrc(path);
    }
  }
  // Then everything else in the folder, so an image can be added without
  // touching the manifest.
  for (const [stem, path] of byStem) {
    if (validName(stem) && !(stem in images)) images[stem] = convertFileSrc(path);
  }

  const unicode: Record<string, string> = {};
  if (Array.isArray(manifest?.unicode)) {
    for (const entry of manifest.unicode) {
      if (!isRecord(entry) || !validName(entry.name)) continue;
      const { char } = entry;
      if (typeof char !== 'string' || char.length === 0 || char.length > MAX_CHAR_LENGTH) continue;
      unicode[entry.name] = char;
    }
  }

  const set: CustomEmojiSet = { unicode, images };
  return { set, count: Object.keys(images).length + Object.keys(unicode).length };
}
