import { describe, expect, it } from 'vitest';
import type { ChordEvent, HandledChordEvent } from './chord';
import { CLOSE_WINDOW_CHORD_KEY, createCloseWindowChordHandler } from './close-window';

/* `lib/chord` covers the mechanism. What is left here is the composition that
   ships: this handler answers `CmdOrCtrl+W`, it acts on every press rather than
   reading a view's gate, and it takes the chord off the platform — which is the
   whole reason it exists, since the menu accelerator alone did not close a window
   on Windows. */
function harness(onMac = true) {
  const calls = { prevented: 0, closed: 0 };
  const handler = createCloseWindowChordHandler({
    onMac,
    closeWindow: () => {
      calls.closed += 1;
    },
  });
  const fire = (over: Partial<ChordEvent> = {}) => {
    const event: HandledChordEvent = {
      key: 'w',
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

describe('the close-window chord', () => {
  it('is CmdOrCtrl+W', () => {
    expect(CLOSE_WINDOW_CHORD_KEY).toBe('w');
  });

  /* The measured case: on Windows this handler is what closes the window, since
     the menu item's own accelerator never arrives. */
  it('takes Ctrl+W off the platform on Windows and Linux', () => {
    const { calls, fire } = harness(false);
    fire({ ctrlKey: true });
    expect(calls).toEqual({ prevented: 1, closed: 1 });
  });

  it('closes and consumes the keystroke', () => {
    const { calls, fire } = harness();
    fire({ metaKey: true });
    expect(calls).toEqual({ prevented: 1, closed: 1 });
  });

  /* Like New Window and unlike the two print entries, nothing on screen can turn
     this one off. */
  it('closes with no document open', () => {
    const { calls, fire } = harness();
    fire({ metaKey: true });
    expect(calls).toEqual({ prevented: 1, closed: 1 });
  });

  /* decision-4 gives `CmdOrCtrl+Shift+W` to Close Window once tabs land, so it
     must not already answer to it. */
  it('leaves CmdOrCtrl+Shift+W alone', () => {
    const { calls, fire } = harness();
    fire({ metaKey: true, shiftKey: true });
    expect(calls).toEqual({ prevented: 0, closed: 0 });
  });

  it('leaves an unmodified W to the document', () => {
    const { calls, fire } = harness();
    fire();
    expect(calls).toEqual({ prevented: 0, closed: 0 });
  });

  it('leaves the other three chords alone', () => {
    const { calls, fire } = harness();
    fire({ key: 'n', metaKey: true });
    fire({ key: 'p', metaKey: true });
    fire({ key: 'e', metaKey: true });
    expect(calls).toEqual({ prevented: 0, closed: 0 });
  });
});
