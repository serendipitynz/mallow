import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import type { ShikiTransformer } from 'shiki';
import { useT } from '../lib/i18n';
import { getHighlighter, SHIKI_THEMES, stripPreBackground } from '../lib/shiki';
import { countLines, highlightSkipReason } from '../lib/source-cap';

/** Shared syntax-highlighted source view with line numbers. Used by both the
 *  markdown viewer (preview/source toggle) and the config viewer (tree/source). */

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
  // Trim trailing newlines so there is no spurious empty final line number.
  const code = useMemo(() => source.replace(/\n+$/, ''), [source]);
  const skipReason = useMemo(() => highlightSkipReason(code), [code]);

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

  // Scroll the flagged line into view once it is in the DOM. Both paths put it
  // there, so this waits on whichever one rendered it.
  const flagRendered = skipReason !== null || html !== '';
  useEffect(() => {
    if (errorLine === undefined || !flagRendered) {
      return;
    }
    hostRef.current?.querySelector('.src-error-line')?.scrollIntoView({ block: 'center' });
  }, [flagRendered, errorLine]);

  return (
    <div className="src-view" ref={hostRef}>
      {skipReason !== null && <p className="src-notice">{t('highlightSkipped')}</p>}
      {skipReason !== null ? (
        <PlainSource code={code} errorLine={errorLine} />
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
function PlainSource({ code, errorLine }: { code: string; errorLine?: number }) {
  const lineCount = useMemo(() => countLines(code), [code]);
  const numbers = useMemo(() => Array.from({ length: lineCount }, (_, i) => i + 1).join('\n'), [lineCount]);
  const flagged = errorLine !== undefined && errorLine <= lineCount ? errorLine : undefined;

  return (
    <div className="src-plain">
      <pre className="src-plain__gutter" aria-hidden="true">
        {numbers}
      </pre>
      <div className="src-plain__body">
        {/* Every line has the same height here, so the flag is one positioned band
            rather than a class on a per-line element that this path does not emit. */}
        {flagged !== undefined && (
          <div
            className="src-plain__flag src-error-line"
            style={{ '--flagged-line': String(flagged) } as CSSProperties}
          />
        )}
        <pre className="src-plain__code">{code}</pre>
      </div>
    </div>
  );
}
