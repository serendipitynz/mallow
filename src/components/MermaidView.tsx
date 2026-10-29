import { useEffect, useRef, useState } from 'react';
import { useLeaveReport, useRememberedScroll, type ViewMemory } from '../hooks/useViewMemory';
import { useT } from '../lib/i18n';
import { renderMermaid } from '../lib/mermaid';
import { captureScrollAnchor } from '../lib/scroll';
import { Notice } from './Notice';

/** Render a standalone `.mmd` / `.mermaid` file as a single diagram. */
export function MermaidView({ source, memory }: { source: string; memory: ViewMemory }) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useRememberedScroll(scrollRef, memory.remembered?.anchor ?? null);
  useLeaveReport(memory, scrollRef, (scroller) => ({ mode: null, anchor: captureScrollAnchor(scroller, []) }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const code = source.trim();
    setEmpty(code.length === 0);
    host.innerHTML = '';
    if (!code) {
      return;
    }

    const pre = document.createElement('pre');
    pre.className = 'mermaid';
    pre.textContent = code;
    host.appendChild(pre);
  }, [source]);

  /* biome-ignore lint/correctness/useExhaustiveDependencies: `source` is not read in the body — it
     is the re-run trigger, since the effect above has just replaced the block this one renders. Kept
     apart from it so that a language switch re-marks a diagram that failed without tearing down one
     that drew: renderMermaid finds only the blocks still left as source. */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    renderMermaid(host, (message) => t('mermaidFailed', { message })).catch((e) =>
      console.error('Failed to render the mermaid diagram', e),
    );
  }, [source, t]);

  return (
    <div className="doc-scroll" ref={scrollRef}>
      <div className="doc">
        {empty && (
          <Notice level="info" className="notice--doc">
            {t('mermaidEmpty')}
          </Notice>
        )}
        <div className="markdown-body" ref={hostRef} />
      </div>
    </div>
  );
}
