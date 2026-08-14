import { convertFileSrc } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { useT } from '../lib/i18n';
import type { FileEntry } from '../lib/types';

interface MediaViewProps {
  file: FileEntry;
  /** Bumped by the watcher on disk changes; used to bust the WebView cache. */
  reloadToken: number;
}

/**
 * Renders image / pdf / video files straight from disk via the Tauri asset
 * protocol (no bytes pass through JS). `convertFileSrc` yields an `asset:` URL
 * the WebView loads and decodes natively, so support is bounded by the platform
 * WebView. A `?v=` query busts the cache when the file changes on disk.
 */
export function MediaView({ file, reloadToken }: MediaViewProps) {
  const src = `${convertFileSrc(file.path)}?v=${reloadToken}`;

  switch (file.kind) {
    case 'image':
      return <ImageView src={src} name={file.name} />;
    case 'pdf':
      return <PdfView src={src} name={file.name} />;
    case 'video':
      return <VideoView src={src} name={file.name} />;
    default:
      return null;
  }
}

/** Shown when the WebView cannot decode a media file on this platform. */
function Unsupported({ name }: { name: string }) {
  const t = useT();
  return (
    <div className="viewer__placeholder is-error">
      <code>{name}</code>
      <p>{t('mediaUnsupported')}</p>
    </div>
  );
}

function ImageView({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  // Reset the error state when the source changes (new file or reload).
  /* biome-ignore lint/correctness/useExhaustiveDependencies: src is the trigger, not something the
     body reads. Dropping it would run the reset once and leave a decode failure latched when the
     next file loads fine. */
  useEffect(() => setFailed(false), [src]);

  if (failed) return <Unsupported name={name} />;
  return (
    <div className="media-view media-view--image">
      <img src={src} alt={name} onError={() => setFailed(true)} />
    </div>
  );
}

function VideoView({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: see ImageView above.
  useEffect(() => setFailed(false), [src]);

  if (failed) return <Unsupported name={name} />;
  return (
    <div className="media-view media-view--video">
      {/* biome-ignore lint/a11y/useMediaCaption: the file the user opened is the only source
          here. A viewer has no caption track to offer and cannot author one. */}
      <video src={src} controls onError={() => setFailed(true)} />
    </div>
  );
}

function PdfView({ src, name }: { src: string; name: string }) {
  // The WebView's built-in PDF viewer renders the asset URL. Unlike <img>/<video>
  // an <iframe> gives no reliable load-error signal, so there is no fallback here;
  // WebViews without a PDF viewer (some Linux WebKitGTK builds) show a blank frame.
  return (
    <div className="media-view media-view--pdf">
      <iframe src={src} title={name} />
    </div>
  );
}
