import { beforeEach, describe, expect, it } from 'vitest';
import type { ChordEvent, HandledChordEvent } from './chord';
import { setMarkdownPreviewActive } from './markdown-preview';
import { createPrintChordHandler, PRINT_CHORD_KEY } from './print';

/* `lib/chord` covers the mechanism — the three outcomes and what the handler does
   with the event. What is left here is the composition that actually ships: this
   handler answers `CmdOrCtrl+P`, it reads the shared markdown-preview gate rather
   than a copy of it, and an unprintable view still costs the platform the chord.
   Getting any of the three wrong is invisible to the mechanism's own tests. */
function harness(onMac = true) {
  const calls = { prevented: 0, printed: 0 };
  const handler = createPrintChordHandler({
    onMac,
    print: () => {
      calls.printed += 1;
    },
  });
  const fire = (over: Partial<ChordEvent> = {}) => {
    const event: HandledChordEvent = {
      key: 'p',
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      ...over,
      preventDefault: () => {
        calls.prevented += 1;
      },
    };
    handler(event);
  };
  return { calls, fire };
}

describe('the print chord', () => {
  beforeEach(() => {
    setMarkdownPreviewActive(false);
  });

  it('is CmdOrCtrl+P', () => {
    expect(PRINT_CHORD_KEY).toBe('p');
  });

  it('prints where a markdown preview is on screen', () => {
    setMarkdownPreviewActive(true);
    const { calls, fire } = harness();
    fire({ metaKey: true });
    expect(calls).toEqual({ prevented: 1, printed: 1 });
  });

  /* The regression the app-wide handler exists for. Measured on Windows
     2026-09-07: with a `.csv` open the chord reached WebView2's own Ctrl+P, which
     printed the table. Consuming it is what makes it inert. */
  it('consumes the chord without printing where no markdown preview is on screen', () => {
    const { calls, fire } = harness();
    fire({ metaKey: true });
    expect(calls).toEqual({ prevented: 1, printed: 0 });
  });

  it('is inert before any view mounts, rather than printing', () => {
    const { calls, fire } = harness();
    fire({ metaKey: true });
    expect(calls).toEqual({ prevented: 1, printed: 0 });
  });

  it('follows the view in and out without being rebuilt', () => {
    const { calls, fire } = harness();
    setMarkdownPreviewActive(true);
    fire({ metaKey: true });
    setMarkdownPreviewActive(false);
    fire({ metaKey: true });
    expect(calls).toEqual({ prevented: 2, printed: 1 });
  });

  it('leaves the PDF export chord alone', () => {
    setMarkdownPreviewActive(true);
    const { calls, fire } = harness();
    fire({ key: 'e', metaKey: true });
    expect(calls).toEqual({ prevented: 0, printed: 0 });
  });
});
