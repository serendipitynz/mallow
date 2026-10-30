import { useCallback, useEffect, useRef, useState } from 'react';
import { useLeaveReport, useRememberedScroll, type ViewMemory } from '../hooks/useViewMemory';
import { isJsonPlist } from '../lib/file';
import { useT } from '../lib/i18n';
import { type ReadError, readErrorMessage } from '../lib/read-error';
import { captureScrollAnchor } from '../lib/scroll';
import { readFile, setWindowTitle } from '../lib/tauri';
import { documentTitle, windowTitle } from '../lib/title';
import type { FileEntry } from '../lib/types';
import type { FileViewState } from '../lib/visit-history';
import { Busy } from './Busy';
import { ConfigView } from './ConfigView';
import { HtmlView } from './HtmlView';
import { MarkdownView } from './MarkdownView';
import { MediaView } from './MediaView';
import { MermaidView } from './MermaidView';
import { Notice } from './Notice';
import { SourceView } from './SourceView';
import { TableView } from './TableView';
import { XmlView } from './XmlView';

interface ViewerProps {
  file: FileEntry | null;
  /** Bumped by the watcher when the open file changes on disk, forcing a re-read. */
  reloadToken: number;
  /** How the open file was last left in this window, and where the view reports
   *  how it is left this time (TASK-44). */
  remembered: FileViewState | null;
  onLeave: (path: string, state: FileViewState) => void;
}

/** Kinds rendered by the WebView from the file itself, not by reading its text. */
function isMediaKind(kind: FileEntry['kind']): boolean {
  return kind === 'image' || kind === 'pdf' || kind === 'video';
}

export function Viewer({ file, reloadToken, remembered, onLeave }: ViewerProps) {
  const t = useT();
  /* The text is held with the path it was read from, and a view is only ever
     given text whose path is the one now open. Without that the previous file's
     text renders for one commit under the new file's key — `ViewerBody` remounts
     on a path change while the read is still in flight — so a view would be
     transforming one document while being told it is another. */
  const [content, setContent] = useState<{ path: string; text: string } | null>(null);
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

  // What the open file's own text is, or null while nothing has been read for it.
  const text = content !== null && content.path === file?.path ? content.text : null;

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
          setContent({ path: file.path, text: result.text });
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
    setWindowTitle(windowTitle(label ?? documentTitle(file, text ?? '')));
  }, [file?.path, file?.kind, file?.name, text, viewTitle, error]);

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
          <Notice level="failure">{readErrorMessage(error, t)}</Notice>
        </div>
      </main>
    );
  }

  if (text === null) {
    return (
      <main className="viewer">
        {loading && (
          <div className="viewer__placeholder">
            <Busy>{t('loading')}</Busy>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="viewer">
      <ViewerBody
        key={file.path}
        file={file}
        content={text}
        onDocumentTitle={reportTitle}
        memory={{ remembered, leave: (state) => onLeave(file.path, state) }}
      />
    </main>
  );
}

function ViewerBody({
  file,
  content,
  onDocumentTitle,
  memory,
}: {
  file: FileEntry;
  content: string;
  onDocumentTitle: (title: string | null) => void;
  memory: ViewMemory;
}) {
  switch (file.kind) {
    case 'markdown':
      return <MarkdownView source={content} path={file.path} memory={memory} />;
    case 'mermaid':
      return <MermaidView source={content} memory={memory} />;
    case 'json':
    case 'yaml':
    case 'toml':
      return <ConfigView source={content} file={file} memory={memory} />;
    case 'csv':
      return <TableView source={content} file={file} memory={memory} />;
    // A `.plist` carries either markup or JSON under one extension, so this kind
    // is the one whose view is settled by the text rather than by the name.
    case 'xml':
      return isJsonPlist(file.name, content) ? (
        <ConfigView source={content} file={file} memory={memory} />
      ) : (
        <XmlView source={content} memory={memory} />
      );
    // The rendered view is the default mode and owns the toggle to the source
    // one (decision-3), so `html` is a second kind whose view is not settled by
    // the kind alone.
    case 'html':
      return <HtmlView source={content} file={file} onDocumentTitle={onDocumentTitle} memory={memory} />;
    // The kind name doubles as the Shiki grammar id, so no kind→lang table is
    // needed: ini, diff and sql are in `lib/shiki`'s LANGS, and `text` is what
    // SourceView already falls back to for a grammar it has not loaded.
    case 'text':
    case 'ini':
    case 'diff':
    case 'sql':
      return <SourceDocument source={content} lang={file.kind} memory={memory} />;
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

/** A kind whose whole view is its source, so the scroll position is all there is
 *  to remember of it. */
function SourceDocument({ source, lang, memory }: { source: string; lang: string; memory: ViewMemory }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useRememberedScroll(scrollRef, memory.remembered?.anchor ?? null);
  useLeaveReport(memory, scrollRef, (scroller) => ({ mode: null, anchor: captureScrollAnchor(scroller, []) }));
  return (
    <div className="doc-scroll" ref={scrollRef}>
      <div className="doc doc--no-bar">
        <SourceView source={source} lang={lang} />
      </div>
    </div>
  );
}
