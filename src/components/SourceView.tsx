import { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ShikiTransformer } from 'shiki';
import { useT } from '../lib/i18n';
import { getHighlighter, SHIKI_THEMES, stripPreBackground } from '../lib/shiki';
import { countLines, highlightSkipReason } from '../lib/source-cap';

/** Shared syntax-highlighted source view with line numbers. Used as one mode of
 *  the markdown viewer (preview/source), the config viewer (tree/source), the
 *  table viewer (table/source) and the xml viewer (tree/source), and as the whole
 *  view for the kinds that have no second mode (text/ini/diff/sql, and html until
 *  its rendered view gives it one). */

function errorLineTransformer(line: number): ShikiTransformer {
  return {
    name: 'mallow-error-line',
    line(node, lineNumber) {
      if (lineNumber === line) {
        this.addClassToHast(node, 'src-error-line');
      }
    },
  };
}

/**
 * Digits the number column has to fit, for both paths. Floored at 4 so ordinary
 * documents keep the width the view has always had, and grown past it because
 * the unhighlighted path begins at 10,000 lines and a 10 MiB log reaches seven.
 */
function gutterDigits(lineCount: number): string {
  return String(Math.max(4, String(lineCount).length));
}

interface SourceViewProps {
  source: string;
  /** Shiki grammar id; falls back to plain text when not loaded. */
  lang: string;
  /** 1-based line to flag + scroll to (used for config parse errors). */
  errorLine?: number;
}

/**
 * Above the caps in `lib/source-cap` the whole document is still shown, without
 * highlighting (decision-6). Callers get that fallback for free — no size check
 * of their own is needed before rendering this.
 */
export function SourceView({ source, lang, errorLine }: SourceViewProps) {
  const t = useT();
  const [html, setHtml] = useState('');
  const hostRef = useRef<HTMLDivElement>(null);
  // Trim trailing newlines so there is no spurious empty final line number. The
  // CR is in the class because a CRLF file would otherwise end on a lone CR,
  // which `countLines` does not count but an engine that breaks on it would show.
  const code = useMemo(() => source.replace(/[\r\n]+$/, ''), [source]);
  const skipReason = useMemo(() => highlightSkipReason(code), [code]);
  const lineCount = useMemo(() => countLines(code), [code]);

  useEffect(() => {
    if (skipReason !== null) {
      setHtml('');
      return;
    }
    let cancelled = false;
    getHighlighter().then((hl) => {
      if (cancelled) {
        return;
      }
      const resolvedLang = hl.getLoadedLanguages().includes(lang) ? lang : 'text';
      const transformers: ShikiTransformer[] = [stripPreBackground];
      if (errorLine !== undefined) {
        transformers.push(errorLineTransformer(errorLine));
      }
      setHtml(hl.codeToHtml(code, { themes: SHIKI_THEMES, lang: resolvedLang, transformers }));
    });
    return () => {
      cancelled = true;
    };
  }, [code, lang, errorLine, skipReason]);

  /* biome-ignore lint/correctness/useExhaustiveDependencies: `html` and `code` are not read in the
     body — they are the re-run triggers. The flagged line only exists after the path that owns it
     has put it in the DOM, and a live reload can move it (a config edit that shifts the parse
     error): dropping them, as the rule suggests, would leave the view scrolled to the old line. */
  useEffect(() => {
    if (errorLine === undefined) {
      return;
    }
    hostRef.current?.querySelector('.src-error-line')?.scrollIntoView({ block: 'center' });
  }, [html, code, errorLine]);

  return (
    <div className="src-view" ref={hostRef} style={{ '--src-gutter-digits': gutterDigits(lineCount) } as CSSProperties}>
      {skipReason !== null && <p className="src-notice">{t('highlightSkipped')}</p>}
      {skipReason !== null ? (
        <PlainSource code={code} lineCount={lineCount} errorLine={errorLine} />
      ) : (
        /* biome-ignore lint/security/noDangerouslySetInnerHtml: the HTML here is Shiki's own output
           for the file's text, not the file's text. Shiki escapes what it highlights, so the document
           cannot contribute markup. This is the same boundary AGENTS.md sets out under
           "Untrusted-Markdown boundary", with the CSP as the second layer. */
        <div dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  );
}

/**
 * The whole text as one text node, with the line numbers as a second one — so a
 * document costs a constant number of DOM nodes however long it is. Lines do not
 * wrap here: a wrapped line would slip out of step with the number column.
 */
function PlainSource({ code, lineCount, errorLine }: { code: string; lineCount: number; errorLine?: number }) {
  const numbers = useMemo(() => Array.from({ length: lineCount }, (_, i) => i + 1).join('\n'), [lineCount]);
  const flagged = errorLine !== undefined && errorLine <= lineCount ? errorLine : undefined;
  const codeRef = useRef<HTMLPreElement>(null);
  const flagRef = useRef<HTMLDivElement>(null);

  /**
   * Place the band from the line height layout actually used, not from the
   * declared one: WebKit lays each line box out at an integer height, so the
   * 20.8px this view declares is used as 20px and a band computed from 20.8
   * drifts a line every 25 — 720 lines off by line 18,000. Measured against the
   * text itself, the two cannot disagree. In a layout effect and through the
   * ref rather than state, so the band is in place before paint and before the
   * parent's scroll effect looks for it.
   */
  useLayoutEffect(() => {
    const codeEl = codeRef.current;
    const flagEl = flagRef.current;
    if (!codeEl || !flagEl || flagged === undefined) {
      return;
    }
    const lineHeight = codeEl.getBoundingClientRect().height / lineCount;
    if (lineHeight <= 0) {
      return;
    }
    flagEl.style.top = `${(flagged - 1) * lineHeight}px`;
    flagEl.style.height = `${lineHeight}px`;
  }, [flagged, lineCount]);

  return (
    <div className="src-plain">
      <pre className="src-plain__gutter" aria-hidden="true">
        {numbers}
      </pre>
      <div className="src-plain__body">
        {/* Every line has the same height here, so the flag is one positioned band
            rather than a class on a per-line element that this path does not emit. */}
        {flagged !== undefined && <div ref={flagRef} className="src-plain__flag src-error-line" />}
        <pre className="src-plain__code" ref={codeRef}>
          {code}
        </pre>
      </div>
    </div>
  );
}
