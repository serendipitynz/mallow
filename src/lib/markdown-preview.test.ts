import { beforeEach, describe, expect, it } from 'vitest';
import { isMarkdownPreviewActive, onMarkdownPreviewChange, setMarkdownPreviewActive } from './markdown-preview';

describe('the markdown-preview gate', () => {
  beforeEach(() => {
    setMarkdownPreviewActive(false);
  });

  // A chord pressed before any view mounts has to find the gate closed, or the
  // first keystroke of a session would reach a view that is not there.
  it('starts closed', () => {
    expect(isMarkdownPreviewActive()).toBe(false);
  });

  it('follows the view in and out', () => {
    setMarkdownPreviewActive(true);
    expect(isMarkdownPreviewActive()).toBe(true);
    setMarkdownPreviewActive(false);
    expect(isMarkdownPreviewActive()).toBe(false);
  });

  // The native menu items live in another process, so a change has to be pushed
  // to them rather than polled for.
  it('tells a subscriber what it changed to', () => {
    const seen: boolean[] = [];
    const stop = onMarkdownPreviewChange((active) => seen.push(active));
    setMarkdownPreviewActive(true);
    setMarkdownPreviewActive(false);
    stop();
    expect(seen).toEqual([true, false]);
  });

  // What reaches Rust is one command invocation per notification, so a repeated
  // publish of the same value would be a round trip per re-render of an
  // unchanged view. `MarkdownView` publishes from an effect and Viewer remounts
  // it for reasons that do not change the gate.
  it('says nothing when the value it is given is the one it holds', () => {
    const seen: boolean[] = [];
    const stop = onMarkdownPreviewChange((active) => seen.push(active));
    setMarkdownPreviewActive(false);
    setMarkdownPreviewActive(true);
    setMarkdownPreviewActive(true);
    stop();
    expect(seen).toEqual([true]);
  });

  it('stops telling a subscriber that has unsubscribed', () => {
    const seen: boolean[] = [];
    const stop = onMarkdownPreviewChange((active) => seen.push(active));
    stop();
    setMarkdownPreviewActive(true);
    expect(seen).toEqual([]);
  });
});
