import { describe, expect, it } from 'vitest';
import { type ChordEvent, matchesCmdOrCtrl } from './chord';

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
