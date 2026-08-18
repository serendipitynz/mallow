import { convertFileSrc } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Heading, HeadingRoot } from '../lib/heading';
import { navigatesAppOrigin, transformHtmlDocument } from '../lib/html-doc';
import { assignHeadingIds } from '../lib/html-headings';
import { useT } from '../lib/i18n';
import { readOutlineOpen, writeOutlineOpen } from '../lib/outline-pref';
import { dirname } from '../lib/path';
import { captureScrollAnchor, restoreScrollAnchor, type ScrollAnchor } from '../lib/scroll';
import type { FileEntry } from '../lib/types';
import { CodeIcon, ScanSearchIcon, TableOfContentsIcon } from './icons';
import { Outline } from './Outline';
import { SourceView } from './SourceView';

/**
 * Height the frame will grow to at most, above which the document goes to the
 * capped source view — the same landing spot the render ceiling uses, because
 * the app's scroller stays the only scroller and a frame with a viewport of its
 * own would reopen decision-3, decision-9 and TASK-8 as one contract.
 *
 * A backstop against pathological growth, not a limit real documents are
 * expected to meet — decision-3 asks for it in those words, and the measurement
 * says the two are cleanly separable. Running this component's sizing loop over
 * 3,118 `.html` / `.htm` files on one working machine, at the width the frame is
 * given beside an open outline, 2,757 answered and they fell into two
 * populations with nothing in between:
 *
 * - **2,753 settled below 525,753px** — median 1,369, 99th percentile 14,072,
 *   99.9th 82,877, and the tallest an evaluation report of one long `<pre>`.
 * - **4 ran away to 33,554,432px**, which is not a property of the documents but
 *   the engine's own maximum element height: the loop diverges and the engine
 *   stops it. `safari_reader.html` and three saved report pages.
 *
 * Nothing sat between 525,753 and 33,554,432 — a factor of 64 — so this cap
 * separates "renders" from "diverges" rather than picking a point on a
 * distribution, and its exact value hardly matters. Those four documents are the
 * only ones in the corpus that fall back.
 *
 * **Pixels, not bytes or elements.** The render ceiling in `lib/html-doc`
 * already bounds how much there is to lay out; this bounds what CSS makes of it,
 * which those counts do not predict — `height: 100000vh` is one element.
 */
const MAX_FRAME_HEIGHT_PX = 2_000_000;

/**
 * Measurement passes spent before the frame keeps the height it has.
 *
 * In the corpus above, **2,727 documents reached their fixed point in one pass
 * and 17 in more, the slowest in 20.** So this clears the slowest converging
 * document by 1.6×.
 *
 * What it is actually there for is the **13 that never settled at all**, and
 * they do not diverge — they *oscillate*, alternating between two heights for
 * all 40 passes the scan allowed, at ordinary sizes (1,440px to 13,840px). A
 * document with a box whose height depends on the viewport in a way that flips
 * a wrapping decision has no fixed point at any height, so nothing but a budget
 * stops it, and {@link MAX_FRAME_HEIGHT_PX} never would: it stays small while it
 * cycles. The frame ends on whichever of the two heights the budget ran out on,
 * which costs a line of gap or a line clipped.
 *
 * The budget is spent in `scheduleMeasure` as well as here, so it bounds the
 * *work* and not only the height — an oscillating document would otherwise cost
 * a layout of the frame's document every frame, forever. A width change or a
 * mutation refills it, so it is not a one-way door.
 */
const MAX_MEASUREMENT_PASSES = 32;

/** Dispatched into the frame's document to learn whether listeners run there. A
 *  name no document would register for, so a document cannot answer for itself. */
const LISTENER_PROBE_EVENT = 'mallow:listener-probe';

/**
 * Whether the frame invokes a listener the parent registered on its document.
 *
 * decision-9: a document with scripting disabled invokes none — the case on both
 * WebKit engines and not on WebView2 — so link handling is a capability rather
 * than a given. It is probed instead of being read off a platform name, because
 * the boundary is "does this frame run a parent-registered listener" and a future
 * WebKit release may move it. One synchronous dispatch per document.
 */
function runsParentListeners(frameDocument: Document): boolean {
  let ran = false;
  const probe = () => {
    ran = true;
  };
  frameDocument.addEventListener(LISTENER_PROBE_EVENT, probe);
  frameDocument.dispatchEvent(new Event(LISTENER_PROBE_EVENT));
  frameDocument.removeEventListener(LISTENER_PROBE_EVENT, probe);
  return ran;
}

function fragmentName(href: string): string {
  const raw = href.slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    // A stray `%` is not an escape; the fragment is then the literal text.
    return raw;
  }
}

/** The element a fragment addresses, including the named-anchor form older
 *  documents use, which `getElementById` does not answer. */
function fragmentTarget(frameDocument: Document, name: string): HTMLElement | null {
  if (name === '') {
    return null;
  }
  return (
    frameDocument.getElementById(name) ?? (frameDocument.getElementsByName(name)[0] as HTMLElement | undefined) ?? null
  );
}

/** Whether a fragment that matched no element addresses the document's start.
 *  HTML gives that meaning to an empty fragment and, when nothing carries the
 *  name, to `top` — which is what `<a href="#top">Back to top</a>` relies on. */
function addressesDocumentStart(name: string): boolean {
  return name === '' || name.toLowerCase() === 'top';
}

/**
 * The HTML rendered view: the document in an iframe fed through `srcdoc`, with a
 * toggle to the source view (decision-3, amended by decision-9).
 *
 * This owns the only `DOMParser` call in the app's HTML path — `lib/html-doc`
 * decides everything else and stays testable under Node (doc-1).
 *
 * `sandbox="allow-same-origin"` with **no** `allow-scripts`: no script in the
 * document runs, while the parent can still read and drive `contentDocument`,
 * which is what the outline, the height and the link handling below rest on. The
 * two flags are a pair, not two independent choices — together they would let a
 * document remove its own sandbox, and with same-origin in place a script in the
 * frame would be a script in the app origin, where `read_file` is plain
 * `std::fs`. `allow-forms`, `allow-popups` and `allow-top-navigation` stay off
 * for the same kind of reason. decision-3 says why adding any of them is not a
 * one-line change.
 */
export function HtmlView({ source, file }: { source: string; file: FileEntry }) {
  const t = useT();
  const transform = useMemo(
    () =>
      transformHtmlDocument(new DOMParser().parseFromString(source, 'text/html'), {
        dir: dirname(file.path),
        toAssetUrl: convertFileSrc,
      }),
    [source, file.path],
  );
  const [mode, setMode] = useState<'rendered' | 'source'>('rendered');
  const [outlineOpen, setOutlineOpen] = useState<boolean>(readOutlineOpen);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [tooTall, setTooTall] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  /** Measurement passes since the last external cause; see {@link MAX_MEASUREMENT_PASSES}. */
  const passes = useRef(0);
  const appliedHeight = useRef<number | null>(null);
  const pendingMeasure = useRef(0);
  const disposeFrame = useRef<(() => void) | null>(null);
  const anchor = useRef<ScrollAnchor>(null);
  /** Where the reader was when a restart shrank the frame under them. */
  const pendingRestore = useRef<ScrollAnchor>(null);
  // Read by the scroll listener, which is bound once and must not be re-bound per
  // heading change.
  const headingsRef = useRef<Heading[]>(headings);
  headingsRef.current = headings;

  // Both members are read per lookup rather than captured: the `contentDocument`
  // is a different object after every `srcdoc` swap, and the frame's own top moves
  // while a document is open (the outline opens, the notice bar appears).
  const frameRoot = useMemo<HeadingRoot>(
    () => ({
      node: () => frameRef.current?.contentDocument ?? null,
      frameOffset: () => frameRef.current?.getBoundingClientRect().top ?? 0,
    }),
    [],
  );

  // Above either ceiling nothing is rendered, so the source view is not a mode
  // the reader chose but the only one there is (decision-6 makes it a floor that
  // holds at any size).
  const renderable = transform.html !== null && !tooTall;
  const showRendered = mode === 'rendered' && renderable;
  const hasOutline = headings.length > 1;
  const showOutline = showRendered && hasOutline && outlineOpen;

  /**
   * Size the frame to its document, one step of a convergence the observers
   * drive: applying a height changes the document's viewport, which reports
   * through the `ResizeObserver`, which brings us back here.
   *
   * **The height is read at the height currently applied, and that is what makes
   * the value converged on a fixed point** — a height at which the document
   * reports that height. Reading anywhere else gives a height the document is
   * not laid out at: `90vh` inside the frame resolves against the frame's own
   * height, so a value measured at some other reference leaves the content
   * taller than the box holding it, and the frame becomes the second scroll
   * region decision-3, decision-9 and TASK-8 all forbid. decision-3 specifies
   * this loop, including that it can diverge; {@link MAX_MEASUREMENT_PASSES} and
   * {@link MAX_FRAME_HEIGHT_PX} are what bound it.
   *
   * `restart` is for a cause that can make the document *shorter* — a mutation,
   * a width change. `scrollHeight` is floored by the frame's own height, so from
   * a tall frame a shrink is invisible; the convergence has to begin again from a
   * height the document is known to exceed.
   */
  const measure = useCallback(
    (restart: boolean) => {
      const frame = frameRef.current;
      const frameDocument = frame?.contentDocument;
      const scroller = scrollRef.current;
      if (!frame || !frameDocument || !scroller) {
        return;
      }
      if (restart) {
        passes.current = 0;
        appliedHeight.current = null;
        // Seeded at the reader's own viewport rather than at 0: a document sized
        // in `vh` then starts from the viewport its author meant, and one that
        // converges reaches the same fixed point from either seed.
        frame.style.height = `${scroller.clientHeight}px`;
        // Shrinking the frame shortens the scroller, which clamps the offset
        // there and then. The heading anchor is what carries the reader back
        // across the convergence — a saved `scrollTop` would not, because the
        // height it belonged to is the one being recomputed.
        pendingRestore.current = anchor.current;
      }
      const height = frameDocument.documentElement.scrollHeight;
      /* Converged, out of budget, or over the ceiling — and in all three the
         frame keeps the height it has. Nothing is written on the way out, which
         is not an optimisation: per CSSOM-View an instant scroll aborts a smooth
         one, so a measurement landing during an outline jump would stop it a few
         percent in, and the observers and polls fire during exactly those. */
      if (height === appliedHeight.current || passes.current >= MAX_MEASUREMENT_PASSES) {
        const restore = pendingRestore.current;
        if (restore) {
          pendingRestore.current = null;
          restoreScrollAnchor(scroller, restore, frameRoot);
        }
        return;
      }
      if (height > MAX_FRAME_HEIGHT_PX) {
        setTooTall(true);
        return;
      }
      passes.current += 1;
      appliedHeight.current = height;
      frame.style.height = `${height}px`;
    },
    [frameRoot],
  );

  /**
   * Measure on the next frame, once per frame. Called from the observers, whose
   * callbacks must not themselves change layout — a `ResizeObserver` that resizes
   * what it observes reports an undelivered-notification loop.
   *
   * The budget is spent here rather than only inside `measure`, which is what
   * makes {@link MAX_MEASUREMENT_PASSES} bound the *work* and not just the
   * height: a document animating a box's height reports through the
   * `ResizeObserver` every frame and never stops, and measuring it every frame
   * would cost two layouts of the frame's document each time, forever. A width
   * change or a mutation refills the budget, so this is not a one-way door.
   */
  const scheduleMeasure = useCallback(
    (restart: boolean) => {
      // A restart refills the budget itself, so a spent one must not turn it away
      // — that is the path a width change and a mutation come in on.
      if (pendingMeasure.current !== 0 || (!restart && passes.current >= MAX_MEASUREMENT_PASSES)) {
        return;
      }
      pendingMeasure.current = requestAnimationFrame(() => {
        pendingMeasure.current = 0;
        measure(restart);
      });
    },
    [measure],
  );

  /**
   * Everything the parent puts inside the frame's document, in the order
   * decision-3 requires — ids, then the parent-side wiring, then the scroll
   * anchor, then the height. A `srcdoc` swap builds a fresh document and takes
   * ids, listeners, observers and the measured height with it, so this runs again
   * on every load rather than once per mount.
   */
  const onFrameLoad = useCallback(() => {
    const frame = frameRef.current;
    const frameDocument = frame?.contentDocument;
    if (!frame || !frameDocument) {
      return;
    }
    disposeFrame.current?.();
    passes.current = 0;
    appliedHeight.current = null;

    const elements = Array.from(frameDocument.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'));
    const takenIds = Array.from(frameDocument.querySelectorAll('[id]'), (element) => element.id);
    // An id is the heading's to keep only when the heading is the document's
    // first holder of it. The DOM answers that; `lib/html-headings` stays free of
    // it, which is what keeps the rest of the rule testable under Node.
    const nextHeadings = assignHeadingIds(elements, takenIds, (element) =>
      element.id === '' ? false : frameDocument.getElementById(element.id) === (element as unknown as Element),
    );
    /* The landing offset is declared once, in `html.scss` on the frame element,
       and copied in here: the parent's stylesheets do not reach into the frame's
       document, and `Outline` reads it back off the heading, so the jump and the
       scroll spy cannot disagree (TASK-20).

       Onto everything a fragment can address rather than the headings alone —
       `scrollIntoView` honours the target's own margin, and a footnote `<li>` or
       an `<a name>` anchor would otherwise land under the pinned bar. After
       `assignHeadingIds`, so the ids it just wrote are matched too.

       **Every parent-side write into the frame belongs here, not in a handler.**
       Each one is an attribute mutation the `MutationObserver` below reports, and
       the measurement that schedules writes `scroller.scrollTop`, which aborts a
       smooth scroll in progress — so a write made while preparing a jump cancels
       that jump, on its first use and only the first. `tabindex` is here for the
       same reason: `Outline`'s `go` sets it on the heading it jumps to, and left
       to it, that is exactly the sequence. */
    const landing = getComputedStyle(frame).scrollMarginTop;
    for (const element of frameDocument.querySelectorAll<HTMLElement>('[id], [name]')) {
      element.style.scrollMarginTop = landing;
    }
    for (const element of elements) {
      if (!element.hasAttribute('tabindex')) {
        element.setAttribute('tabindex', '-1');
      }
    }
    setHeadings(nextHeadings);

    const listeners = runsParentListeners(frameDocument);
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href]');
      if (!link) {
        return;
      }
      const href = link.getAttribute('href') ?? '';
      // Nothing here is allowed to navigate the frame. `frame-src` is what stops
      // it going anywhere (decision-9), but a link that silently blanked the
      // document would still be a worse answer than an inert one.
      event.preventDefault();
      if (href.startsWith('#')) {
        // A frame sized to its content has no viewport of its own, so native
        // fragment navigation has nothing to scroll and the parent does it —
        // through the one boundary-crossing mechanism TASK-8 named.
        // Nothing is written into the frame on this path; both targets already
        // carry their landing offset — the elements from the load pass, the frame
        // from `html.scss`. See the loop above for why that matters.
        const name = fragmentName(href);
        const target = fragmentTarget(frameDocument, name) ?? (addressesDocumentStart(name) ? frame : null);
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        // The frame stands in for the start of the document it holds, so the same
        // mechanism serves both and there is still only one.
        target?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        return;
      }
      if (/^https?:\/\//i.test(href)) {
        void openUrl(href).catch((err) => console.error('openUrl failed', err));
      }
      // Every other scheme is inert, as it is in the markdown view.
    };
    if (listeners) {
      frameDocument.addEventListener('click', onClick);
    } else {
      /* Where no parent-registered listener runs, nothing can `preventDefault` a
         click — and a link that resolves against the parent's URL then navigates
         the frame to the app shell, which renders blank because its scripts are
         refused, with no way back inside the view. That is what a real click on a
         `#` link was measured doing (decision-10); decision-9 had inferred it
         would be inert, and it is not.

         `pointer-events` rather than removing the `href`: the click never reaches
         the anchor, so nothing activates, while `:link` still matches and the
         document keeps the styling its author gave it. An `http(s)` link is left
         alone — it is already inert because `frame-src` does not carry it, which
         is the inertness decision-9 accepted. */
      for (const link of frameDocument.querySelectorAll<HTMLElement>('a[href]')) {
        if (navigatesAppOrigin(link.getAttribute('href') ?? '')) {
          link.style.pointerEvents = 'none';
        }
      }
    }

    // Late layout is observed, never listened for: a `load` listener on an image
    // inside the frame fired on none of the three WebViews, while both observers
    // reported on all three (decision-9).
    const resizes = new ResizeObserver(() => scheduleMeasure(false));
    resizes.observe(frameDocument.documentElement);
    const mutations = new MutationObserver(() => {
      // A mutation is an external cause rather than the sizing loop feeding
      // itself, so it refills the budget — and it is the one cause that can make
      // the document shorter (a `<details>` closing), which is what `restart` is
      // for.
      passes.current = 0;
      scheduleMeasure(true);
    });
    mutations.observe(frameDocument, { subtree: true, childList: true, attributes: true });
    /* Polling is the backstop, not the mechanism (decision-9). A fixed short
       schedule rather than a standing interval: it exists for a late change that
       moves no box either observer watches, and those all land while the document
       is settling.

       It backs up growth only. A poll asks for no restart, so like the observer
       it cannot see the document get *shorter* — a shrink reaches the height
       through a mutation or a width change alone. That is deliberate: a restart
       shrinks the frame to the seed, so three of them per load would be three
       chances to throw a reader who is part-way through the document, and what a
       missed shrink costs is trailing blank canvas rather than anything the
       reader cannot get to. */
    const polls = [250, 750, 2000].map((delay) => window.setTimeout(() => scheduleMeasure(false), delay));

    disposeFrame.current = () => {
      frameDocument.removeEventListener('click', onClick);
      resizes.disconnect();
      mutations.disconnect();
      for (const poll of polls) {
        window.clearTimeout(poll);
      }
    };

    const restore = anchor.current;
    restoreScrollAnchor(scrollRef.current, restore, frameRoot);
    measure(true);
    // The restore above runs in the order decision-3 sets out, before the height
    // is known; once it is, the scroller's own extent has changed, so it is
    // repeated against the settled layout.
    requestAnimationFrame(() => {
      measure(true);
      restoreScrollAnchor(scrollRef.current, restore, frameRoot);
    });
  }, [frameRoot, measure, scheduleMeasure]);

  // The wiring belongs to the frame element, not to whatever load comes next.
  // Switching to the source view, or crossing the height ceiling, removes the
  // iframe with no load ever following, which would otherwise leave the previous
  // document's observers and its pending polls alive with nothing to measure.
  useEffect(() => {
    if (!showRendered) {
      return;
    }
    return () => {
      disposeFrame.current?.();
      disposeFrame.current = null;
    };
  }, [showRendered]);

  useEffect(() => {
    return () => {
      if (pendingMeasure.current !== 0) {
        cancelAnimationFrame(pendingMeasure.current);
      }
    };
  }, []);

  /* biome-ignore lint/correctness/useExhaustiveDependencies: `transform` is not read in the body
     — it is the reset trigger. Dropping it, as the rule suggests, would carry one document's
     too-tall verdict and headings over to the next. */
  useEffect(() => {
    setTooTall(false);
    setHeadings([]);
  }, [transform]);

  /* biome-ignore lint/correctness/useExhaustiveDependencies: `showRendered` is not read in the
     body — it is what says the iframe is mounted, so the observer binds to the element that now
     exists. Dropping it, as the rule suggests, would leave the width unobserved after a toggle
     back from the source view. */
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }
    let width = frame.getBoundingClientRect().width;
    // One observer covers every way the width changes — window resize, Explorer
    // splitter drag, outline open/close — because all three reach the frame as a
    // resize of the element. Height changes are this component's own doing and
    // are ignored.
    const observer = new ResizeObserver(() => {
      const next = frame.getBoundingClientRect().width;
      if (next === width) {
        return;
      }
      width = next;
      // A reflow at a new width is an external cause, so the budget is refilled
      // rather than spent down over a session — decision-3 names exhausting it
      // here as what leaves the height stale.
      passes.current = 0;
      scheduleMeasure(true);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [scheduleMeasure, showRendered]);

  /* The anchor is captured continuously rather than just before a reload. A
     `srcdoc` swap replaces the frame's document asynchronously, so there is no
     moment the parent can rely on across three WebViews where the new markup is
     committed and the old document is still readable. */
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) {
      return;
    }
    let ticking = false;
    const onScroll = () => {
      if (ticking) {
        return;
      }
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        anchor.current = captureScrollAnchor(scroller, headingsRef.current, frameRoot);
      });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [frameRoot]);

  // The bar is pinned over the top of the scroll container, so a heading must
  // clear it to be visible. Measured rather than taken from `$doc-bar-height`,
  // whose comment calls its 42px an approximation of this row; the SCSS constant
  // stays as the fallback for the paint before this runs (TASK-20).
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const bar = barRef.current;
    if (!scroller || !bar) {
      return;
    }
    scroller.style.setProperty('--doc-bar-height', `${bar.getBoundingClientRect().height}px`);
  });

  function toggleOutline() {
    setOutlineOpen((v) => {
      const next = !v;
      writeOutlineOpen(next);
      return next;
    });
  }

  return (
    <div className="doc-scroll" ref={scrollRef}>
      <div className={`doc${showOutline ? '' : ' is-outline-closed'}`}>
        <div className="doc__bar" ref={barRef}>
          {showRendered && hasOutline && (
            <button
              type="button"
              className="icon-btn doc-outline-toggle"
              title={t('outline')}
              aria-label={t('outline')}
              aria-expanded={showOutline}
              onClick={toggleOutline}
            >
              <TableOfContentsIcon />
            </button>
          )}
          {renderable && (
            /* biome-ignore lint/a11y/useSemanticElements: role="group" is the ARIA pattern for a
               button cluster; <fieldset> is for form controls and requires a <legend>, while the
               label is already carried by aria-label. */
            <div className="seg" role="group" aria-label={t('viewMode')}>
              <button
                type="button"
                className={`btn${mode === 'rendered' ? ' is-active' : ''}`}
                title={t('rendered')}
                aria-label={t('rendered')}
                aria-pressed={mode === 'rendered'}
                onClick={() => setMode('rendered')}
              >
                <ScanSearchIcon />
              </button>
              <button
                type="button"
                className={`btn${mode === 'source' ? ' is-active' : ''}`}
                title={t('source')}
                aria-label={t('source')}
                aria-pressed={mode === 'source'}
                onClick={() => setMode('source')}
              >
                <CodeIcon />
              </button>
            </div>
          )}
        </div>

        {!renderable && <p className="src-notice">{tooTall ? t('htmlTooTall') : t('htmlRenderSkipped')}</p>}

        {showRendered ? (
          <div className="doc__body">
            <iframe
              ref={frameRef}
              className="html-frame"
              title={file.name}
              sandbox="allow-same-origin"
              srcDoc={transform.html ?? ''}
              onLoad={onFrameLoad}
            />
            {showOutline && <Outline headings={headings} scrollRef={scrollRef} root={frameRoot} />}
          </div>
        ) : (
          <SourceView source={source} lang="html" />
        )}
      </div>
    </div>
  );
}
