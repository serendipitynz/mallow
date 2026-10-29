import { describe, expect, it } from 'vitest';
import {
  canGo,
  type FileViewState,
  MAX_REMEMBERED_VIEWS,
  MAX_VISITS,
  NO_VISITS,
  rememberedMode,
  rememberedView,
  rememberView,
  startFolder,
  travel,
  type Visits,
  visit,
} from './visit-history';

function visitAll(paths: string[], from: Visits = startFolder(NO_VISITS)): Visits {
  return paths.reduce(visit, from);
}

const all = async () => true;
const missing =
  (...gone: string[]) =>
  async (path: string) =>
    !gone.includes(path);

const STATE: FileViewState = { mode: 'source', anchor: { ratio: 0.5 } };

describe('visit', () => {
  it('appends and puts the cursor on the new entry', () => {
    const v = visitAll(['a', 'b']);
    expect(v.entries).toEqual(['a', 'b']);
    expect(v.cursor).toBe(1);
  });

  it('appends nothing for the file already on screen', () => {
    const v = visitAll(['a', 'b']);
    expect(visit(v, 'b')).toBe(v);
  });

  it('drops everything after the cursor', async () => {
    const back = (await travel(visitAll(['a', 'b', 'c']), 'back', all)).visits;
    const v = visit(back, 'd');
    expect(v.entries).toEqual(['a', 'b', 'd']);
    expect(canGo(v, 'forward')).toBe(false);
  });

  it(`keeps at most ${MAX_VISITS} entries, losing the oldest`, () => {
    const paths = Array.from({ length: MAX_VISITS + 5 }, (_, i) => `f${i}`);
    const v = visitAll(paths);
    expect(v.entries).toHaveLength(MAX_VISITS);
    expect(v.entries[0]).toBe('f5');
    expect(v.cursor).toBe(MAX_VISITS - 1);
  });
});

describe('travel', () => {
  it('moves back and forward without appending', async () => {
    const v = visitAll(['a', 'b', 'c']);
    const back = await travel(v, 'back', all);
    expect(back.path).toBe('b');
    expect(back.visits.entries).toEqual(['a', 'b', 'c']);
    const forward = await travel(back.visits, 'forward', all);
    expect(forward.path).toBe('c');
    expect(forward.visits.cursor).toBe(2);
  });

  it('goes nowhere at either end', async () => {
    const v = visitAll(['a']);
    expect(canGo(v, 'back')).toBe(false);
    expect(canGo(v, 'forward')).toBe(false);
    expect((await travel(v, 'back', all)).path).toBeNull();
    expect((await travel(NO_VISITS, 'forward', all)).path).toBeNull();
  });

  it('skips an entry whose file is gone, and drops it', async () => {
    const { path, visits } = await travel(visitAll(['a', 'gone', 'c']), 'back', missing('gone'));
    expect(path).toBe('a');
    expect(visits.entries).toEqual(['a', 'c']);
    expect(visits.cursor).toBe(0);
  });

  it('stays put when every entry in that direction is gone', async () => {
    const { path, visits } = await travel(visitAll(['x', 'y', 'c']), 'back', missing('x', 'y'));
    expect(path).toBeNull();
    expect(visits.entries).toEqual(['c']);
    expect(visits.cursor).toBe(0);
    expect(canGo(visits, 'back')).toBe(false);
  });

  /* Dropping `gone` from a, gone, a would leave a, a — and the next press would
     "move" to the file already on screen. */
  it('does not leave the file on screen as its own neighbour', async () => {
    const { path, visits } = await travel(visitAll(['a', 'gone', 'a']), 'back', missing('gone'));
    expect(path).toBeNull();
    expect(visits.entries).toEqual(['a']);
    expect(visits.cursor).toBe(0);

    const from = (await travel(visitAll(['a', 'gone', 'a']), 'back', all)).visits;
    const start = (await travel(from, 'back', all)).visits;
    const forward = await travel(start, 'forward', missing('gone'));
    expect(forward.path).toBeNull();
    expect(forward.visits.entries).toEqual(['a']);
  });

  it('keeps the cursor on its file when a skip removes entries before it', async () => {
    const { path, visits } = await travel(visitAll(['b', 'a', 'x', 'y', 'a']), 'back', missing('x', 'y'));
    expect(path).toBe('b');
    expect(visits.entries).toEqual(['b', 'a']);
    expect(visits.cursor).toBe(0);
  });
});

describe('the folder changing', () => {
  it('empties the history and the view state, and moves the epoch on', () => {
    const v = rememberView(visitAll(['a', 'b']), 1, 'a', STATE);
    const next = startFolder(v);
    expect(next.entries).toEqual([]);
    expect(next.cursor).toBe(-1);
    expect(rememberedView(next, 'a')).toBeNull();
    expect(next.epoch).toBe(v.epoch + 1);
  });

  /* The view on screen when the folder changes is unmounted by that change, and
     reports after it — with the epoch it was shown under. */
  it('ignores a view reporting from the previous folder', () => {
    const before = visitAll(['/root/sub/a']);
    const after = startFolder(before);
    expect(rememberView(after, before.epoch, '/root/sub/a', STATE)).toBe(after);
  });
});

describe('rememberView', () => {
  it('remembers per file, the latest report winning', () => {
    let v = visitAll(['a']);
    v = rememberView(v, v.epoch, 'a', STATE);
    v = rememberView(v, v.epoch, 'a', { mode: 'preview', anchor: null });
    expect(rememberedView(v, 'a')).toEqual({ mode: 'preview', anchor: null });
  });

  it(`keeps at most ${MAX_REMEMBERED_VIEWS} files, losing the one left longest ago`, () => {
    let v = startFolder(NO_VISITS);
    for (let i = 0; i < MAX_REMEMBERED_VIEWS + 1; i++) {
      v = rememberView(v, v.epoch, `f${i}`, STATE);
    }
    expect(v.views.size).toBe(MAX_REMEMBERED_VIEWS);
    expect(rememberedView(v, 'f0')).toBeNull();
    expect(rememberedView(v, 'f1')).not.toBeNull();
  });

  it('never forgets a file the history can still reach', () => {
    let v = visitAll(['kept']);
    v = rememberView(v, v.epoch, 'kept', STATE);
    for (let i = 0; i < MAX_REMEMBERED_VIEWS + 10; i++) {
      v = rememberView(v, v.epoch, `f${i}`, STATE);
    }
    expect(v.views.size).toBe(MAX_REMEMBERED_VIEWS);
    expect(rememberedView(v, 'kept')).toEqual(STATE);
  });
});

describe('rememberedMode', () => {
  it('hands back a mode the view offers', () => {
    expect(rememberedMode(STATE, ['tree', 'source'] as const)).toBe('source');
  });

  /* A `.plist` reaches ConfigView or XmlView by its text, and either can be
     what the record was written by; a value neither offers falls to the view's
     default. */
  it('answers null for a mode the view does not offer, or none', () => {
    expect(rememberedMode({ mode: 'preview', anchor: null }, ['tree', 'source'] as const)).toBeNull();
    expect(rememberedMode({ mode: null, anchor: null }, ['tree', 'source'] as const)).toBeNull();
    expect(rememberedMode(null, ['tree', 'source'] as const)).toBeNull();
  });
});
