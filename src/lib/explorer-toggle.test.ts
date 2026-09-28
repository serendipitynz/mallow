import { describe, expect, it } from 'vitest';
import type { ChordEvent, HandledChordEvent } from './chord';
import { createToggleExplorerChordHandler, TOGGLE_EXPLORER_CHORD_KEY } from './explorer-toggle';

function harness(onMac = true) {
  const calls = { prevented: 0, toggled: 0 };
  const handler = createToggleExplorerChordHandler({
    onMac,
    toggleExplorer: () => {
      calls.toggled += 1;
    },
  });
  const fire = (over: Partial<ChordEvent> = {}) => {
    const event: HandledChordEvent = {
      key: 'b',
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

describe('the explorer toggle chord', () => {
  it('is CmdOrCtrl+B', () => {
    expect(TOGGLE_EXPLORER_CHORD_KEY).toBe('b');
  });

  it('toggles on every press and consumes each one', () => {
    const { calls, fire } = harness();
    fire({ metaKey: true });
    fire({ metaKey: true });
    expect(calls).toEqual({ prevented: 2, toggled: 2 });
  });

  it('takes Ctrl+B off the platform on Windows and Linux', () => {
    const { calls, fire } = harness(false);
    fire({ ctrlKey: true });
    expect(calls).toEqual({ prevented: 1, toggled: 1 });
  });

  it('leaves an unmodified B, and Shift or Alt with the chord, to the document', () => {
    const { calls, fire } = harness();
    fire();
    fire({ metaKey: true, shiftKey: true });
    fire({ metaKey: true, altKey: true });
    expect(calls).toEqual({ prevented: 0, toggled: 0 });
  });

  it('leaves Ctrl+B alone on macOS, where it is not the platform modifier', () => {
    const { calls, fire } = harness();
    fire({ ctrlKey: true });
    expect(calls).toEqual({ prevented: 0, toggled: 0 });
  });
});
