import {
  type KeyboardEvent,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  buildFindIndex,
  FIND_MATCH_LIMIT,
  type FindDirection,
  type FindIndex,
  searchFindIndex,
  stepMatch,
} from '../lib/find';
import { clearMatches, collectFindText, firstMatchInView, paintMatches, revealRange } from '../lib/find-dom';
import { getFindTarget, onFindTargetChange } from '../lib/find-target';
import { useT } from '../lib/i18n';
import { ChevronDownIcon, ChevronUpIcon, CloseIcon } from './icons';

export interface FindBarHandle {
  open(): void;
  step(direction: FindDirection): void;
}

/** What a search run does with the current match.
 *
 *  `query` — the reader changed the query or opened the bar: start from the first
 *  match in view and bring it there. `target` — another view or another file is
 *  now under the bar: count, but leave the current match unchosen until the
 *  reader steps, because the view may still be putting its remembered scroll
 *  back and a scroll from here would fight it. `content` — the same view
 *  re-rendered (a watcher reload, highlighting arriving, a diagram rendering):
 *  keep the current match's place in the order and do not scroll. */
type RunPolicy = 'query' | 'target' | 'content';

interface Session {
  root: HTMLElement | null;
  index: FindIndex | null;
  runs: Text[][];
  ranges: Range[];
  current: number | null;
}

interface Summary {
  count: number;
  overflow: boolean;
  current: number | null;
}

const NO_MATCHES: Summary = { count: 0, overflow: false, current: null };

function isComposing(event: KeyboardEvent): boolean {
  // 229 is what WebKit reports for a key the IME took, where `isComposing` can
  // already be false on the keystroke that confirms the conversion.
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

/** The find bar over the active view (TASK-47). It is kept mounted while a file
 *  is open in this window, so the query outlives the document under it: a
 *  watcher reload, the preview / source toggle and moving to another file all
 *  re-run it. The query is not a preference and is not shared across windows.
 *
 *  The input is snz-design doc-8 §6.3's single-line input with a visible label;
 *  Enter and Escape are not taken while an IME is converting (doc-8 §5.6). The
 *  bar as a whole is mallow's own: no other app has find in a document
 *  (snz-design doc-16 §9). */
export function FindBar({ ref, hidden, pending }: { ref?: Ref<FindBarHandle>; hidden: boolean; pending: boolean }) {
  const t = useT();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  /* `null` until a run has answered for the bar as it is now open: closing resets
     it, so a reopened bar does not paint — and announce — "no matches" for the
     one frame before its first run. */
  const [summary, setSummary] = useState<Summary | null>(null);
  const target = useSyncExternalStore(onFindTargetChange, getFindTarget);
  const inputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const queryRef = useRef(query);
  queryRef.current = query;
  const openRef = useRef(open);
  openRef.current = open;
  const session = useRef<Session>({ root: null, index: null, runs: [], ranges: [], current: null });

  const show = useCallback((s: Session) => {
    paintMatches(s.ranges, s.current === null ? null : s.ranges[s.current]);
  }, []);

  const run = useCallback(
    (policy: RunPolicy) => {
      const s = session.current;
      const found = getFindTarget();
      const needle = queryRef.current;
      if (!openRef.current || !found || needle === '') {
        s.ranges = [];
        s.current = null;
        clearMatches();
        setSummary(NO_MATCHES);
        return;
      }
      if (s.index === null || s.root !== found.root) {
        s.root = found.root;
        s.runs = collectFindText(found.root);
        s.index = buildFindIndex(s.runs.map((nodes) => nodes.map((node) => node.data)));
      }
      const result = searchFindIndex(s.index, needle);
      s.ranges = result.matches.map(({ block, start, end }) => {
        const range = found.root.ownerDocument.createRange();
        range.setStart(s.runs[block][start.node], start.offset);
        range.setEnd(s.runs[block][end.node], end.offset);
        return range;
      });
      const count = s.ranges.length;
      if (count === 0) {
        s.current = null;
      } else if (policy === 'query') {
        s.current = firstMatchInView(s.ranges, found.scroller);
      } else if (policy === 'target') {
        s.current = null;
      } else if (s.current !== null) {
        s.current = Math.min(s.current, count - 1);
      }
      show(s);
      if (policy === 'query' && s.current !== null) {
        revealRange(s.ranges[s.current], found.scroller);
      }
      setSummary({ count, overflow: result.overflow, current: s.current });
    },
    [show],
  );

  const focusInput = useCallback(() => {
    const input = inputRef.current;
    if (input) {
      input.focus();
      input.select();
    }
  }, []);

  const openBar = useCallback(() => {
    if (openRef.current) {
      focusInput();
      return;
    }
    const active = document.activeElement;
    openerRef.current = active instanceof HTMLElement && !barRef.current?.contains(active) ? active : null;
    openRef.current = true;
    setOpen(true);
  }, [focusInput]);

  const step = useCallback(
    (direction: FindDirection) => {
      if (!openRef.current) {
        openBar();
        return;
      }
      const s = session.current;
      const found = getFindTarget();
      if (!found || s.ranges.length === 0) {
        return;
      }
      s.current =
        s.current === null
          ? firstMatchInView(s.ranges, found.scroller)
          : stepMatch(s.current, s.ranges.length, direction);
      if (s.current === null) {
        return;
      }
      show(s);
      revealRange(s.ranges[s.current], found.scroller);
      setSummary((previous) => previous && { ...previous, current: s.current });
    },
    [openBar, show],
  );

  const close = useCallback(() => {
    openRef.current = false;
    setOpen(false);
    const s = session.current;
    s.ranges = [];
    s.current = null;
    s.index = null;
    clearMatches();
    setSummary(null);
    const opener = openerRef.current;
    openerRef.current = null;
    // Back to what held the focus before the bar opened (snz-design doc-9 §5.1);
    // where that has gone with the document it belonged to, to the view's panel.
    const fallback = document.querySelector<HTMLElement>('.viewer .view-panel');
    (opener?.isConnected ? opener : fallback)?.focus({ preventScroll: true });
  }, []);

  useImperativeHandle(ref, () => ({ open: openBar, step }), [openBar, step]);

  /* biome-ignore lint/correctness/useExhaustiveDependencies: `query` is not read in the body — the
     run reads it through `queryRef`, so that the runs below see the same value — but a new query is
     what this effect exists to answer. */
  useEffect(() => {
    if (openRef.current) {
      run('query');
    }
  }, [query, run]);

  /* Opening the bar, another view or another file coming under it, and the same
     view's content changing. Opening — and reopening with the last query —
     starts the way typing does; the other two keep their own policies. **The
     observer only reads**: it is registered on the view's root, never writes
     there, and is gone whenever the bar is closed. */
  const wasOpen = useRef(false);
  useEffect(() => {
    const opening = open && !wasOpen.current;
    wasOpen.current = open;
    if (!open) {
      return;
    }
    session.current.index = null;
    if (opening) {
      focusInput();
    }
    run(opening ? 'query' : 'target');
    if (!target) {
      return;
    }
    let frame = 0;
    const observer = new MutationObserver(() => {
      if (frame !== 0) {
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = 0;
        session.current.index = null;
        run('content');
      });
    });
    observer.observe(target.root, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [open, target, focusInput, run]);

  // A window that unmounts the bar must not leave its highlights registered.
  useEffect(() => clearMatches, []);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (isComposing(event)) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Enter' && event.target === inputRef.current) {
      event.preventDefault();
      step(event.shiftKey ? 'previous' : 'next');
    }
  }

  if (!open || hidden) {
    return null;
  }

  let status = '';
  if (!target) {
    status = pending ? '' : t('findUnavailable');
  } else if (summary && query !== '') {
    const total = summary.overflow ? `${FIND_MATCH_LIMIT}+` : String(summary.count);
    if (summary.count === 0) {
      status = t('findNone');
    } else if (summary.current === null) {
      status = summary.count === 1 && !summary.overflow ? t('findTotalOne') : t('findTotal', { total });
    } else {
      status = t('findPosition', { current: String(summary.current + 1), total });
    }
  }

  return (
    <search className="find-bar" ref={barRef} onKeyDown={onKeyDown}>
      <label className="find-bar__label" htmlFor={inputId}>
        {t('find')}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        className="find-bar__input"
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      <span className="find-bar__status" role="status">
        {status}
      </span>
      <button
        type="button"
        className="icon-btn"
        title={t('findPrevious')}
        aria-label={t('findPrevious')}
        onClick={() => step('previous')}
      >
        <ChevronUpIcon />
      </button>
      <button
        type="button"
        className="icon-btn"
        title={t('findNext')}
        aria-label={t('findNext')}
        onClick={() => step('next')}
      >
        <ChevronDownIcon />
      </button>
      <button type="button" className="icon-btn" title={t('findClose')} aria-label={t('findClose')} onClick={close}>
        <CloseIcon />
      </button>
    </search>
  );
}
