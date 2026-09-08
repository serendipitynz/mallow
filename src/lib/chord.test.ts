import { describe, expect, it } from 'vitest';
import { type ChordEvent, chordAction, createChordHandler, type HandledChordEvent, matchesCmdOrCtrl } from './chord';

function chord(over: Partial<ChordEvent> = {}): ChordEvent {
  return { key: 'p', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...over };
}

describe('matchesCmdOrCtrl', () => {
  it('accepts the platform primary modifier and only that one', () => {
    expect(matchesCmdOrCtrl(chord({ metaKey: true }), 'p', true)).toBe(true);
    expect(matchesCmdOrCtrl(chord({ ctrlKey: true }), 'p', false)).toBe(true);
  });

  /* The bug this file exists for: `metaKey || ctrlKey` accepted the other
     platform's modifier too, so Ctrl+P printed on macOS — where it is the
     WebView's emacs-style "previous line" in a text field — and Meta+P printed
     on Windows and Linux. Neither is a chord `CmdOrCtrl+P` can produce. */
  it('rejects the other platform primary modifier', () => {
    expect(matchesCmdOrCtrl(chord({ ctrlKey: true }), 'p', true)).toBe(false);
    expect(matchesCmdOrCtrl(chord({ metaKey: true }), 'p', false)).toBe(false);
  });

  it('rejects both primary modifiers held together', () => {
    const both = chord({ metaKey: true, ctrlKey: true });
    expect(matchesCmdOrCtrl(both, 'p', true)).toBe(false);
    expect(matchesCmdOrCtrl(both, 'p', false)).toBe(false);
  });

  it('rejects the chord with shift or alt added', () => {
    expect(matchesCmdOrCtrl(chord({ metaKey: true, shiftKey: true }), 'p', true)).toBe(false);
    expect(matchesCmdOrCtrl(chord({ metaKey: true, altKey: true }), 'p', true)).toBe(false);
    expect(matchesCmdOrCtrl(chord({ ctrlKey: true, shiftKey: true }), 'p', false)).toBe(false);
    expect(matchesCmdOrCtrl(chord({ ctrlKey: true, altKey: true }), 'p', false)).toBe(false);
  });

  it('rejects the key with no modifier at all', () => {
    expect(matchesCmdOrCtrl(chord(), 'p', true)).toBe(false);
    expect(matchesCmdOrCtrl(chord(), 'p', false)).toBe(false);
  });

  it('rejects a different key under the primary modifier', () => {
    expect(matchesCmdOrCtrl(chord({ key: 'o', metaKey: true }), 'p', true)).toBe(false);
    expect(matchesCmdOrCtrl(chord({ key: ',', ctrlKey: true }), 'p', false)).toBe(false);
  });

  // Caps lock reports the upper-case letter with shiftKey false, so a strict
  // comparison would leave those users unable to reach the shortcut at all.
  it('accepts the upper-case key caps lock reports without shift', () => {
    expect(matchesCmdOrCtrl(chord({ key: 'P', metaKey: true }), 'p', true)).toBe(true);
    expect(matchesCmdOrCtrl(chord({ key: 'P', ctrlKey: true }), 'p', false)).toBe(true);
  });
});

describe('chordAction', () => {
  const macChord = chord({ metaKey: true });
  const otherChord = chord({ ctrlKey: true });

  it('acts on the chord where the app allows it', () => {
    expect(chordAction(macChord, 'p', true, true)).toBe('act');
    expect(chordAction(otherChord, 'p', false, true)).toBe('act');
  });

  /* The case a boolean had no room for, and the bug it produced. Printing's
     handler lived in the printable view, so an unprintable one registered
     nothing — and on Windows, WebView2's own Ctrl+P then printed a `.csv` table
     (measured 2026-09-07). `suppress` is what has to happen instead: consume the
     chord so no native binding can act on it, and do nothing. */
  it('suppresses the chord where the app does not allow it', () => {
    expect(chordAction(macChord, 'p', true, false)).toBe('suppress');
    expect(chordAction(otherChord, 'p', false, false)).toBe('suppress');
  });

  // Anything that is not the chord has to be left alone in both states, or the
  // handler would swallow keystrokes belonging to the document or the OS.
  it('ignores every other keystroke, allowed or not', () => {
    for (const allowed of [true, false]) {
      expect(chordAction(chord({ key: 'o', metaKey: true }), 'p', true, allowed)).toBe('ignore');
      expect(chordAction(chord({ metaKey: true, shiftKey: true }), 'p', true, allowed)).toBe('ignore');
      expect(chordAction(chord(), 'p', true, allowed)).toBe('ignore');
      // The other platform's modifier is not this platform's chord.
      expect(chordAction(otherChord, 'p', true, allowed)).toBe('ignore');
      expect(chordAction(macChord, 'p', false, allowed)).toBe('ignore');
    }
  });

  // Two chords are bound on the same key set, so a handler answering the wrong
  // letter would be one entry doing another's work.
  it('answers only the key it was given', () => {
    expect(chordAction(chord({ key: 'e', metaKey: true }), 'e', true, true)).toBe('act');
    expect(chordAction(chord({ key: 'e', metaKey: true }), 'p', true, true)).toBe('ignore');
    expect(chordAction(chord({ key: 'p', metaKey: true }), 'e', true, true)).toBe('ignore');
  });
});

/* The classification being right is not the property that was broken. What
   shipped was a chord that reached WebView2's own Ctrl+P, so what has to be
   covered is what the handler *does* with the event: whether it consumes it, and
   whether it acts. A test that only asserted `suppress` stayed green through
   that bug. */
describe('createChordHandler', () => {
  function harness(allowed: boolean, onMac = true) {
    const calls = { prevented: 0, acted: 0 };
    const handler = createChordHandler({
      key: 'p',
      onMac,
      isAllowed: () => allowed,
      act: () => {
        calls.acted += 1;
      },
    });
    const fire = (over: Partial<ChordEvent> = {}) => {
      const event: HandledChordEvent = {
        ...chord(over),
        preventDefault: () => {
          calls.prevented += 1;
        },
      };
      handler(event);
    };
    return { calls, fire };
  }

  it('consumes the chord and acts where the app allows it', () => {
    const { calls, fire } = harness(true);
    fire({ metaKey: true });
    expect(calls).toEqual({ prevented: 1, acted: 1 });
  });

  // The regression this shape exists for: the chord must be consumed even though
  // nothing happens, or the platform's own binding acts on it.
  it('consumes the chord and does NOT act where the app does not allow it', () => {
    const { calls, fire } = harness(false);
    fire({ metaKey: true });
    expect(calls).toEqual({ prevented: 1, acted: 0 });
  });

  it('leaves every other keystroke untouched, allowed or not', () => {
    for (const allowed of [true, false]) {
      const { calls, fire } = harness(allowed);
      fire();
      fire({ key: 'o', metaKey: true });
      fire({ metaKey: true, shiftKey: true });
      fire({ ctrlKey: true }); // the other platform's modifier
      expect(calls).toEqual({ prevented: 0, acted: 0 });
    }
  });

  // The condition is read when the key is pressed, not when the handler is built
  // - the handler outlives every view, so a snapshot would go stale on the first
  // navigation.
  it('reads the allowed state at each keystroke', () => {
    const calls = { prevented: 0, acted: 0 };
    let allowed = false;
    const handler = createChordHandler({
      key: 'p',
      onMac: true,
      isAllowed: () => allowed,
      act: () => {
        calls.acted += 1;
      },
    });
    const fire = () =>
      handler({
        ...chord({ metaKey: true }),
        preventDefault: () => {
          calls.prevented += 1;
        },
      });

    fire();
    expect(calls).toEqual({ prevented: 1, acted: 0 });
    allowed = true;
    fire();
    expect(calls).toEqual({ prevented: 2, acted: 1 });
  });
});
