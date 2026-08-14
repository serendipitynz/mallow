import { useEffect, useRef, useState } from 'react';
import { renderMermaid } from '../lib/mermaid';

/** Render a standalone `.mmd` / `.mermaid` file as a single diagram. */
export function MermaidView({ source }: { source: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(false);

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
    void renderMermaid(host);
  }, [source]);

  return (
    <div className="doc-scroll">
      <div className="doc">
        {empty && <p className="doc-error">空のファイルです。</p>}
        <div className="markdown-body" ref={hostRef} />
      </div>
    </div>
  );
}
