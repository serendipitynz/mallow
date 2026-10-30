import { describe, expect, it } from 'vitest';
import type { ChordEvent, HandledChordEvent } from './chord';
import {
  createHistoryButtonHandler,
  createHistoryChordHandler,
  type HandledButtonEvent,
  historyButtonDirection,
  historyChordDirection,
  historyChordLabel,
} from './history-nav';
import type { Direction } from './visit-history';

const NONE: ChordEvent = { key: '', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

describe('historyChordDirection', () => {
  it('is Cmd+[ / Cmd+] on macOS', () => {
    expect(historyChordDirection({ ...NONE, key: '[', metaKey: true }, true)).toBe('back');
    expect(historyChordDirection({ ...NONE, key: ']', metaKey: true }, true)).toBe('forward');
  });

  it('is Alt+Left / Alt+Right on Windows and Linux', () => {
    expect(historyChordDirection({ ...NONE, key: 'ArrowLeft', altKey: true }, false)).toBe('back');
    expect(historyChordDirection({ ...NONE, key: 'ArrowRight', altKey: true }, false)).toBe('forward');
  });

  /* Each platform's chord is the other's ordinary keystroke: Alt+Left moves by
     word in a macOS text field, and Ctrl+[ is Escape in a terminal. */
  it('does not take the other platform’s chord', () => {
    expect(historyChordDirection({ ...NONE, key: 'ArrowLeft', altKey: true }, true)).toBeNull();
    expect(historyChordDirection({ ...NONE, key: '[', metaKey: true }, false)).toBeNull();
    expect(historyChordDirection({ ...NONE, key: '[', ctrlKey: true }, false)).toBeNull();
  });

  it('needs the modifier alone', () => {
    expect(historyChordDirection({ ...NONE, key: '[', metaKey: true, shiftKey: true }, true)).toBeNull();
    expect(historyChordDirection({ ...NONE, key: '[', metaKey: true, ctrlKey: true }, true)).toBeNull();
    expect(historyChordDirection({ ...NONE, key: 'ArrowLeft', altKey: true, ctrlKey: true }, false)).toBeNull();
    expect(historyChordDirection({ ...NONE, key: 'ArrowLeft' }, false)).toBeNull();
    expect(historyChordDirection({ ...NONE, key: '[' }, true)).toBeNull();
  });
});

describe('historyChordLabel', () => {
  it('names the chord each platform reads', () => {
    expect(historyChordLabel('back', true)).toBe('⌘[');
    expect(historyChordLabel('forward', true)).toBe('⌘]');
    expect(historyChordLabel('back', false)).toBe('Alt+←');
    expect(historyChordLabel('forward', false)).toBe('Alt+→');
  });
});

function chordHarness(onMac: boolean) {
  const calls = { prevented: 0, moves: [] as Direction[] };
  const handler = createHistoryChordHandler({ onMac, go: (direction) => calls.moves.push(direction) });
  const fire = (over: Partial<ChordEvent>) => {
    const event: HandledChordEvent = {
      ...NONE,
      ...over,
      preventDefault: () => {
        calls.prevented += 1;
      },
    };
    handler(event);
  };
  return { calls, fire };
}

describe('the history chord handler', () => {
  /* AC #3: WebView2's own Alt+Left must never reach the shell, whether or not
     the history has anywhere to go — the move itself is what answers that. */
  it('takes Alt+Left off the platform on Windows and Linux', () => {
    const { calls, fire } = chordHarness(false);
    fire({ key: 'ArrowLeft', altKey: true });
    fire({ key: 'ArrowRight', altKey: true });
    expect(calls).toEqual({ prevented: 2, moves: ['back', 'forward'] });
  });

  it('consumes Cmd+[ / Cmd+] on macOS', () => {
    const { calls, fire } = chordHarness(true);
    fire({ key: '[', metaKey: true });
    fire({ key: ']', metaKey: true });
    expect(calls).toEqual({ prevented: 2, moves: ['back', 'forward'] });
  });

  it('leaves every other keystroke alone', () => {
    const { calls, fire } = chordHarness(false);
    fire({ key: 'ArrowLeft' });
    fire({ key: 'ArrowLeft', ctrlKey: true });
    fire({ key: 'w', ctrlKey: true });
    expect(calls).toEqual({ prevented: 0, moves: [] });
  });
});

describe('the mouse side buttons', () => {
  it('maps 3 to back and 4 to forward', () => {
    expect(historyButtonDirection(3)).toBe('back');
    expect(historyButtonDirection(4)).toBe('forward');
    expect(historyButtonDirection(0)).toBeNull();
    expect(historyButtonDirection(1)).toBeNull();
    expect(historyButtonDirection(2)).toBeNull();
  });

  it('consumes both halves of a click and moves once', () => {
    const calls = { prevented: 0, moves: [] as Direction[] };
    const handler = createHistoryButtonHandler((direction) => calls.moves.push(direction));
    const fire = (type: string, button: number) => {
      const event: HandledButtonEvent = {
        type,
        button,
        preventDefault: () => {
          calls.prevented += 1;
        },
      };
      handler(event);
    };
    fire('mousedown', 3);
    fire('mouseup', 3);
    fire('mousedown', 0);
    fire('mouseup', 0);
    expect(calls).toEqual({ prevented: 2, moves: ['back'] });
  });
});
