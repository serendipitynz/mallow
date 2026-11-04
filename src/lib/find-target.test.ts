import { afterEach, describe, expect, it } from 'vitest';
import { type FindTarget, getFindTarget, isFindAvailable, onFindTargetChange, setFindTarget } from './find-target';

function target(): FindTarget {
  return { root: {} as HTMLElement, scroller: {} as HTMLElement };
}

describe('the find target', () => {
  const releases: (() => void)[] = [];
  afterEach(() => {
    for (const release of releases.splice(0)) {
      release();
    }
  });

  it('is available while a view has registered one', () => {
    expect(isFindAvailable()).toBe(false);
    const release = setFindTarget(target());
    expect(isFindAvailable()).toBe(true);
    release();
    expect(isFindAvailable()).toBe(false);
  });

  /* The order a preview → source toggle can take: the source view registers
     before the preview's cleanup runs. That cleanup must not take the source
     view's target away. */
  it('is not cleared by the release of a target that was replaced', () => {
    const preview = target();
    const source = target();
    const releasePreview = setFindTarget(preview);
    releases.push(setFindTarget(source));
    releasePreview();
    expect(getFindTarget()).toBe(source);
  });

  it('notifies on each change and not on a repeated one', () => {
    const seen: (FindTarget | null)[] = [];
    const unsubscribe = onFindTargetChange((t) => seen.push(t));
    const one = target();
    const release = setFindTarget(one);
    setFindTarget(one);
    release();
    unsubscribe();
    expect(seen).toEqual([one, null]);
  });
});
