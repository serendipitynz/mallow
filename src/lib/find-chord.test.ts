import { describe, expect, it } from 'vitest';
import type { ChordEvent, HandledChordEvent } from './chord';
import type { FindDirection } from './find';
import { createFindChordHandler, createFindStepChordHandler, FIND_CHORD_KEY, findStepDirection } from './find-chord';

function event(over: Partial<ChordEvent>, prevented: { count: number }): HandledChordEvent {
  return {
    key: 'f',
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...over,
    preventDefault: () => {
      prevented.count += 1;
    },
  };
}

describe('the find chord', () => {
  it('is CmdOrCtrl+F', () => {
    expect(FIND_CHORD_KEY).toBe('f');
  });

  it('opens the bar where the view has find', () => {
    const prevented = { count: 0 };
    let opened = 0;
    const handler = createFindChordHandler({ onMac: false, isAllowed: () => true, open: () => opened++ });
    handler(event({ ctrlKey: true }, prevented));
    expect({ prevented: prevented.count, opened }).toEqual({ prevented: 1, opened: 1 });
  });

  /* Measured on Windows (TASK-46): with nothing consuming it, Ctrl+F opened
     WebView2's own find bar. A view without find has to cost the platform the
     chord all the same. */
  it('consumes the chord without opening anything where the view has no find', () => {
    const prevented = { count: 0 };
    let opened = 0;
    const handler = createFindChordHandler({ onMac: false, isAllowed: () => false, open: () => opened++ });
    handler(event({ ctrlKey: true }, prevented));
    expect({ prevented: prevented.count, opened }).toEqual({ prevented: 1, opened: 0 });
  });
});

describe('findStepDirection', () => {
  const none = { count: 0 };

  it('reads Cmd+G and Cmd+Shift+G on macOS', () => {
    expect(findStepDirection(event({ key: 'g', metaKey: true }, none), true)).toBe('next');
    expect(findStepDirection(event({ key: 'G', metaKey: true, shiftKey: true }, none), true)).toBe('previous');
  });

  it('reads F3 and Shift+F3 on Windows and Linux', () => {
    expect(findStepDirection(event({ key: 'F3' }, none), false)).toBe('next');
    expect(findStepDirection(event({ key: 'F3', shiftKey: true }, none), false)).toBe('previous');
  });

  it('leaves each platform the other one’s keys', () => {
    expect(findStepDirection(event({ key: 'F3' }, none), true)).toBeNull();
    expect(findStepDirection(event({ key: 'g', ctrlKey: true }, none), false)).toBeNull();
  });

  it('refuses the keys under another modifier', () => {
    expect(findStepDirection(event({ key: 'g', metaKey: true, ctrlKey: true }, none), true)).toBeNull();
    expect(findStepDirection(event({ key: 'g', metaKey: true, altKey: true }, none), true)).toBeNull();
    expect(findStepDirection(event({ key: 'F3', ctrlKey: true }, none), false)).toBeNull();
    expect(findStepDirection(event({ key: 'F3', altKey: true }, none), false)).toBeNull();
  });
});

describe('the find step chord', () => {
  it('steps where the view has find', () => {
    const prevented = { count: 0 };
    const steps: FindDirection[] = [];
    const handler = createFindStepChordHandler({ onMac: false, isAllowed: () => true, step: (d) => steps.push(d) });
    handler(event({ key: 'F3' }, prevented));
    handler(event({ key: 'F3', shiftKey: true }, prevented));
    expect(steps).toEqual(['next', 'previous']);
    expect(prevented.count).toBe(2);
  });

  /* F3 is Find Next in WebView2's own find bar, so it is consumed for Ctrl+F's
     reason even where nothing is searched. */
  it('consumes the keys without stepping where the view has no find', () => {
    const prevented = { count: 0 };
    const steps: FindDirection[] = [];
    const handler = createFindStepChordHandler({ onMac: false, isAllowed: () => false, step: (d) => steps.push(d) });
    handler(event({ key: 'F3' }, prevented));
    expect(steps).toEqual([]);
    expect(prevented.count).toBe(1);
  });

  it('leaves other keys alone', () => {
    const prevented = { count: 0 };
    const handler = createFindStepChordHandler({ onMac: true, isAllowed: () => true, step: () => undefined });
    handler(event({ key: 'f', metaKey: true }, prevented));
    expect(prevented.count).toBe(0);
  });
});
