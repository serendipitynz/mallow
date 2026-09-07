import { beforeEach, describe, expect, it } from 'vitest';
import type { ChordEvent } from './chord';
import { isPrintablePreview, printChordAction, setPrintablePreview } from './print';

function chord(over: Partial<ChordEvent> = {}): ChordEvent {
  return { key: 'p', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...over };
}

const macPrint = chord({ metaKey: true });
const otherPrint = chord({ ctrlKey: true });

describe('printChordAction', () => {
  it('prints the chord where a markdown preview is on screen', () => {
    expect(printChordAction(macPrint, true, true)).toBe('print');
    expect(printChordAction(otherPrint, false, true)).toBe('print');
  });

  /* The case the earlier design had no name for, and the bug it produced. The
     handler lived in the printable view, so an unprintable one registered
     nothing — and on Windows, WebView2's own Ctrl+P then printed a `.csv` table
     (measured 2026-09-07). `suppress` is what has to happen instead: consume the
     chord so no native binding can act on it, and do not print. */
  it('suppresses the chord where no markdown preview is on screen', () => {
    expect(printChordAction(macPrint, true, false)).toBe('suppress');
    expect(printChordAction(otherPrint, false, false)).toBe('suppress');
  });

  // Anything that is not the chord has to be left alone in both states, or the
  // handler would swallow keystrokes that belong to the document or the OS.
  it('ignores every other chord, printable or not', () => {
    for (const printable of [true, false]) {
      expect(printChordAction(chord({ key: 'o', metaKey: true }), true, printable)).toBe('ignore');
      expect(printChordAction(chord({ metaKey: true, shiftKey: true }), true, printable)).toBe('ignore');
      expect(printChordAction(chord(), true, printable)).toBe('ignore');
      // The other platform's modifier is not this platform's chord.
      expect(printChordAction(otherPrint, true, printable)).toBe('ignore');
      expect(printChordAction(macPrint, false, printable)).toBe('ignore');
    }
  });
});

describe('the printable-preview flag', () => {
  beforeEach(() => {
    setPrintablePreview(false);
  });

  it('starts false, so a chord pressed before any view mounts is suppressed', () => {
    expect(isPrintablePreview()).toBe(false);
    expect(printChordAction(macPrint, true, isPrintablePreview())).toBe('suppress');
  });

  it('follows the view in and out', () => {
    setPrintablePreview(true);
    expect(printChordAction(macPrint, true, isPrintablePreview())).toBe('print');
    setPrintablePreview(false);
    expect(printChordAction(macPrint, true, isPrintablePreview())).toBe('suppress');
  });
});
