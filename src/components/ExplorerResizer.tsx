import { type KeyboardEvent, type MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  clampExplorerWidth,
  type ExplorerSide,
  MAX_EXPLORER_WIDTH,
  MIN_EXPLORER_WIDTH,
  widthAtPointer,
  widthForKey,
} from '../lib/explorer-width';
import { useT } from '../lib/i18n';

/** Below this a press is a press, not the start of a drag — a hand never
 *  releases exactly where it pressed. */
const DRAG_THRESHOLD_PX = 3;

interface ExplorerResizerProps {
  side: ExplorerSide;
  width: number;
  controls: string;
  /** A width shown while the reader is still choosing it. */
  onPreview: (width: number) => void;
  /** The width chosen, to keep. */
  onCommit: (width: number) => void;
}

type Mode = 'idle' | 'dragging' | 'grabbed';

/** The handle between the explorer and the viewer. Dragging is one way to use it
 *  and not the only one (WCAG 2.5.7, snz-design doc-5 §4.1): a press without
 *  moving grabs the handle and the next press puts it there — the grab-and-place
 *  shape snz-design doc-9 §6.9 gives reordering — and on the keyboard the arrows,
 *  Home and End move it. */
export function ExplorerResizer({ side, width, controls, onPreview, onCommit }: ExplorerResizerProps) {
  const t = useT();
  const [mode, setMode] = useState<Mode>('idle');
  /** Where the placing press would put the handle, from the catcher's left edge. */
  const [guideX, setGuideX] = useState<number | null>(null);
  const keyedWidth = useRef<number | null>(null);

  const cancelGrab = useCallback(() => {
    setGuideX(null);
    setMode('idle');
  }, []);

  useEffect(() => {
    if (mode !== 'grabbed') {
      return;
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) {
        e.preventDefault();
        cancelGrab();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, cancelGrab]);

  function onHandleMouseDown(e: MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    if (mode === 'grabbed') {
      cancelGrab();
      return;
    }
    const startX = e.clientX;
    let last = width;
    let moved = false;
    const onMove = (ev: globalThis.MouseEvent) => {
      const dx = ev.clientX - startX;
      if (!moved && Math.abs(dx) < DRAG_THRESHOLD_PX) {
        return;
      }
      if (!moved) {
        moved = true;
        setMode('dragging');
      }
      last = clampExplorerWidth(side === 'left' ? width + dx : width - dx);
      onPreview(last);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (moved) {
        setMode('idle');
        onCommit(last);
      } else {
        setMode('grabbed');
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function pointerWidth(e: MouseEvent<HTMLDivElement>): number {
    const body = e.currentTarget.getBoundingClientRect();
    return widthAtPointer(side, e.clientX, body.left, body.right);
  }

  function showGuide(e: MouseEvent<HTMLDivElement>) {
    const next = pointerWidth(e);
    setGuideX(side === 'left' ? next : e.currentTarget.getBoundingClientRect().width - next);
  }

  function onHandleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const next = widthForKey(e.key, e.shiftKey, side, width);
    if (next === null) {
      return;
    }
    e.preventDefault();
    keyedWidth.current = next;
    onPreview(next);
  }

  // Saved when the key is let go rather than on every repeat, since each save
  // goes through Rust and out to every window.
  function commitKeyedWidth() {
    if (keyedWidth.current !== null) {
      onCommit(keyedWidth.current);
      keyedWidth.current = null;
    }
  }

  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: `<hr>` is a static rule and cannot take focus or a value; a focusable separator is the window-splitter widget */}
      <div
        className={`app__resizer${mode === 'idle' ? '' : ' is-active'}`}
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-controls={controls}
        aria-label={t('explorerWidth')}
        aria-valuenow={width}
        aria-valuemin={MIN_EXPLORER_WIDTH}
        aria-valuemax={MAX_EXPLORER_WIDTH}
        aria-valuetext={t('explorerWidthValue', { width })}
        title={t('explorerWidthHint')}
        onMouseDown={onHandleMouseDown}
        onKeyDown={onHandleKeyDown}
        onKeyUp={commitKeyedWidth}
        onBlur={commitKeyedWidth}
      />
      {/* While the handle is grabbed this covers the body, so the press that
          places it lands here and cannot also press whatever sits beneath. The
          width does not follow the pointer until that press — only a guide does:
          a handle following the pointer would always be under it, and pressing
          the handle is what cancels. */}
      {mode === 'grabbed' && (
        // biome-ignore lint/a11y/noStaticElementInteractions: a pointer-only surface; the keyboard path is the handle's own keys, and Escape cancels
        // biome-ignore lint/a11y/useKeyWithClickEvents: as above
        <div
          className="app__resize-catcher"
          onMouseMove={showGuide}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            setGuideX(null);
            setMode('idle');
            onCommit(pointerWidth(e));
          }}
        >
          {guideX !== null && <div className="app__resize-guide" style={{ left: `${guideX}px` }} />}
        </div>
      )}
    </>
  );
}
