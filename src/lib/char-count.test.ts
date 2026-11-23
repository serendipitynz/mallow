import { describe, expect, it } from 'vitest';
import { countCharacters, runInSlices, type SliceClock } from './char-count';

function countAll(text: string, perCheck?: number): number {
  const counting = countCharacters(text, perCheck);
  for (;;) {
    const step = counting.next();
    if (step.done) {
      return step.value;
    }
  }
}

describe('countCharacters', () => {
  it('counts what a reader sees as one character once', () => {
    expect(countAll('abc')).toBe(3);
    expect(countAll('日本語')).toBe(3);
    // A skin-tone modifier, a voiced mark written as a combining character, and
    // a flag made of two regional indicators.
    expect(countAll('👍🏽')).toBe(1);
    expect(countAll('が')).toBe(1);
    expect(countAll('🇯🇵')).toBe(1);
  });

  it('leaves line breaks out, a CRLF being one, and keeps spaces and tabs', () => {
    expect(countAll('a\nb')).toBe(2);
    expect(countAll('a\r\nb\r\n')).toBe(2);
    expect(countAll('a\rb')).toBe(2);
    expect(countAll('a b\tc')).toBe(5);
    expect(countAll('\n\n\n')).toBe(0);
    expect(countAll('')).toBe(0);
  });

  it('yields between checks and gets the same answer however often it does', () => {
    const counting = countCharacters('abcde\nfg', 2);
    let yields = 0;
    let step = counting.next();
    while (!step.done) {
      yields += 1;
      step = counting.next();
    }
    expect(step.value).toBe(7);
    expect(yields).toBe(4);
  });
});

/** A clock that moves only when a counting step reads it, and runs scheduled
 *  slices when told to. */
function fakeClock(perRead: number): SliceClock & { pending: (() => void)[]; reads: number } {
  const clock = {
    pending: [] as (() => void)[],
    reads: 0,
    now: () => {
      clock.reads += 1;
      return clock.reads * perRead;
    },
    schedule: (task: () => void) => {
      clock.pending.push(task);
    },
  };
  return clock;
}

function* steps(count: number, result: number): Generator<undefined, number> {
  for (let i = 0; i < count; i += 1) {
    yield;
  }
  return result;
}

describe('runInSlices', () => {
  it('runs nothing before its first turn, then hands the turn back once a slice is spent', () => {
    const clock = fakeClock(1);
    const results: number[] = [];
    runInSlices(steps(10, 42), clock, (n) => results.push(n), 3);
    expect(clock.reads).toBe(0);
    expect(clock.pending).toHaveLength(1);

    let slices = 0;
    while (clock.pending.length > 0) {
      const task = clock.pending.shift() as () => void;
      task();
      slices += 1;
    }
    expect(results).toEqual([42]);
    expect(slices).toBeGreaterThan(1);
  });

  it('reports nothing once it has been stopped', () => {
    const clock = fakeClock(1);
    const results: number[] = [];
    const stop = runInSlices(steps(10, 42), clock, (n) => results.push(n), 3);
    (clock.pending.shift() as () => void)();
    stop();
    while (clock.pending.length > 0) {
      (clock.pending.shift() as () => void)();
    }
    expect(results).toEqual([]);
  });

  it('hands the turn back on the clock read that reaches the end of the slice', () => {
    // Each step reads the clock once, a read advancing it by 1: a slice starting
    // at 1 and lasting 3 ends on the third step's read, at 4.
    const clock = fakeClock(1);
    let stepsRun = 0;
    function* counted(): Generator<undefined, number> {
      for (;;) {
        stepsRun += 1;
        yield;
      }
    }
    runInSlices(counted(), clock, () => {}, 3);
    (clock.pending.shift() as () => void)();
    expect(stepsRun).toBe(3);
    expect(clock.pending).toHaveLength(1);
  });

  it('finishes inside the first slice when the work is shorter than it', () => {
    const clock = fakeClock(1);
    const results: number[] = [];
    runInSlices(steps(2, 7), clock, (n) => results.push(n), 100);
    (clock.pending.shift() as () => void)();
    expect(results).toEqual([7]);
    expect(clock.pending).toHaveLength(0);
  });
});
