import { convertFileSrc } from '@tauri-apps/api/core';
import { useMemo, useRef, useState } from 'react';
import { transformHtmlDocument } from '../lib/html-doc';
import { useT } from '../lib/i18n';
import { dirname } from '../lib/path';
import type { FileEntry } from '../lib/types';
import { CodeIcon, ScanSearchIcon } from './icons';
import { SourceView } from './SourceView';

/**
 * The HTML rendered view: the document in an iframe fed through `srcdoc`, with a
 * toggle to the source view (decision-3, amended by decision-9).
 *
 * This owns the only `DOMParser` call in the app's HTML path — `lib/html-doc`
 * decides everything else and stays testable under Node (doc-1).
 *
 * `sandbox="allow-same-origin"` with **no** `allow-scripts`: no script in the
 * document runs, while the parent can still read and drive `contentDocument`,
 * which is what TASK-5.2's outline, height and link handling rest on. The two
 * flags are a pair, not two independent choices — together they would let a
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
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Above the render ceiling nothing was serialized, so the source view is not a
  // mode the reader chose but the only one there is (decision-6 makes it a floor
  // that holds at any size).
  const renderable = transform.html !== null;
  const showRendered = mode === 'rendered' && renderable;

  /* Size the frame to its content so the app's scroller stays the only scroller —
     a frame with a viewport of its own would break fragment links, the outline's
     jump and keyboard scrolling at once (decision-3).

     One pass, on load. TASK-5.2 replaces this with the bounded convergence that
     a document whose height depends on the viewport needs, the observers that
     notice late layout, the re-measurement on a width change, and the
     maximum-height fallback. Until then a document that grows on its own applied
     height simply keeps the first measurement. */
  function sizeToContent() {
    const frame = frameRef.current;
    const frameDocument = frame?.contentDocument;
    if (!frame || !frameDocument) {
      return;
    }
    frame.style.height = `${frameDocument.documentElement.scrollHeight}px`;
  }

  return (
    <div className="doc-scroll">
      <div className="doc">
        <div className="doc__bar">
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

        {!renderable && <p className="src-notice">{t('htmlRenderSkipped')}</p>}

        {showRendered ? (
          <iframe
            ref={frameRef}
            className="html-frame"
            title={file.name}
            sandbox="allow-same-origin"
            srcDoc={transform.html ?? ''}
            onLoad={sizeToContent}
          />
        ) : (
          <SourceView source={source} lang="html" />
        )}
      </div>
    </div>
  );
}
