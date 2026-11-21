/**
 * The status bar's character count (TASK-69): what a reader counts as one
 * character — an extended grapheme cluster, so `👍🏽` and a voiced `が` written
 * as two code points are one each — with line breaks left out and spaces and
 * tabs kept. A CRLF is one cluster, so it is one line break.
 *
 * Segmenting is the expensive part: 10 MiB took 1.8 s under V8, so the count is
 * a generator the caller runs in slices rather than one call that holds the
 * main thread for that long.
 */

/** Clusters between two chances to yield. Small enough that a slice overruns
 *  its budget by little, large enough that the clock is not read per cluster. */
export const CLUSTERS_PER_CHECK = 2048;

function isLineBreak(cluster: string): boolean {
  return cluster === '\n' || cluster === '\r' || cluster === '\r\n';
}

/** Yields after every `perCheck` clusters and returns the count. */
export function* countCharacters(text: string, perCheck = CLUSTERS_PER_CHECK): Generator<undefined, number> {
  const clusters = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text);
  let count = 0;
  let sinceCheck = 0;
  for (const { segment } of clusters) {
    if (!isLineBreak(segment)) {
      count += 1;
    }
    sinceCheck += 1;
    if (sinceCheck === perCheck) {
      sinceCheck = 0;
      yield;
    }
  }
  return count;
}

export interface SliceClock {
  now: () => number;
  /** Runs `task` later, giving the engine the turn in between. */
  schedule: (task: () => void) => void;
}

/** The longest a slice runs before it hands the turn back. Half a 60 Hz frame. */
export const SLICE_MS = 8;

/**
 * Drives `counting` a slice at a time and reports its result once. The returned
 * function stops it, and nothing is reported after that — the text it was
 * counting is no longer the one shown.
 */
export function runInSlices(
  counting: Generator<undefined, number>,
  clock: SliceClock,
  onDone: (count: number) => void,
  sliceMs = SLICE_MS,
): () => void {
  let stopped = false;
  const slice = () => {
    if (stopped) {
      return;
    }
    const until = clock.now() + sliceMs;
    for (;;) {
      const step = counting.next();
      if (step.done) {
        onDone(step.value);
        return;
      }
      if (clock.now() >= until) {
        clock.schedule(slice);
        return;
      }
    }
  };
  clock.schedule(slice);
  return () => {
    stopped = true;
  };
}
