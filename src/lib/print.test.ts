import { beforeEach, describe, expect, it } from 'vitest';
import type { ChordEvent } from './chord';
import {
  createPrintChordHandler,
  isPrintablePreview,
  type PrintChordEvent,
  printChordAction,
  setPrintablePreview,
} from './print';

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

/* The classifier being right is not the property that was broken. What shipped
   was a chord that reached WebView2's own Ctrl+P, so what has to be covered is
   what the handler *does* with the event: whether it consumes it, and whether it
   prints. A test that only asserted `suppress` stayed green through that bug. */
describe('createPrintChordHandler', () => {
  function harness(printable: boolean, onMac = true) {
    const calls = { prevented: 0, printed: 0 };
    const handler = createPrintChordHandler({
      onMac,
      isPrintable: () => printable,
      print: () => {
        calls.printed += 1;
      },
    });
    const fire = (over: Partial<ChordEvent> = {}) => {
      const event: PrintChordEvent = {
        ...chord(over),
        preventDefault: () => {
          calls.prevented += 1;
        },
      };
      handler(event);
    };
    return { calls, fire };
  }

  it('consumes the chord and prints where a preview is on screen', () => {
    const { calls, fire } = harness(true);
    fire({ metaKey: true });
    expect(calls).toEqual({ prevented: 1, printed: 1 });
  });

  // The regression this module exists for: the chord must be consumed even
  // though nothing is printed, or the platform's own binding acts on it.
  it('consumes the chord and does NOT print where no preview is on screen', () => {
    const { calls, fire } = harness(false);
    fire({ metaKey: true });
    expect(calls).toEqual({ prevented: 1, printed: 0 });
  });

  it('leaves every other keystroke untouched, printable or not', () => {
    for (const printable of [true, false]) {
      const { calls, fire } = harness(printable);
      fire();
      fire({ key: 'o', metaKey: true });
      fire({ metaKey: true, shiftKey: true });
      fire({ ctrlKey: true }); // the other platform's modifier
      expect(calls).toEqual({ prevented: 0, printed: 0 });
    }
  });

  // The flag is read when the key is pressed, not when the handler is built -
  // the handler outlives every view, so a snapshot would go stale on the first
  // navigation.
  it('reads the printable state at each keystroke', () => {
    const calls = { prevented: 0, printed: 0 };
    let printable = false;
    const handler = createPrintChordHandler({
      onMac: true,
      isPrintable: () => printable,
      print: () => {
        calls.printed += 1;
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
    expect(calls).toEqual({ prevented: 1, printed: 0 });
    printable = true;
    fire();
    expect(calls).toEqual({ prevented: 2, printed: 1 });
  });
});
