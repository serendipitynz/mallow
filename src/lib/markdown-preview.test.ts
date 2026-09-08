import { beforeEach, describe, expect, it } from 'vitest';
import { isMarkdownPreviewActive, setMarkdownPreviewActive } from './markdown-preview';

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
});
