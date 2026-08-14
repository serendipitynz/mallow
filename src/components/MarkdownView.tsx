import { openUrl } from '@tauri-apps/plugin-opener';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { enhanceCodeBlocks } from '../lib/codeblock';
import { useT } from '../lib/i18n';
import {
  getMarkdownConfigVersion,
  renderMarkdown,
  subscribeMarkdownConfig,
  type RenderResult,
} from '../lib/markdown';
import { renderMermaid } from '../lib/mermaid';
import { captureScrollAnchor, restoreScrollAnchor, type ScrollAnchor } from '../lib/scroll';
import { CodeIcon, ScanSearchIcon, TableOfContentsIcon } from './icons';
import { Outline } from './Outline';
import { SourceView } from './SourceView';

const OUTLINE_KEY = 'doc-outline:open';

function readOutlineOpen(): boolean {
  try {
    return localStorage.getItem(OUTLINE_KEY) !== '0';
  } catch {
    return true;
  }
}

function writeOutlineOpen(open: boolean): void {
  try {
    localStorage.setItem(OUTLINE_KEY, open ? '1' : '0');
  } catch {
    // Non-fatal: the toggle still works for this view.
  }
}

export function MarkdownView({ source }: { source: string }) {
  const t = useT();
  const [result, setResult] = useState<RenderResult | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [outlineOpen, setOutlineOpen] = useState<boolean>(readOutlineOpen);
  const [mode, setMode] = useState<'preview' | 'source'>('preview');
  const scrollRef = useRef<HTMLDivElement>(null);
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
        if (!cancelled) setResult(r);
      })
      .catch((e) => {
        if (!cancelled) setRenderError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [source, configVersion]);

  // After the article mounts (in preview mode), run the imperative enhancements,
  // bind external-link handling, and restore the scroll position. Keyed on `mode`
  // too so toggling source → preview re-applies them to the freshly mounted DOM.
  useEffect(() => {
    if (mode !== 'preview' || !result) return;
    const article = articleRef.current;
    if (!article) return;

    enhanceCodeBlocks(article);
    void renderMermaid(article);

    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      // In-page anchors (e.g. `[jump](#section)`) scroll within the document.
      if (href.startsWith('#')) return;
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

  const headings = result?.headings ?? [];
  const hasOutline = headings.length > 1;
  const showOutline = mode === 'preview' && hasOutline && outlineOpen;

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
        <div className="doc__bar">
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
              {/* biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is rendered at
                  runtime, so injecting the HTML is the mechanism, not an oversight. What keeps
                  it safe is the boundary AGENTS.md sets out under "Untrusted-Markdown boundary":
                  markdown-it runs with html: false, its validateLink drops dangerous schemes,
                  and the CSP forbids inline script. Read that section before changing this. */}
              <article ref={articleRef} className="markdown-body" dangerouslySetInnerHTML={{ __html: result?.html ?? '' }} />
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
