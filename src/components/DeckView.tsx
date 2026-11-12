import { polyfills } from '@marp-team/marpit-svg-polyfill';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { DeckFeature, DeckResult } from '../lib/deck';
import { type TFn, useT } from '../lib/i18n';
import { isLaserToggleKey } from '../lib/laser';
import { getMarkdownConfigVersion, subscribeMarkdownConfig } from '../lib/markdown';
import { renderMermaid } from '../lib/mermaid';
import { dirname } from '../lib/path';
import type { PresentPlace } from '../lib/present';
import { clampSlide, slideStepForKey, stepSlide } from '../lib/slide-nav';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';
import { LaserPointer, type PointerSpot } from './LaserPointer';
import { isModalOpen, onModalOpening } from './Modal';
import { Notice } from './Notice';

/** WebKit paints the HTML inside Marpit's `foreignObject` at the slide's own
 *  size rather than scaled to the SVG — measured on WKWebView, TASK-51.2 — and
 *  the polyfill's fix is what puts it right. Taken from the synchronous array,
 *  which picks by engine: the asynchronous one adds a canvas test that judged the
 *  measured engine sound, and so applied nothing. Called on each change rather
 *  than through `observe()`, which re-applies it on every animation frame for
 *  the life of the page. */
const svgFixes = polyfills();

function applySvgFixes(target: ParentNode): void {
  for (const fix of svgFixes) {
    fix({ target });
  }
}

interface DeckViewProps {
  source: string;
  path: string;
  index: number;
  onIndex: (index: number) => void;
  /** Where the deck is being presented, or `null` while it is not. */
  presenting: PresentPlace | null;
  onPresentEnd: () => void;
  /** Move a running presentation to the other place (`F`). */
  onPresentPlace: (place: PresentPlace) => void;
  onSlideCount: (count: number) => void;
}

export function DeckView({
  source,
  path,
  index,
  onIndex,
  presenting,
  onPresentEnd,
  onPresentPlace,
  onSlideCount,
}: DeckViewProps) {
  const t = useT();
  const [deck, setDeck] = useState<DeckResult | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const configVersion = useSyncExternalStore(subscribeMarkdownConfig, getMarkdownConfigVersion);

  /* biome-ignore lint/correctness/useExhaustiveDependencies: configVersion is the re-render trigger
     for a changed custom emoji set, as in MarkdownView; it is not read in the body. */
  useEffect(() => {
    let cancelled = false;
    setRenderError(null);
    /* Loaded on demand: Marpit and postcss are a large share of the bundle, and
       only a deck shown as slides needs them. */
    import('../lib/deck')
      .then(({ renderDeck }) => renderDeck(source, { images: { dir: dirname(path), toAssetUrl: convertFileSrc } }))
      .then((result) => {
        if (!cancelled) {
          setDeck(result);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setRenderError(String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source, path, configVersion]);

  const count = deck?.slides.length ?? 0;
  const current = clampSlide(index, count);

  useEffect(() => {
    if (deck) {
      onSlideCount(deck.slides.length);
    }
  }, [deck, onSlideCount]);

  const indexRef = useRef(current);
  indexRef.current = current;
  const countRef = useRef(count);
  countRef.current = count;
  const go = (next: number) => onIndex(clampSlide(next, countRef.current));

  usePresentationWindow(presenting, onPresentEnd);
  const { laser, toggleLaser, lastPointer } = useLaser(presenting !== null);

  /* One listener for both layouts. Outside a presentation a key typed into a
     field, or Space on a button (which presses it), is left where it was going;
     an arrow on a focused button still moves the slide, and the segmented
     control's own arrows arrive here already handled. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isModalOpen()) {
        return;
      }
      if (presenting !== null) {
        if (event.key === 'Escape') {
          event.preventDefault();
          onPresentEnd();
          return;
        }
        if (event.key.toLowerCase() === 'f' && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          onPresentPlace(presenting === 'fullscreen' ? 'window' : 'fullscreen');
          return;
        }
        if (isLaserToggleKey(event)) {
          event.preventDefault();
          if (!event.repeat) {
            toggleLaser();
          }
          return;
        }
      } else if (keyBelongsToTarget(event)) {
        return;
      }
      const step = slideStepForKey(event);
      if (step !== null) {
        event.preventDefault();
        onIndex(stepSlide(indexRef.current, countRef.current, step));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presenting, onPresentEnd, onPresentPlace, onIndex, toggleLaser]);

  // Stable per language, since the stage re-runs its enhancements when it changes.
  const mermaidFailed = useCallback((message: string) => t('mermaidFailed', { message }), [t]);
  const slideHtml = useMemo(() => ({ __html: deck?.slides[current] ?? '' }), [deck, current]);

  const stage = (
    <SlideStage
      html={slideHtml}
      css={deck?.css ?? ''}
      presenting={presenting !== null}
      onAdvance={() => go(indexRef.current + 1)}
      mermaidFailed={mermaidFailed}
    />
  );
  const position = t('slidePosition', { current: count === 0 ? 0 : current + 1, total: count });

  return (
    <div className="deck">
      {renderError && (
        <Notice level="failure" className="notice--doc">
          {t('renderError', { message: renderError })}
        </Notice>
      )}
      {deck && deck.unsupported.length > 0 && (
        <Notice level="degraded" className="notice--doc">
          {t('deckUnsupported', { features: deck.unsupported.map((f) => featureLabel(f, t)).join(t('listSeparator')) })}
        </Notice>
      )}
      {presenting === null
        ? stage
        : createPortal(
            <div className={laser ? 'deck-presentation deck-presentation--laser' : 'deck-presentation'}>{stage}</div>,
            document.body,
          )}
      <div className="deck__nav">
        <button
          type="button"
          className="icon-btn"
          title={t('previousSlide')}
          aria-label={t('previousSlide')}
          disabled={current <= 0}
          onClick={() => go(current - 1)}
        >
          <ChevronLeftIcon />
        </button>
        <span className="deck__position" aria-live="polite">
          {position}
        </span>
        <button
          type="button"
          className="icon-btn"
          title={t('nextSlide')}
          aria-label={t('nextSlide')}
          disabled={current >= count - 1}
          onClick={() => go(current + 1)}
        >
          <ChevronRightIcon />
        </button>
      </div>
      {presenting !== null &&
        createPortal(
          <>
            <div className="deck-presentation__position" aria-live="polite">
              {position}
            </div>
            <PresentHint />
          </>,
          document.body,
        )}
      {laser && <LaserPointer lastPointer={lastPointer} />}
    </div>
  );
}

function SlideStage({
  html,
  css,
  presenting,
  onAdvance,
  mermaidFailed,
}: {
  html: { __html: string };
  css: string;
  presenting: boolean;
  onAdvance: () => void;
  mermaidFailed: (message: string) => string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  // Rerun on every slide the host shows: each is a fresh `innerHTML`.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !html.__html) {
      return;
    }
    applySvgFixes(host);
    void renderMermaid(host, mermaidFailed)
      .then(() => applySvgFixes(host))
      .catch((e) => console.error('Failed to render mermaid diagrams', e));
    const observer = new ResizeObserver(() => applySvgFixes(host));
    observer.observe(host);
    return () => observer.disconnect();
  }, [html, mermaidFailed]);

  /* Links follow the preview's rule: `http(s)` opens in the OS browser and every
     other destination is inert, since a slide has nowhere in the app to go. A
     click anywhere else in a presentation advances. */
  const onClick = (event: React.MouseEvent) => {
    const anchor = (event.target as HTMLElement).closest('a');
    if (anchor) {
      event.preventDefault();
      const href = anchor.getAttribute('href') ?? '';
      if (/^https?:\/\//i.test(href)) {
        void openUrl(href).catch((err) => console.error('openUrl failed', err));
      }
      return;
    }
    if (presenting && event.button === 0) {
      onAdvance();
    }
  };

  return (
    /* Focusable by a click, so that after choosing Slides with the pointer a
       click on the slide takes the focus out of the view switch, whose own arrow
       keys would otherwise keep the slide keys from arriving. */
    /* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: the click
       advances a presentation, which the window-level slide keys already do from the keyboard. */
    <div className="deck__stage" tabIndex={-1} onClick={onClick}>
      {/* The deck's CSS: scoped by Marpit to `div.marpit`, at-rules and URLs
          walked by lib/deck-css (decision-18 §6). Text content, so nothing in it
          is parsed as markup. */}
      <style>{css}</style>
      <div
        ref={hostRef}
        className="marpit"
        /* biome-ignore lint/security/noDangerouslySetInnerHtml: the slide is markdown-it output under
           html: false, wrapped by Marpit — the same boundary as the preview (AGENTS.md). */
        dangerouslySetInnerHTML={html}
      />
    </div>
  );
}

/** Puts the window in the place a presentation asks for, follows it when the
 *  place changes mid-presentation (`F`, or the other present chord), and puts
 *  the window back as it was when the presentation ends — by Escape, by a modal
 *  opening, by the view going away, or by the file changing under it. The rest
 *  of the app is made inert meanwhile, so the focus cannot wander behind the
 *  presentation. */
function usePresentationWindow(presenting: PresentPlace | null, onPresentEnd: () => void): void {
  const placeRef = useRef(presenting);
  placeRef.current = presenting;
  const active = presenting !== null;
  useEffect(() => {
    if (!active) {
      return;
    }
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    /* A modal mounts inside the inert root, under the presentation: it could be
       neither seen nor focused, and it would hold every key. So it ends the
       presentation first — synchronously, so the root is no longer inert by
       the time the modal takes the focus. */
    const stopListening = onModalOpening(() => {
      root?.removeAttribute('inert');
      onPresentEnd();
    });
    const win = getCurrentWindow();
    let ended = false;
    let restoreTo: boolean | null = null;
    void win
      .isFullscreen()
      .then((was) => {
        if (ended) {
          return;
        }
        restoreTo = was;
        if (placeRef.current === 'fullscreen' && !was) {
          return win.setFullscreen(true);
        }
      })
      .catch((e) => console.error('Failed to enter full screen', e));
    return () => {
      ended = true;
      stopListening();
      root?.removeAttribute('inert');
      if (restoreTo !== null) {
        void win.setFullscreen(restoreTo).catch((e) => console.error('Failed to restore the window', e));
      }
    };
  }, [active, onPresentEnd]);

  /* Only a change of place while presenting: the start is the effect above's,
     which leaves a window the reader had already made full-screen as it is
     when the presentation asks for the window. */
  const shownPlace = useRef<PresentPlace | null>(null);
  useEffect(() => {
    const previous = shownPlace.current;
    shownPlace.current = presenting;
    if (presenting === null || previous === null || previous === presenting) {
      return;
    }
    void getCurrentWindow()
      .setFullscreen(presenting === 'fullscreen')
      .catch((e) => console.error('Failed to change full screen', e));
  }, [presenting]);
}

/** The laser pointer's switch (TASK-51.3). Off whenever a presentation is not
 *  running, so each one starts with it off whatever the last one ended with; it
 *  stays as it is across `F`, which moves a presentation rather than ending it.
 *  Where the pointer is goes to a ref, never to state, so that tracking it
 *  re-renders nothing. */
function useLaser(presenting: boolean): {
  laser: boolean;
  toggleLaser: () => void;
  lastPointer: React.RefObject<PointerSpot | null>;
} {
  const [on, setOn] = useState(false);
  const lastPointer = useRef<PointerSpot | null>(null);
  useEffect(() => {
    if (!presenting) {
      setOn(false);
      return;
    }
    lastPointer.current = null;
    const onMove = (event: PointerEvent) => {
      lastPointer.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [presenting]);
  const toggleLaser = useCallback(() => setOn((was) => !was), []);
  return { laser: on && presenting, toggleLaser, lastPointer };
}

/** The presentation's keys, shown as it starts and faded out a few seconds
 *  later; mounted once per presentation, so `F` does not bring it back. */
function PresentHint() {
  const t = useT();
  const [shown, setShown] = useState(true);
  if (!shown) {
    return null;
  }
  const keys: [string, string][] = [
    ['Esc', t('presentHintEnd')],
    ['F', t('presentHintPlace')],
    ['L', t('presentHintLaser')],
  ];
  return (
    <div className="deck-presentation__hint" onAnimationEnd={() => setShown(false)}>
      {keys.map(([key, label]) => (
        <span key={key}>
          <kbd>{key}</kbd> {label}
        </span>
      ))}
    </div>
  );
}

function keyBelongsToTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target?.closest) {
    return false;
  }
  if (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) {
    return true;
  }
  return event.key === ' ' && target.closest('button, a[href], summary') !== null;
}

function featureLabel(feature: DeckFeature, t: TFn): string {
  switch (feature.kind) {
    case 'rawHtml':
      return t('deckFeature.rawHtml');
    case 'math':
      return t('deckFeature.math');
    case 'theme':
      return t('deckFeature.theme', { name: feature.name });
    case 'size':
      return t('deckFeature.size', { value: feature.value });
    case 'fit':
      return t('deckFeature.fit');
    case 'cssAtRule':
      return t('deckFeature.cssAtRule', { name: feature.name });
    case 'cssAssetUrl':
      return t('deckFeature.cssAssetUrl');
    case 'cssUnparsed':
      return t('deckFeature.cssUnparsed');
  }
}
