/**
 * Which lines the rendered view's notice bar carries, given what the transform
 * counted and what the frame turned out to be capable of.
 *
 * Separated from the component so the rule is exercised under Node, where there
 * is no DOM (doc-1). It returns i18n keys rather than text: the language can
 * change while a document is open, and the view re-renders from these.
 *
 * The bar exists because the limits decision-3 accepted are invisible otherwise —
 * a document rendering unstyled, or with a link that does nothing, reads as a
 * fault in mallow rather than as something it declined to do.
 */
import type { HtmlCounts } from './html-doc';

export interface NoticeLine {
  key: string;
  /** Interpolated as `{n}`, on the lines that carry a count. */
  n?: number;
}

export interface FrameCapability {
  /** decision-9's boundary: whether the frame invokes a listener the parent
   *  registered on its document. `null` until a document has loaded and the probe
   *  has answered — the link line says nothing rather than guessing, since it
   *  would otherwise appear and then contradict itself a frame later. */
  runsParentListeners: boolean | null;
  /** Whether the outline is on screen *now* — not merely available. The link
   *  line offers it in place of the table of contents the document carries, and
   *  a reader who has collapsed it would otherwise be pointed at nothing. */
  outlineVisible: boolean;
}

export function renderedNoticeLines(counts: HtmlCounts, frame: FrameCapability): NoticeLine[] {
  const lines: NoticeLine[] = [];
  if (counts.scripts > 0) {
    lines.push({ key: 'htmlNoticeScripts', n: counts.scripts });
  }
  if (counts.blockedRefs > 0) {
    lines.push({ key: 'htmlNoticeBlockedRefs', n: counts.blockedRefs });
  }
  if (counts.unresolvedLocalRefs > 0) {
    lines.push({ key: 'htmlNoticeLocalRefs', n: counts.unresolvedLocalRefs });
  }
  if (counts.removedFrames > 0) {
    lines.push({ key: 'htmlNoticeFrames', n: counts.removedFrames });
  }
  // Only where the parent cannot intercept a click, and only where there is a
  // link for the statement to be about — a document with none would otherwise be
  // told about a failure it cannot have.
  if (frame.runsParentListeners === false && counts.links > 0) {
    lines.push({ key: 'htmlNoticeLinksInert', n: counts.links });
    if (frame.outlineVisible) {
      lines.push({ key: 'htmlNoticeOutlineWorks' });
    }
  }
  return lines;
}
