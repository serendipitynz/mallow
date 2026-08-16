import { useEffect, useState } from 'react';
import { useT } from '../lib/i18n';
import { type ReadError, readErrorMessage } from '../lib/read-error';
import { readFile, setWindowTitle } from '../lib/tauri';
import { documentTitle, windowTitle } from '../lib/title';
import type { FileEntry } from '../lib/types';
import { ConfigView } from './ConfigView';
import { MarkdownView } from './MarkdownView';
import { MediaView } from './MediaView';
import { MermaidView } from './MermaidView';
import { SourceView } from './SourceView';
import { TableView } from './TableView';

interface ViewerProps {
  file: FileEntry | null;
  /** Bumped by the watcher when the open file changes on disk, forcing a re-read. */
  reloadToken: number;
}

/** Kinds rendered by the WebView from the file itself, not by reading its text. */
function isMediaKind(kind: FileEntry['kind']): boolean {
  return kind === 'image' || kind === 'pdf' || kind === 'video';
}

export function Viewer({ file, reloadToken }: ViewerProps) {
  const t = useT();
  const [content, setContent] = useState<string | null>(null);
  // The cause is held rather than its message, so switching language re-renders
  // the message instead of leaving the one built when the read failed.
  const [error, setError] = useState<ReadError | null>(null);
  const [loading, setLoading] = useState(false);

  /* biome-ignore lint/correctness/useExhaustiveDependencies: keyed on file?.path, not on `file`, on
     purpose. The parent rebuilds the FileEntry object on every tree refresh, so depending on `file`
     would re-read the same document each time the watcher fires. */
  useEffect(() => {
    if (!file) {
      setContent(null);
      setError(null);
      setWindowTitle(windowTitle(null));
      return;
    }
    // Media files are rendered by the WebView from the asset URL; skip the text
    // read entirely (they are binary and may exceed the text-read size cap).
    if (isMediaKind(file.kind)) {
      setContent(null);
      setError(null);
      setLoading(false);
      setWindowTitle(windowTitle(file.name));
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Reflect the file name immediately; refine to a front-matter title once read.
    setWindowTitle(windowTitle(file.name));
    readFile(file.path)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.ok) {
          setContent(result.text);
          setWindowTitle(windowTitle(documentTitle(file, result.text)));
        } else {
          setError(result.error);
          setContent(null);
        }
      })
      // readFile itself cannot reject, but a throw anywhere above would
      // otherwise strand the viewer on the loading placeholder for good.
      .catch((e) => console.error('read failed', e))
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [file?.path, reloadToken]);

  if (!file) {
    return (
      <main className="viewer viewer--empty">
        <p>{t('selectFile')}</p>
      </main>
    );
  }

  if (isMediaKind(file.kind)) {
    return (
      <main className="viewer">
        <MediaView key={file.path} file={file} reloadToken={reloadToken} />
      </main>
    );
  }

  if (error) {
    return (
      <main className="viewer">
        <div className="viewer__placeholder is-error">
          <code>{file.path}</code>
          <p>{readErrorMessage(error, t)}</p>
        </div>
      </main>
    );
  }

  if (content === null) {
    return <main className="viewer">{loading && <div className="viewer__placeholder">{t('loading')}</div>}</main>;
  }

  return (
    <main className="viewer">
      <ViewerBody key={file.path} file={file} content={content} />
    </main>
  );
}

function ViewerBody({ file, content }: { file: FileEntry; content: string }) {
  switch (file.kind) {
    case 'markdown':
      return <MarkdownView source={content} />;
    case 'mermaid':
      return <MermaidView source={content} />;
    case 'json':
    case 'yaml':
    case 'toml':
      return <ConfigView source={content} file={file} />;
    case 'csv':
      return <TableView source={content} file={file} />;
    // The kind name doubles as the Shiki grammar id, so no kind→lang table is
    // needed: ini, diff, sql and html are in `lib/shiki`'s LANGS, and `text` is
    // what SourceView already falls back to for a grammar it has not loaded.
    // html is source-only here on purpose — decision-3 makes the rendered view
    // the default mode and this view the other half of its toggle, so shipping
    // the source first is what makes the file openable before that lands.
    case 'text':
    case 'ini':
    case 'diff':
    case 'sql':
    case 'html':
      return (
        <div className="doc-scroll">
          <div className="doc doc--no-bar">
            <SourceView source={content} lang={file.kind} />
          </div>
        </div>
      );
    default:
      return (
        <div className="doc-scroll">
          <div className="doc">
            <pre className="raw-view">{content}</pre>
          </div>
        </div>
      );
  }
}
