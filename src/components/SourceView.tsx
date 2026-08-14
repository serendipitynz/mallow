import { useEffect, useRef, useState } from 'react';
import type { ShikiTransformer } from 'shiki';
import { getHighlighter, SHIKI_THEMES, stripPreBackground } from '../lib/shiki';

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

export function SourceView({ source, lang, errorLine }: SourceViewProps) {
  const [html, setHtml] = useState('');
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
      // Trim trailing newlines so there is no spurious empty final line number.
      const code = source.replace(/\n+$/, '');
      setHtml(hl.codeToHtml(code, { themes: SHIKI_THEMES, lang: resolvedLang, transformers }));
    });
    return () => {
      cancelled = true;
    };
  }, [source, lang, errorLine]);

  // Scroll the flagged line into view once it is in the DOM.
  useEffect(() => {
    if (errorLine === undefined || !html) {
      return;
    }
    hostRef.current?.querySelector('.src-error-line')?.scrollIntoView({ block: 'center' });
  }, [html, errorLine]);

  /* biome-ignore lint/security/noDangerouslySetInnerHtml: the HTML here is Shiki's own output for
     the file's text, not the file's text. Shiki escapes what it highlights, so the document cannot
     contribute markup. This is the same boundary AGENTS.md sets out under "Untrusted-Markdown
     boundary", with the CSP as the second layer. */
  return <div className="src-view" ref={hostRef} dangerouslySetInnerHTML={{ __html: html }} />;
}
