import { type RefObject, useEffect, useRef, useState } from 'react';
import { useT } from '../lib/i18n';
import type { Heading } from '../lib/markdown';

interface OutlineProps {
  headings: Heading[];
  /** The scrollable container the document lives in (for scroll-spy + scrolling). */
  scrollRef: RefObject<HTMLDivElement | null>;
}

const SPY_OFFSET_REM = 1.5;

export function Outline({ headings, scrollRef }: OutlineProps) {
  const t = useT();
  const [activeSlug, setActiveSlug] = useState<string | null>(headings[0]?.slug ?? null);
  const ticking = useRef(false);
  const minDepth = headings.length ? Math.min(...headings.map((h) => h.depth)) : 0;

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || headings.length === 0) return;

    const offset = SPY_OFFSET_REM * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);

    const update = () => {
      const containerTop = container.getBoundingClientRect().top;
      let current = headings[0]?.slug ?? null;
      for (const h of headings) {
        const el = document.getElementById(h.slug);
        if (!el) continue;
        if (el.getBoundingClientRect().top - containerTop - offset <= 0) {
          current = h.slug;
        } else {
          break;
        }
      }
      setActiveSlug(current);
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        ticking.current = false;
        update();
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => container.removeEventListener('scroll', onScroll);
  }, [headings, scrollRef]);

  function go(event: React.MouseEvent, slug: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const el = document.getElementById(slug);
    if (!el) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
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
