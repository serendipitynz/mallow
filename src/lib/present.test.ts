import { afterEach, describe, expect, it } from 'vitest';
import type { ChordEvent, HandledChordEvent } from './chord';
import {
  createPresentChordHandler,
  isPresentAvailable,
  type PresentPlace,
  presentChord,
  setPresenter,
} from './present';

const key = (over: Partial<ChordEvent>): ChordEvent => ({
  key: 'Enter',
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...over,
});

describe('presentChord', () => {
  it('reads Cmd+Enter on macOS and Ctrl+Enter elsewhere, Shift for the window', () => {
    expect(presentChord(key({ metaKey: true }), true)).toBe('fullscreen');
    expect(presentChord(key({ metaKey: true, shiftKey: true }), true)).toBe('window');
    expect(presentChord(key({ ctrlKey: true }), false)).toBe('fullscreen');
    expect(presentChord(key({ ctrlKey: true, shiftKey: true }), false)).toBe('window');
  });

  it('takes neither the other platform’s modifier, nor Alt, nor a bare Enter', () => {
    expect(presentChord(key({ ctrlKey: true }), true)).toBeNull();
    expect(presentChord(key({ metaKey: true }), false)).toBeNull();
    expect(presentChord(key({ metaKey: true, altKey: true }), true)).toBeNull();
    expect(presentChord(key({}), true)).toBeNull();
    expect(presentChord(key({ metaKey: true, key: 'e' }), true)).toBeNull();
  });
});

describe('the present chord handler', () => {
  const releases: (() => void)[] = [];
  afterEach(() => {
    for (const release of releases.splice(0)) {
      release();
    }
  });

  function fire(handler: (event: HandledChordEvent) => void, over: Partial<ChordEvent>) {
    let prevented = false;
    handler({
      ...key(over),
      preventDefault: () => {
        prevented = true;
      },
    });
    return prevented;
  }

  it('presents where a deck is shown, in the place the chord asks for', () => {
    const asked: PresentPlace[] = [];
    releases.push(setPresenter((place) => asked.push(place)));
    const handler = createPresentChordHandler({ onMac: true, isAllowed: isPresentAvailable });
    expect(fire(handler, { metaKey: true })).toBe(true);
    expect(fire(handler, { metaKey: true, shiftKey: true })).toBe(true);
    expect(asked).toEqual(['fullscreen', 'window']);
  });

  it('consumes the chord where no deck is shown, and presents nothing', () => {
    const handler = createPresentChordHandler({ onMac: false, isAllowed: isPresentAvailable });
    expect(isPresentAvailable()).toBe(false);
    expect(fire(handler, { ctrlKey: true })).toBe(true);
  });

  it('leaves every other key alone', () => {
    const handler = createPresentChordHandler({ onMac: true, isAllowed: () => true });
    expect(fire(handler, { metaKey: true, key: 'p' })).toBe(false);
  });

  it('is not cleared by the release of a presenter that was replaced', () => {
    const releaseFirst = setPresenter(() => {});
    releases.push(setPresenter(() => {}));
    releaseFirst();
    expect(isPresentAvailable()).toBe(true);
  });
});
