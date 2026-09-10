import { describe, expect, it } from 'vitest';
import type { ChordEvent, HandledChordEvent } from './chord';
import { createNewWindowChordHandler, NEW_WINDOW_CHORD_KEY } from './new-window';

/* `lib/chord` covers the mechanism. What is left here is the composition that
   ships: this handler answers `CmdOrCtrl+N`, it acts on every press rather than
   reading a view's gate, and it takes the chord off the platform whatever else is
   on screen. */
function harness(onMac = true) {
  const calls = { prevented: 0, opened: 0 };
  const handler = createNewWindowChordHandler({
    onMac,
    newWindow: () => {
      calls.opened += 1;
    },
  });
  const fire = (over: Partial<ChordEvent> = {}) => {
    const event: HandledChordEvent = {
      key: 'n',
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

describe('the new-window chord', () => {
  it('is CmdOrCtrl+N', () => {
    expect(NEW_WINDOW_CHORD_KEY).toBe('n');
  });

  it('opens a window and consumes the keystroke', () => {
    const { calls, fire } = harness();
    fire({ metaKey: true });
    expect(calls).toEqual({ prevented: 1, opened: 1 });
  });

  /* The difference from `Print…` and `Export as PDF…`: those go inert with no
     markdown preview on screen. A new window depends on nothing displayed, so
     there is no state in which this one stops working. */
  it('opens a window with no document open', () => {
    const { calls, fire } = harness();
    fire({ metaKey: true });
    fire({ metaKey: true });
    expect(calls).toEqual({ prevented: 2, opened: 2 });
  });

  it('takes Ctrl+N off the platform on Windows and Linux', () => {
    const { calls, fire } = harness(false);
    fire({ ctrlKey: true });
    expect(calls).toEqual({ prevented: 1, opened: 1 });
  });

  it('leaves an unmodified N to the document', () => {
    const { calls, fire } = harness();
    fire();
    expect(calls).toEqual({ prevented: 0, opened: 0 });
  });

  it('leaves the print and PDF export chords alone', () => {
    const { calls, fire } = harness();
    fire({ key: 'p', metaKey: true });
    fire({ key: 'e', metaKey: true });
    expect(calls).toEqual({ prevented: 0, opened: 0 });
  });
});
