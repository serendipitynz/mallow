import { convertFileSrc } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useOutlineFocusReturn } from '../hooks/useOutlineFocusReturn';
import { useLeaveReport, useRememberedScroll, type ViewMemory } from '../hooks/useViewMemory';
import { UNATTENDED } from '../lib/build-flags';
import { onMacPlatform } from '../lib/chord';
import { enhanceCodeBlocks } from '../lib/codeblock';
import { setFindTarget } from '../lib/find-target';
import { useT } from '../lib/i18n';
import { isDeck } from '../lib/is-deck';
import { getMarkdownConfigVersion, type RenderResult, renderMarkdown, subscribeMarkdownConfig } from '../lib/markdown';
import { setMarkdownPreviewActive } from '../lib/markdown-preview';
import { renderMermaid } from '../lib/mermaid';
import { onOutlineOpenChange, readOutlineOpen, writeOutlineOpen } from '../lib/outline-pref';
import { dirname } from '../lib/path';
import { type PresentPlace, presentChordLabel, setPresenter } from '../lib/present';
import { onProseMeasureChange, readProseMeasure } from '../lib/prose-measure';
import { notifyRenderSettled } from '../lib/render-signal';
import { captureScrollAnchor, restoreScrollAnchor, type ScrollAnchor } from '../lib/scroll';
import { broadcastSetting } from '../lib/settings-sync';
import { clampSlide } from '../lib/slide-nav';
import { rememberedMode } from '../lib/visit-history';
import { DeckView } from './DeckView';
import { AppWindowIcon, CodeIcon, PlayIcon, PresentationIcon, ScanSearchIcon, TableOfContentsIcon } from './icons';
import { Notice } from './Notice';
import { Outline } from './Outline';
import { Segmented } from './Segmented';
import { SourceView } from './SourceView';
import { ViewPanel } from './ViewPanel';

const MODES = ['preview', 'source'] as const;
/** A deck adds Slides (TASK-51.2); every other document keeps the two. */
const DECK_MODES = ['preview', 'source', 'slides'] as const;

type Mode = (typeof DECK_MODES)[number];

export function MarkdownView({ source, path, memory }: { source: string; path: string; memory: ViewMemory }) {
  const t = useT();
  const [result, setResult] = useState<RenderResult | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const outlineOpen = useSyncExternalStore(onOutlineOpenChange, readOutlineOpen);
  const proseMeasure = useSyncExternalStore(onProseMeasureChange, readProseMeasure);
  const deck = useMemo(() => isDeck(source), [source]);
  const [mode, setMode] = useState<Mode>(
    () => rememberedMode(memory.remembered, isDeck(source) ? DECK_MODES : MODES) ?? 'preview',
  );
  const [slide, setSlide] = useState(() => memory.remembered?.slide ?? 0);
  const [slideCount, setSlideCount] = useState<number | null>(null);
  const [presenting, setPresenting] = useState<PresentPlace | null>(null);
  // A live reload that removes `marp: true` takes Slides away with it.
  const shownMode: Mode = mode === 'slides' && !deck ? 'preview' : mode;
  const scrollRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLDivElement>(null);
  const idBase = useId();
  const outlineId = `${idBase}-outline`;
  const onOutlineFocusDropped = useOutlineFocusReturn(barRef);
  // Scroll position captured before a live re-render, restored after it mounts.
  const pendingRestore = useRef<ScrollAnchor>(null);
  const resultRef = useRef<RenderResult | null>(null);
  resultRef.current = result;
  useRememberedScroll(scrollRef, memory.remembered?.anchor ?? null);
  // In source mode the headings are not in the DOM, so the ratio is all there is.
  useLeaveReport(memory, scrollRef, (scroller) => ({
    mode: shownMode,
    anchor: captureScrollAnchor(scroller, shownMode === 'preview' ? (result?.headings ?? []) : []),
    ...(deck ? { slide: slideCount === null ? slide : clampSlide(slide, slideCount) } : {}),
  }));
  // Re-render the open document when the pipeline is reconfigured (custom emoji
  // changed in Settings) instead of making the user reopen the file.
  const configVersion = useSyncExternalStore(subscribeMarkdownConfig, getMarkdownConfigVersion);

  /* biome-ignore lint/correctness/useExhaustiveDependencies: configVersion is not read in the body
     — it is the re-render trigger. Dropping it, as the rule suggests, would leave an open document
     showing the old emoji table after Settings changes it. */
  useEffect(() => {
    let cancelled = false;
    // Capture against the still-mounted previous content before swapping it.
    // Only once there is one: against the empty first mount this would be a
    // ratio of 0, and restoring it would undo the remembered position.
    pendingRestore.current = resultRef.current
      ? captureScrollAnchor(scrollRef.current, resultRef.current.headings)
      : null;
    setRenderError(null);
    renderMarkdown(source, { images: { dir: dirname(path), toAssetUrl: convertFileSrc } })
      .then((r) => {
        if (!cancelled) {
          setResult(r);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setRenderError(String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source, path, configVersion]);

  // After the article mounts (in preview mode), run the imperative enhancements,
  // bind external-link handling, and restore the scroll position. Keyed on `mode`
  // too so toggling source → preview re-applies them to the freshly mounted DOM.
  useEffect(() => {
    if (shownMode !== 'preview' || !result) {
      return;
    }
    const article = articleRef.current;
    if (!article) {
      return;
    }

    enhanceCodeBlocks(article);
    const mermaid = renderMermaid(article, (message) => t('mermaidFailed', { message })).catch((e) =>
      console.error('Failed to render mermaid diagrams', e),
    );

    /* The unattended export needs to know when this article stops changing, and
       nothing else does — so both the wait and the report are inside the branch
       an ordinary build drops (`lib/build-flags`). What it waits for is the two
       things that arrive after the HTML: mermaid replacing its own `<pre>`, and
       the images loading. A timer instead would sometimes print a diagram's
       source, which is indistinguishable from TASK-29's bug on the paper. */
    if (UNATTENDED) {
      void (async () => {
        await mermaid;
        await Promise.all(
          [...article.querySelectorAll('img')].map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  img.addEventListener('load', () => resolve(), { once: true });
                  img.addEventListener('error', () => resolve(), { once: true });
                }),
          ),
        );
        notifyRenderSettled();
      })();
    }

    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) {
        return;
      }
      const href = anchor.getAttribute('href') ?? '';
      // In-page anchors (e.g. `[jump](#section)`) scroll within the document.
      if (href.startsWith('#')) {
        return;
      }
      // Anything else must never navigate the app's own WebView away. Real web
      // links open in the OS browser; every other scheme (relative paths, file:,
      // data:, mailto:, and — as defense in depth — javascript:) is treated as
      // inert. markdown-it already strips dangerous link schemes (see lib/markdown.ts),
      // so this is a second layer rather than the only guard.
      e.preventDefault();
      if (/^https?:\/\//i.test(href)) {
        void openUrl(href).catch((err) => console.error('openUrl failed', err));
      }
    };
    article.addEventListener('click', onClick);

    const anchor = pendingRestore.current;
    pendingRestore.current = null;
    restoreScrollAnchor(scrollRef.current, anchor);
    // Mermaid renders asynchronously and changes height; restore once more next frame.
    const raf = requestAnimationFrame(() => restoreScrollAnchor(scrollRef.current, anchor));

    return () => {
      article.removeEventListener('click', onClick);
      cancelAnimationFrame(raf);
    };
  }, [result, shownMode, t]);

  // The bar is pinned over the top of the scroll container, so a heading must clear
  // it to be visible. Two things need that height and they are in different
  // languages — `scroll-padding-top` for the jump, the scroll spy for the highlight —
  // so it is published on the scroll container for both. Measured rather than taken
  // from `$doc-bar-height`, whose comment calls its 42px an approximation of this
  // row; the SCSS constant stays as the fallback for the paint before this runs.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const bar = barRef.current;
    if (!scroller || !bar) {
      return;
    }
    scroller.style.setProperty('--doc-bar-height', `${bar.getBoundingClientRect().height}px`);
  });

  /* `Print…` (decision-13) and `Export as PDF…` (decision-14) are both disabled
     unless the active view is markdown in preview, and being mounted with `mode`
     at `preview` *is* that condition — so this reports the condition rather than
     either entry keeping a copy of it. It cannot be written as
     `file.kind === 'markdown'`: that is true of the source half of this toggle,
     which neither entry may act on.

     **The keydown handlers are not here, and that is a correction rather than a
     preference.** Printing's used to be, on the reasoning that a view which
     cannot be printed should register no entry. On Windows that is what let a
     `.csv` be printed: WebView2 has its own `Ctrl+P`, so registering nothing
     hands the chord to the platform instead of making it inert. Both handlers now
     live in `App` for the life of the app and consume their chord
     unconditionally — see `lib/chord`. */
  useEffect(() => {
    if (shownMode !== 'preview') {
      return;
    }
    setMarkdownPreviewActive(true);
    return () => setMarkdownPreviewActive(false);
  }, [shownMode]);

  // Find searches the article in preview; in source the `SourceView` below
  // registers itself.
  useEffect(() => {
    const article = articleRef.current;
    const scroller = scrollRef.current;
    if (shownMode !== 'preview' || !article || !scroller) {
      return;
    }
    return setFindTarget({ root: article, scroller });
  }, [shownMode]);

  /* A deck registers the window's presenter, which the chords reach from any of
     the three modes: presenting is always of the Slides view, from the slide it
     was left on. */
  useEffect(() => {
    if (!deck) {
      return;
    }
    return setPresenter((place) => {
      setMode('slides');
      setPresenting(place);
    });
  }, [deck]);
  useEffect(() => {
    if (shownMode !== 'slides') {
      setPresenting(null);
    }
  }, [shownMode]);
  const endPresentation = useCallback(() => setPresenting(null), []);

  /* **Memoised on `result`, and that is the fix for TASK-29 rather than a
     render optimisation.** React 19 compares this prop by identity and writes
     `innerHTML` whenever the object differs, so a literal here re-injected the
     article on every render — any state change anywhere above put back the
     `<pre class="mermaid">` the enhancement effect had replaced, and took the
     code-copy buttons with it, while that effect, keyed on `result`, did not run
     again. Keyed on `result`, the HTML is written exactly when the enhancements
     re-run. Not keyed on the string: a new `result` with the same HTML re-runs the
     effect, which then has to find the markup it enhances, not markup it already
     did. */
  const articleHtml = useMemo(() => ({ __html: result?.html ?? '' }), [result]);

  const headings = result?.headings ?? [];
  const hasOutline = headings.length > 1;
  const showOutline = shownMode === 'preview' && hasOutline && outlineOpen;

  function toggleOutline() {
    const next = !outlineOpen;
    writeOutlineOpen(next);
    // The outline preference is app-wide — it is already one preference across
    // the views that have one — so the windows already open have to follow.
    broadcastSetting({ key: 'outlineOpen', value: next });
  }

  return (
    <div className="doc-scroll" ref={scrollRef}>
      <div className={`doc${showOutline ? '' : ' is-outline-closed'}`}>
        <div className="doc__bar" ref={barRef}>
          {shownMode === 'preview' && hasOutline && (
            <button
              type="button"
              className="icon-btn doc-outline-toggle"
              title={t('outline')}
              aria-label={t('outline')}
              aria-expanded={showOutline}
              aria-controls={outlineId}
              onClick={toggleOutline}
            >
              <TableOfContentsIcon />
            </button>
          )}
          {shownMode === 'slides' && (
            <>
              <button
                type="button"
                className="icon-btn"
                title={`${t('present')} (${presentChordLabel('fullscreen', onMacPlatform())})`}
                aria-label={t('present')}
                onClick={() => setPresenting('fullscreen')}
              >
                <PlayIcon />
              </button>
              <button
                type="button"
                className="icon-btn"
                title={`${t('presentInWindow')} (${presentChordLabel('window', onMacPlatform())})`}
                aria-label={t('presentInWindow')}
                onClick={() => setPresenting('window')}
              >
                <AppWindowIcon />
              </button>
            </>
          )}
          <Segmented<Mode>
            idBase={idBase}
            label={t('viewMode')}
            options={[
              { value: 'preview', label: t('preview'), icon: <ScanSearchIcon /> },
              { value: 'source', label: t('source'), icon: <CodeIcon /> },
              // After the two every document has, so neither moves when a deck is opened.
              ...(deck ? [{ value: 'slides' as const, label: t('slides'), icon: <PresentationIcon /> }] : []),
            ]}
            value={shownMode}
            onSelect={setMode}
          />
        </div>

        <ViewPanel idBase={idBase} selected={shownMode}>
          {shownMode === 'preview' ? (
            <>
              {renderError && (
                <Notice level="failure" className="notice--doc">
                  {t('renderError', { message: renderError })}
                </Notice>
              )}
              <div className="doc__body">
                {/* Ahead of the article so it follows the toggle in the reading order; the grid
                    still places it beside the article. */}
                {showOutline && (
                  <Outline
                    id={outlineId}
                    headings={headings}
                    scrollRef={scrollRef}
                    onFocusDropped={onOutlineFocusDropped}
                  />
                )}
                <article
                  ref={articleRef}
                  className="markdown-body"
                  data-prose-measure={proseMeasure}
                  /* biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is rendered at
                     runtime, so injecting the HTML is the mechanism, not an oversight. What keeps it
                     safe is the boundary AGENTS.md sets out under "Untrusted-Markdown boundary":
                     markdown-it runs with html: false, its validateLink drops dangerous schemes, and
                     the CSP forbids inline script. Read that section before changing this. */
                  dangerouslySetInnerHTML={articleHtml}
                />
              </div>
            </>
          ) : shownMode === 'slides' ? (
            <DeckView
              source={source}
              path={path}
              index={slide}
              onIndex={setSlide}
              presenting={presenting}
              onPresentEnd={endPresentation}
              onSlideCount={setSlideCount}
            />
          ) : (
            <SourceView source={source} lang="markdown" />
          )}
        </ViewPanel>
      </div>
    </div>
  );
}
