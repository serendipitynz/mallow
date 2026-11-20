/** TASK-72's section: whether the parent can tell which link inside the rendered
 *  HTML view's frame is under the pointer or holds the focus, on an engine where
 *  the frame runs no parent-registered listener.
 *
 *  decision-9 measured that a document with scripting disabled invokes no
 *  listener the parent adds to it — on its nodes, its document or its window —
 *  on either WebKit engine. So `watchLinks`, which is how the markdown preview
 *  feeds the status bar, cannot work there. What is left is reach-in: the parent
 *  reading `:hover` and `activeElement` off the frame's document. That needs two
 *  things this section measures separately, because either can fail alone:
 *
 *  - **whether the readings move at all** in a frame that runs no script. A
 *    free-running poll reads them every frame from the moment the fixture is
 *    armed, independent of any trigger, so its answer does not rest on the next
 *    question;
 *  - **which parent-side events say the pointer or the focus entered and left
 *    the frame** — listeners on the iframe ELEMENT, the parent's window and the
 *    parent's document, all of which live in the app document, where listeners
 *    do run. The triggered poll starts and stops on those alone, which is the
 *    shape the app would ship (TASK-72 AC #4: polling only while the pointer is
 *    over the frame or the focus is inside it).
 *
 *  The fixture is prepared the way `HtmlView` prepares a document: the listener
 *  probe first, and the app's own `neutralizeAppOriginLinks` where it answers
 *  that no listener runs, so what is measured on WebKit is whether a neutralized
 *  link can be read at all — the task expects it cannot, since it neither
 *  hit-tests nor takes the focus.
 *
 *  The listener route is armed too, as `watchLinks` would arm it. On WebView2 it
 *  is the mechanism the app will use there; on WebKit it is the control that
 *  says the frame really is one that runs none. */

import { neutralizeAppOriginLinks } from '../lib/html-doc';
import { mountFrame, waitForFixture } from './harness';

/** The links in the fixture, in the order the reader is asked to point at them.
 *  `probe.invalid` cannot resolve, and nothing here is meant to be clicked. */
export const HOVER_FIXTURE_HREFS = [
  'https://probe.invalid/web',
  'https://probe.invalid/nested',
  '#section',
  './other.html',
  'mailto:probe@probe.invalid',
] as const;

const HREF_NOTE: Record<(typeof HOVER_FIXTURE_HREFS)[number], string> = {
  'https://probe.invalid/web': 'http(s) — left alone everywhere',
  'https://probe.invalid/nested': 'http(s), its text inside a strong element',
  '#section': 'app-origin — neutralized where no listener runs',
  './other.html': 'app-origin — neutralized where no listener runs',
  'mailto:probe@probe.invalid': 'not app-origin — left alone everywhere',
};

export function hoverFixture(): string {
  const items = HOVER_FIXTURE_HREFS.map((href) => {
    const text = `${href} — ${HREF_NOTE[href]}`;
    const inner = href.endsWith('/nested') ? `<strong>${text}</strong>` : text;
    return `<li><a href="${href}">${inner}</a></li>`;
  }).join('');
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<style>body{font:14px/1.5 system-ui,sans-serif;margin:12px}li{margin:8px 0}</style>',
    '</head><body>',
    '<p id="alive">TASK-72 fixture. Point at each link in turn and pause on it. Do not click.</p>',
    `<ol>${items}</ol>`,
    '<h2 id="section">Section</h2>',
    '</body></html>',
  ].join('');
}

/** Where a log entry came from. `element`, `window` and `document` are the
 *  parent-side triggers; `listener` is the `watchLinks`-shaped route inside the
 *  frame; `triggered` and `free` are the two polls. */
export type HoverSource = 'element' | 'window' | 'document' | 'listener' | 'triggered' | 'free';

export interface HoverLogEntry {
  /** Milliseconds since the fixture was armed. */
  t: number;
  source: HoverSource;
  what: string;
}

export interface HoverProbe {
  listenersRun: boolean;
  neutralized: boolean;
  dispose: () => void;
}

const LISTENER_PROBE_EVENT = 'mallow:listener-probe';

/** The same one-dispatch test `HtmlView` makes, written again here because the
 *  app's is private to the component; the probe must not export app internals. */
function runsParentListeners(doc: Document): boolean {
  let ran = false;
  const probe = () => {
    ran = true;
  };
  doc.addEventListener(LISTENER_PROBE_EVENT, probe);
  doc.dispatchEvent(new Event(LISTENER_PROBE_EVENT));
  doc.removeEventListener(LISTENER_PROBE_EVENT, probe);
  return ran;
}

function hrefOf(element: Element | null): string | null {
  return element?.closest('a[href]')?.getAttribute('href') ?? null;
}

function describe(target: EventTarget | null, frame: HTMLIFrameElement): string {
  if (target === frame) {
    return 'the iframe';
  }
  if (target === null) {
    return 'null';
  }
  if (target instanceof Element) {
    return target.id ? `${target.tagName.toLowerCase()}#${target.id}` : target.tagName.toLowerCase();
  }
  return target === window ? 'window' : String(target);
}

/** Mount the fixture into `host` and start logging into `log`. Everything the
 *  arm added is removed by `dispose`, which the section calls before re-arming. */
export async function armHoverProbe(
  host: HTMLElement,
  options: { freePoll: boolean },
  log: (entry: Omit<HoverLogEntry, 't'>) => void,
): Promise<HoverProbe> {
  const frame = mountFrame(host, hoverFixture());
  frame.style.height = '260px';
  const doc = await waitForFixture(frame);

  const listenersRun = runsParentListeners(doc);
  if (!listenersRun) {
    neutralizeAppOriginLinks(doc);
  }

  const cleanups: (() => void)[] = [];
  const on = <T extends EventTarget>(target: T, type: string, handler: (event: Event) => void) => {
    target.addEventListener(type, handler);
    cleanups.push(() => target.removeEventListener(type, handler));
  };

  // ---- The listener route, as `watchLinks` arms it on the preview.
  on(doc, 'pointerover', (e) => log({ source: 'listener', what: `pointerover → ${hrefOf(e.target as Element)}` }));
  on(doc.documentElement, 'pointerleave', () => log({ source: 'listener', what: 'pointerleave' }));
  on(doc, 'focusin', (e) => log({ source: 'listener', what: `focusin → ${hrefOf(e.target as Element)}` }));
  on(doc, 'focusout', () => log({ source: 'listener', what: 'focusout' }));

  // ---- The two polls. Each logs a change only, so a still pointer costs no lines.
  const read = () => ({
    hovered: doc.querySelector('a[href]:hover')?.getAttribute('href') ?? null,
    focused: hrefOf(doc.activeElement),
    focusInFrame: document.activeElement === frame,
  });

  let pointerInside = false;
  let triggeredRaf = 0;
  let triggeredFrames = 0;
  let triggeredLast = { hovered: null as string | null, focused: null as string | null };
  const triggeredTick = () => {
    const now = read();
    if (now.hovered !== triggeredLast.hovered) {
      log({ source: 'triggered', what: `hovered → ${now.hovered}` });
    }
    if (now.focused !== triggeredLast.focused) {
      log({ source: 'triggered', what: `focused → ${now.focused}` });
    }
    triggeredLast = { hovered: now.hovered, focused: now.focused };
    triggeredFrames += 1;
    if (pointerInside || now.focusInFrame) {
      triggeredRaf = requestAnimationFrame(triggeredTick);
      return;
    }
    triggeredRaf = 0;
    log({ source: 'triggered', what: `stopped after ${triggeredFrames} frames` });
    triggeredLast = { hovered: null, focused: null };
  };
  const startTriggered = (why: string) => {
    if (triggeredRaf !== 0) {
      return;
    }
    triggeredFrames = 0;
    log({ source: 'triggered', what: `started on ${why}` });
    triggeredRaf = requestAnimationFrame(triggeredTick);
  };

  // ---- The parent-side triggers. Every one is logged, used or not, because
  // which of them fire is the question.
  for (const type of ['pointerenter', 'mouseenter', 'mouseover']) {
    on(frame, type, () => {
      log({ source: 'element', what: type });
      pointerInside = true;
      startTriggered(`element ${type}`);
    });
  }
  // Counted rather than logged per event, and reported on `pointerleave`: one
  // line per move would bury the rest. It answers whether the element hears
  // movement inside the frame, which would make a poll unnecessary.
  let pointerMoves = 0;
  on(frame, 'pointermove', () => {
    pointerMoves += 1;
  });
  for (const type of ['pointerleave', 'mouseleave', 'mouseout']) {
    on(frame, type, () => {
      log({
        source: 'element',
        what: type === 'pointerleave' ? `${type} (pointermove × ${pointerMoves} since the last leave)` : type,
      });
      if (type === 'pointerleave') {
        pointerMoves = 0;
      }
      pointerInside = false;
    });
  }
  for (const type of ['focus', 'blur']) {
    on(frame, type, () => {
      log({ source: 'element', what: type });
      if (type === 'focus') {
        startTriggered('element focus');
      }
    });
  }
  for (const type of ['focus', 'blur']) {
    on(window, type, () => {
      log({ source: 'window', what: `${type} (activeElement: ${describe(document.activeElement, frame)})` });
      if (document.activeElement === frame) {
        startTriggered(`window ${type}`);
      }
    });
  }
  for (const type of ['focusin', 'focusout']) {
    on(document, type, (e) => {
      const fe = e as FocusEvent;
      if (fe.target !== frame && fe.relatedTarget !== frame) {
        return;
      }
      log({
        source: 'document',
        what: `${type} target ${describe(fe.target, frame)}, relatedTarget ${describe(fe.relatedTarget, frame)}`,
      });
      if (type === 'focusin' && fe.target === frame) {
        startTriggered('document focusin');
      }
    });
  }

  let freeRaf = 0;
  if (options.freePoll) {
    let last = { hovered: null as string | null, focused: null as string | null, focusInFrame: false };
    const freeTick = () => {
      const now = read();
      if (now.hovered !== last.hovered) {
        log({ source: 'free', what: `hovered → ${now.hovered}` });
      }
      if (now.focused !== last.focused) {
        log({ source: 'free', what: `focused → ${now.focused}` });
      }
      if (now.focusInFrame !== last.focusInFrame) {
        log({ source: 'free', what: `parent activeElement is the iframe → ${now.focusInFrame}` });
      }
      last = now;
      freeRaf = requestAnimationFrame(freeTick);
    };
    freeRaf = requestAnimationFrame(freeTick);
  }

  log({
    source: 'element',
    what: `armed — listeners run: ${listenersRun}, neutralizeAppOriginLinks applied: ${!listenersRun}`,
  });

  return {
    listenersRun,
    neutralized: !listenersRun,
    dispose: () => {
      cancelAnimationFrame(triggeredRaf);
      cancelAnimationFrame(freeRaf);
      for (const cleanup of cleanups) {
        cleanup();
      }
      host.replaceChildren();
    },
  };
}

export interface HrefSummary {
  href: string;
  note: string;
  hoveredFree: boolean;
  hoveredTriggered: boolean;
  focusedFree: boolean;
  focusedTriggered: boolean;
  listenerOver: boolean;
  listenerFocus: boolean;
}

/** Per link, whether each route ever named it. A neutralized link that no route
 *  names is the expected WebKit answer; one that the free poll names and the
 *  triggered poll does not is a trigger that did not fire. */
export function summarizeHover(entries: readonly HoverLogEntry[]): HrefSummary[] {
  const saw = (source: HoverSource, prefix: string, href: string) =>
    entries.some((e) => e.source === source && e.what === `${prefix} → ${href}`);
  return HOVER_FIXTURE_HREFS.map((href) => ({
    href,
    note: HREF_NOTE[href],
    hoveredFree: saw('free', 'hovered', href),
    hoveredTriggered: saw('triggered', 'hovered', href),
    focusedFree: saw('free', 'focused', href),
    focusedTriggered: saw('triggered', 'focused', href),
    listenerOver: saw('listener', 'pointerover', href),
    listenerFocus: saw('listener', 'focusin', href),
  }));
}
