import { describe, expect, it } from 'vitest';
import type { HtmlCounts } from './html-doc';
import { renderedNoticeLines } from './html-notice';

function counts(over: Partial<HtmlCounts> = {}): HtmlCounts {
  return {
    elements: 100,
    textChars: 1_000,
    scripts: 0,
    links: 0,
    blockedExternalRefs: 0,
    unresolvedLocalRefs: 0,
    removedFrames: 0,
    ...over,
  };
}

const keys = (over: Partial<HtmlCounts>, runsParentListeners: boolean | null, hasOutline = false) =>
  renderedNoticeLines(counts(over), { runsParentListeners, hasOutline }).map((line) => line.key);

describe('renderedNoticeLines', () => {
  it('says nothing about a document that lost nothing', () => {
    expect(renderedNoticeLines(counts(), { runsParentListeners: true, hasOutline: true })).toEqual([]);
  });

  it('carries the count each line interpolates', () => {
    expect(
      renderedNoticeLines(counts({ scripts: 3, removedFrames: 1 }), {
        runsParentListeners: true,
        hasOutline: false,
      }),
    ).toEqual([
      { key: 'htmlNoticeScripts', n: 3 },
      { key: 'htmlNoticeFrames', n: 1 },
    ]);
  });

  // Where the parent's click handler runs, a link goes to the OS browser or
  // scrolls the parent, so there is nothing to report about it.
  it('reports links only where no parent-registered listener runs', () => {
    expect(keys({ links: 4 }, true)).toEqual([]);
    expect(keys({ links: 4 }, false)).toEqual(['htmlNoticeLinksInert']);
  });

  // The probe answers on load. Until then the line would appear and be
  // contradicted a frame later on the platform where links do work.
  it('says nothing about links before a document has loaded', () => {
    expect(keys({ links: 4 }, null)).toEqual([]);
  });

  // decision-10: a bare fragment resolves against the parent's URL, so the
  // document's own table of contents is among the links that do nothing — which
  // is why every href is counted and the statement is not about `http(s)` alone.
  it('does not tell a document with no links that its links do nothing', () => {
    expect(keys({ links: 0, scripts: 1 }, false)).toEqual(['htmlNoticeScripts']);
  });

  it('offers the outline in place of the document’s own contents, only when it is on screen', () => {
    expect(keys({ links: 2 }, false, true)).toEqual(['htmlNoticeLinksInert', 'htmlNoticeOutlineWorks']);
    expect(keys({ links: 2 }, false, false)).toEqual(['htmlNoticeLinksInert']);
  });

  it('keeps the two external-reference outcomes apart', () => {
    expect(keys({ blockedExternalRefs: 2 }, true)).toEqual(['htmlNoticeBlockedRefs']);
    expect(keys({ unresolvedLocalRefs: 5 }, true)).toEqual(['htmlNoticeLocalRefs']);
  });
});
