import { type RefObject, useEffect, useRef, useState } from 'react';
import { appDocumentRoot, findHeading, type Heading, type HeadingRoot, offsetFromContainerTop } from '../lib/heading';
import { useT } from '../lib/i18n';

interface OutlineProps {
  headings: Heading[];
  /** The scrollable container the document lives in (for scroll-spy + scrolling). */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Where the headings live. Defaults to the app document; pass a stable value. */
  root?: HeadingRoot;
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
 * Where a jump puts a heading, measured off the heading itself rather than
 * recomputed: `scroll-margin-top` already resolves the bar height `MarkdownView`
 * publishes plus the gap, fallback included, so the spy and the jump cannot drift
 * apart. A heading with none — a document that is not mallow's markdown — answers
 * 0, which is also where its jump lands.
 */
function landingOffset(el: HTMLElement): number {
  return parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
}

export function Outline({ headings, scrollRef, root = appDocumentRoot }: OutlineProps) {
  const t = useT();
  const [activeSlug, setActiveSlug] = useState<string | null>(headings[0]?.slug ?? null);
  const ticking = useRef(false);
  const minDepth = headings.length ? Math.min(...headings.map((h) => h.depth)) : 0;

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
          threshold = landingOffset(el);
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
    // `scroll-margin-top`; reproducing that on the parent side would mean reading it
    // back out of the computed style at every jump. Only the markdown view declares one
    // today (under `.markdown-body`), and a rendered document brings its own or none —
    // the point is that whatever the heading declares is what applies.
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    if (!el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '-1');
    }
    el.focus({ preventScroll: true });
  }

  return (
    <nav className="doc-outline" aria-label={t('outline')}>
      <p className="doc-outline__title">{t('contents')}</p>
      <ul className="doc-outline__list">
        {headings.map((h) => (
          <li key={h.slug} className="doc-outline__item" data-depth={Math.min(h.depth - minDepth, 3)}>
            <a
              href={`#${h.slug}`}
              className={`doc-outline__link${activeSlug === h.slug ? ' is-active' : ''}`}
              aria-current={activeSlug === h.slug ? 'true' : undefined}
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
