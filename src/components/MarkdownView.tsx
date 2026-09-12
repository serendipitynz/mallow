import { openUrl } from '@tauri-apps/plugin-opener';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { UNATTENDED } from '../lib/build-flags';
import { enhanceCodeBlocks } from '../lib/codeblock';
import { useT } from '../lib/i18n';
import { getMarkdownConfigVersion, type RenderResult, renderMarkdown, subscribeMarkdownConfig } from '../lib/markdown';
import { setMarkdownPreviewActive } from '../lib/markdown-preview';
import { renderMermaid } from '../lib/mermaid';
import { onOutlineOpenChange, readOutlineOpen, writeOutlineOpen } from '../lib/outline-pref';
import { notifyRenderSettled } from '../lib/render-signal';
import { captureScrollAnchor, restoreScrollAnchor, type ScrollAnchor } from '../lib/scroll';
import { broadcastSetting } from '../lib/settings-sync';
import { CodeIcon, ScanSearchIcon, TableOfContentsIcon } from './icons';
import { Outline } from './Outline';
import { SourceView } from './SourceView';

export function MarkdownView({ source }: { source: string }) {
  const t = useT();
  const [result, setResult] = useState<RenderResult | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const outlineOpen = useSyncExternalStore(onOutlineOpenChange, readOutlineOpen);
  const [mode, setMode] = useState<'preview' | 'source'>('preview');
  const scrollRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLDivElement>(null);
  // Scroll position captured before a live re-render, restored after it mounts.
  const pendingRestore = useRef<ScrollAnchor>(null);
  const resultRef = useRef<RenderResult | null>(null);
  resultRef.current = result;
  // Re-render the open document when the pipeline is reconfigured (custom emoji
  // changed in Settings) instead of making the user reopen the file.
  const configVersion = useSyncExternalStore(subscribeMarkdownConfig, getMarkdownConfigVersion);

  /* biome-ignore lint/correctness/useExhaustiveDependencies: configVersion is not read in the body
     — it is the re-render trigger. Dropping it, as the rule suggests, would leave an open document
     showing the old emoji table after Settings changes it. */
  useEffect(() => {
    let cancelled = false;
    // Capture against the still-mounted previous content before swapping it.
    pendingRestore.current = captureScrollAnchor(scrollRef.current, resultRef.current?.headings ?? []);
    setRenderError(null);
    renderMarkdown(source)
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
  }, [source, configVersion]);

  // After the article mounts (in preview mode), run the imperative enhancements,
  // bind external-link handling, and restore the scroll position. Keyed on `mode`
  // too so toggling source → preview re-applies them to the freshly mounted DOM.
  useEffect(() => {
    if (mode !== 'preview' || !result) {
      return;
    }
    const article = articleRef.current;
    if (!article) {
      return;
    }

    enhanceCodeBlocks(article);
    const mermaid = renderMermaid(article);

    /* The unattended export needs to know when this article stops changing, and
       nothing else does — so both the wait and the report are inside the branch
       an ordinary build drops (`lib/build-flags`). What it waits for is the two
       things that arrive after the HTML: mermaid replacing its own `<pre>`, and
       the images loading. A timer instead would sometimes print a diagram's
       source, which is indistinguishable from TASK-29's bug on the paper. */
    if (UNATTENDED) {
      void (async () => {
        await mermaid.catch(() => {});
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
  }, [result, mode]);

  // The bar is pinned over the top of the scroll container, so a heading must clear
  // it to be visible. Two things need that height and they are in different
  // languages — `scroll-margin-top` for the jump, the scroll spy for the highlight —
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
    if (mode !== 'preview') {
      return;
    }
    setMarkdownPreviewActive(true);
    return () => setMarkdownPreviewActive(false);
  }, [mode]);

  const headings = result?.headings ?? [];
  const hasOutline = headings.length > 1;
  const showOutline = mode === 'preview' && hasOutline && outlineOpen;

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
          {mode === 'preview' && hasOutline && (
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
          {/* biome-ignore lint/a11y/useSemanticElements: role="group" is the ARIA pattern for a
              button cluster; <fieldset> is for form controls and requires a <legend>, while the
              label is already carried by aria-label. */}
          <div className="seg" role="group" aria-label={t('viewMode')}>
            <button
              type="button"
              className={`btn${mode === 'preview' ? ' is-active' : ''}`}
              title={t('preview')}
              aria-label={t('preview')}
              aria-pressed={mode === 'preview'}
              onClick={() => setMode('preview')}
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
        </div>

        {mode === 'preview' ? (
          <>
            {renderError && <div className="doc-error">{t('renderError', { message: renderError })}</div>}
            <div className="doc__body">
              <article
                ref={articleRef}
                className="markdown-body"
                /* biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is rendered at
                   runtime, so injecting the HTML is the mechanism, not an oversight. What keeps it
                   safe is the boundary AGENTS.md sets out under "Untrusted-Markdown boundary":
                   markdown-it runs with html: false, its validateLink drops dangerous schemes, and
                   the CSP forbids inline script. Read that section before changing this. */
                dangerouslySetInnerHTML={{ __html: result?.html ?? '' }}
              />
              {showOutline && <Outline headings={headings} scrollRef={scrollRef} />}
            </div>
          </>
        ) : (
          <SourceView source={source} lang="markdown" />
        )}
      </div>
    </div>
  );
}
