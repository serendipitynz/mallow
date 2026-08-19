import { useCallback, useEffect, useState } from 'react';
import { isJsonPlist } from '../lib/file';
import { useT } from '../lib/i18n';
import { type ReadError, readErrorMessage } from '../lib/read-error';
import { readFile, setWindowTitle } from '../lib/tauri';
import { documentTitle, windowTitle } from '../lib/title';
import type { FileEntry } from '../lib/types';
import { ConfigView } from './ConfigView';
import { HtmlView } from './HtmlView';
import { MarkdownView } from './MarkdownView';
import { MediaView } from './MediaView';
import { MermaidView } from './MermaidView';
import { SourceView } from './SourceView';
import { TableView } from './TableView';
import { XmlView } from './XmlView';

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
  /* A label the open view supplies for the window title, where the file's own
     text cannot give one. `HtmlView` is the only supplier today: an HTML
     document's `<title>` comes out of the transform it already ran, and
     `lib/title` would have to parse the document again to find it.

     **Stored with the path it belongs to, rather than dropped by an effect when
     the path changes.** That effect would run in the same commit as the one
     writing the title, which reads the label from its own render — so the
     previous document's label would be written once before the reset landed.
     Keyed, the mismatch is simply not a match. It is also what keeps the label
     across the watcher's reload token: a re-read whose text is unchanged
     produces no new transform, so nothing would report it back. */
  const [viewTitle, setViewTitle] = useState<{ path: string; title: string | null } | null>(null);
  const filePath = file?.path;
  const reportTitle = useCallback(
    (title: string | null) => {
      if (filePath !== undefined) {
        setViewTitle({ path: filePath, title });
      }
    },
    [filePath],
  );

  /* biome-ignore lint/correctness/useExhaustiveDependencies: keyed on file?.path, not on `file`, on
     purpose. The parent rebuilds the FileEntry object on every tree refresh, so depending on `file`
     would re-read the same document each time the watcher fires. */
  useEffect(() => {
    if (!file) {
      setContent(null);
      setError(null);
      return;
    }
    // Media files are rendered by the WebView from the asset URL; skip the text
    // read entirely (they are binary and may exceed the text-read size cap).
    if (isMediaKind(file.kind)) {
      setContent(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    readFile(file.path)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.ok) {
          setContent(result.text);
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

  /* biome-ignore lint/correctness/useExhaustiveDependencies: `file` is read here but keyed on its
     path, kind and name, for the reason the read effect above gives — the parent rebuilds the
     FileEntry on every tree refresh, and depending on the object would spend an IPC call rewriting
     the title it already holds. */
  useEffect(() => {
    if (!file) {
      setWindowTitle(windowTitle(null));
      return;
    }
    // The one place the native window title is written. A view's own label wins
    // where it has one for the file now open; otherwise the file's text answers,
    // and `documentTitle` falls back to the file name — which is also what an
    // unread file gets, so the title is right from the moment the file opens
    // rather than after a read. A failed read drops the label too: the view that
    // reported it is gone, replaced by the error placeholder, and keeping it
    // would leave the window named after a document no longer on screen.
    const label = error === null && viewTitle?.path === file.path ? viewTitle.title : null;
    setWindowTitle(windowTitle(label ?? documentTitle(file, content ?? '')));
  }, [file?.path, file?.kind, file?.name, content, viewTitle, error]);

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
      <ViewerBody key={file.path} file={file} content={content} onDocumentTitle={reportTitle} />
    </main>
  );
}

function ViewerBody({
  file,
  content,
  onDocumentTitle,
}: {
  file: FileEntry;
  content: string;
  onDocumentTitle: (title: string | null) => void;
}) {
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
    // A `.plist` carries either markup or JSON under one extension, so this kind
    // is the one whose view is settled by the text rather than by the name.
    case 'xml':
      return isJsonPlist(file.name, content) ? (
        <ConfigView source={content} file={file} />
      ) : (
        <XmlView source={content} />
      );
    // The rendered view is the default mode and owns the toggle to the source
    // one (decision-3), so `html` is a second kind whose view is not settled by
    // the kind alone.
    case 'html':
      return <HtmlView source={content} file={file} onDocumentTitle={onDocumentTitle} />;
    // The kind name doubles as the Shiki grammar id, so no kind→lang table is
    // needed: ini, diff and sql are in `lib/shiki`'s LANGS, and `text` is what
    // SourceView already falls back to for a grammar it has not loaded.
    case 'text':
    case 'ini':
    case 'diff':
    case 'sql':
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
