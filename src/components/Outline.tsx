import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { appDocumentRoot, findHeading, type Heading, type HeadingRoot, offsetFromContainerTop } from '../lib/heading';
import { useT } from '../lib/i18n';

interface OutlineProps {
  /** Named by the toggle's `aria-controls`. */
  id: string;
  headings: Heading[];
  /** The scrollable container the document lives in (for scroll-spy + scrolling). */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Where the headings live. Defaults to the app document; pass a stable value. */
  root?: HeadingRoot;
  /** Called when the outline is removed while the focus is inside it, before the
   *  focus falls with it. */
  onFocusDropped?: () => void;
}

/**
 * The scroller stores its offset as an integer while heading positions are
 * fractional, so a jump can settle a fraction of a pixel short of the very
 * threshold it was computed from. Without this slack the outline would then
 * highlight the entry above the one just clicked, on roughly half of them.
 * It is not a tunable — do not tighten it back.
 */
const LANDING_SLACK_PX = 1;

/**
 * Where a jump puts a heading, read back rather than recomputed: the scroller's
 * `scroll-padding-top` resolves the bar height the view publishes, fallback
 * included, and the heading's `scroll-margin-top` the gap below it — the two
 * `scrollIntoView` adds up — so the spy and the jump cannot drift apart. A heading
 * with no margin — a document that is not mallow's markdown — adds 0, which is
 * also what its jump adds.
 */
function landingOffset(el: HTMLElement, scroller: HTMLElement): number {
  const padding = parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0;
  return padding + (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
}

export function Outline({ id, headings, scrollRef, root = appDocumentRoot, onFocusDropped }: OutlineProps) {
  const t = useT();
  const [activeSlug, setActiveSlug] = useState<string | null>(headings[0]?.slug ?? null);
  const ticking = useRef(false);
  const minDepth = headings.length ? Math.min(...headings.map((h) => h.depth)) : 0;
  const navRef = useRef<HTMLElement>(null);
  const onFocusDroppedRef = useRef(onFocusDropped);
  onFocusDroppedRef.current = onFocusDropped;

  /* A layout cleanup, because it runs before React takes the nav out of the
     document: by the time a passive cleanup ran, the focus would already have
     fallen to <body> and nothing would say it had been here. */
  useLayoutEffect(() => {
    const nav = navRef.current;
    return () => {
      if (nav?.contains(document.activeElement)) {
        onFocusDroppedRef.current?.();
      }
    };
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || headings.length === 0) {
      return;
    }

    const update = () => {
      const containerTop = container.getBoundingClientRect().top;
      const frameOffset = root.frameOffset();
      // Taken from the first heading that resolves, not cached across runs: under a
      // root whose document is replaced (a frame) there may be none to read yet.
      let threshold: number | null = null;
      let current = headings[0]?.slug ?? null;
      for (const h of headings) {
        const el = findHeading(root, h.slug);
        if (!el) {
          continue;
        }
        if (threshold === null) {
          threshold = landingOffset(el, container);
        }
        const top = offsetFromContainerTop(el.getBoundingClientRect().top, frameOffset, containerTop);
        if (top - threshold <= LANDING_SLACK_PX) {
          current = h.slug;
        } else {
          break;
        }
      }
      setActiveSlug(current);
    };

    const onScroll = () => {
      if (ticking.current) {
        return;
      }
      ticking.current = true;
      requestAnimationFrame(() => {
        ticking.current = false;
        update();
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => container.removeEventListener('scroll', onScroll);
  }, [headings, scrollRef, root]);

  function go(event: React.MouseEvent, slug: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    const el = findHeading(root, slug);
    if (!el) {
      return;
    }
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The named boundary-crossing mechanism: `scrollIntoView` on the heading, not a
    // parent `scrollTop` computed from `offsetFromContainerTop`. TASK-7 measured both
    // working from inside a srcdoc frame on all three WebViews, so decision-9 left the
    // choice here. This one is chosen because it honours the heading's own
    // `scroll-margin-top` and the scroller's `scroll-padding-top`; reproducing those
    // on the parent side would mean reading them back out of the computed style at
    // every jump. Only the markdown view declares one
    // today (under `.markdown-body`), and a rendered document brings its own or none —
    // the point is that whatever the heading declares is what applies.
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    if (!el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '-1');
    }
    el.focus({ preventScroll: true });
  }

  return (
    <nav ref={navRef} id={id} className="doc-outline" aria-label={t('outline')}>
      <p className="doc-outline__title">{t('contents')}</p>
      <ul className="doc-outline__list">
        {headings.map((h) => (
          <li key={h.slug} className="doc-outline__item" data-depth={Math.min(h.depth - minDepth, 3)}>
            <a
              href={`#${h.slug}`}
              className={`doc-outline__link${activeSlug === h.slug ? ' is-active' : ''}`}
              aria-current={activeSlug === h.slug ? 'location' : undefined}
              onClick={(e) => go(e, h.slug)}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
