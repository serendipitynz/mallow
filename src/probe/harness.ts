/** The TASK-7 probe runner: mounts each fixture, exercises it, and returns one
 *  verdict per acceptance criterion.
 *
 *  Two rules shape everything here.
 *
 *  The two layers are measured independently, so every verdict names the layer
 *  it is evidence for. The sandbox is measured with a script the CSP *permits*
 *  (`MARKER_SRC`, an app-origin external script) and the CSP is measured with
 *  `securitypolicyviolation` events rather than with a failed load — an
 *  unreachable host produces a failed load either way, so "it did not load" is
 *  not evidence that the CSP refused it.
 *
 *  Each layer carries a positive control, and a failed control downgrades the
 *  checks that rest on it to `inconclusive` instead of letting them pass. A
 *  missing file would otherwise look exactly like containment, and a run with
 *  no CSP at all (which is every `tauri dev` run on desktop) would pass every
 *  sandbox-only check while failing every CSP one. */

import { convertFileSrc } from '@tauri-apps/api/core';
import { allowMediaDir } from '../lib/tauri';
import {
  assetImageFixture,
  BLOCKED_ORIGIN,
  colorSchemeFixture,
  DATA_IMAGE,
  DATA_STYLESHEET,
  formFixture,
  MARKER_SRC,
  manualClickFixture,
  metaRefreshFixture,
  networkFixture,
  plainLinkFixture,
  REMOTE_IMAGE,
  scriptsFixture,
  TOP_NAV_QUERY,
  tallFixture,
  topNavFixture,
  unstyledFixture,
} from './fixtures';

export type Verdict = 'pass' | 'fail' | 'inconclusive';

/** Which of the two layers a verdict is evidence for. `both` marks a shape
 *  decision-3's table lists as stopped by the sandbox AND the CSP, so its
 *  result cannot attribute containment to either one. */
export type Layer = 'sandbox' | 'csp' | 'both' | 'parent' | 'render' | 'control';

export interface Check {
  id: string;
  ac: number[];
  layer: Layer;
  title: string;
  verdict: Verdict;
  detail: string;
}

export interface Environment {
  origin: string;
  href: string;
  userAgent: string;
  /** Effective CSP as reported by a violation in the app document, which is the
   *  only place the bootstrap script's sha256 is visible (AC #15). */
  parentCsp: string | null;
  /** Effective CSP as reported by a violation inside the frame. Equality with
   *  `parentCsp` is the inheritance premise. */
  frameCsp: string | null;
  cspPresent: boolean;
  markerRunsInParent: boolean;
  contentDocumentReadable: boolean;
  compatMode: string | null;
  frameScrollHeight: number | null;
  scrollIntoViewMovedParent: boolean | null;
  parentSideScrollWorks: boolean | null;
  prefersDarkInsideFrame: boolean | null;
  unstyled: FrameColors | null;
  colorScheme: FrameColors | null;
}

export interface FrameColors {
  documentElementColorScheme: string;
  bodyColor: string;
  bodyBackground: string;
  htmlBackground: string;
}

export interface Hosts {
  scripts: HTMLElement;
  network: HTMLElement;
  form: HTMLElement;
  metaRefresh: HTMLElement;
  topNav: HTMLElement;
  plainLink: HTMLElement;
  tallScroller: HTMLElement;
  tall: HTMLElement;
  unstyled: HTMLElement;
  colorScheme: HTMLElement;
}

export interface RunResult {
  env: Environment;
  checks: Check[];
}

const SANDBOX = 'allow-same-origin';
const VIOLATION_WAIT_MS = 1500;
const LOAD_TIMEOUT_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function check(id: string, ac: number[], layer: Layer, title: string, verdict: Verdict, detail: string): Check {
  return { id, ac, layer, title, verdict, detail };
}

/** `pass` when the observation matches the expectation, `fail` otherwise. */
function expect(condition: boolean): Verdict {
  return condition ? 'pass' : 'fail';
}

function mountFrame(host: HTMLElement, srcdoc: string): HTMLIFrameElement {
  host.replaceChildren();
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', SANDBOX);
  frame.className = 'probe-frame';
  // srcdoc is assigned while detached so the fixture is the frame's first real
  // navigation; the load event alone cannot distinguish it from about:blank.
  frame.srcdoc = srcdoc;
  host.appendChild(frame);
  return frame;
}

/** Resolve once the fixture document itself is in the frame. Waiting for the
 *  `alive` marker rather than for `load` is what makes "the fixture navigated
 *  away" observable: that document answers `load` too. */
async function waitForFixture(frame: HTMLIFrameElement): Promise<Document> {
  const deadline = Date.now() + LOAD_TIMEOUT_MS;
  // Whether the parent ever got a document at all. A frame that lost same-origin
  // hands back `null` rather than throwing, so this is the difference between
  // "the premise failed" and "the fixture failed to load".
  let everReadable = false;
  while (Date.now() < deadline) {
    let doc: Document | null = null;
    try {
      doc = frame.contentDocument;
    } catch {
      throw new Error('contentDocument threw: the frame is not same-origin with the parent');
    }
    if (doc !== null) {
      everReadable = true;
      if (doc.getElementById('alive') !== null) {
        return doc;
      }
    }
    await sleep(25);
  }
  throw new Error(
    everReadable
      ? 'contentDocument stayed readable but never held the fixture: the frame failed to load it'
      : 'contentDocument was null throughout, which is what an opaque origin looks like: the frame is not same-origin with the parent',
  );
}

/** Whether the fixture is still the frame's document, i.e. nothing navigated. */
function stillOnFixture(frame: HTMLIFrameElement): boolean {
  try {
    // `?.` alone would answer `undefined !== null` — true — for an unreadable
    // frame, turning a lost document into "nothing navigated".
    return (frame.contentDocument?.getElementById('alive') ?? null) !== null;
  } catch {
    return false;
  }
}

interface ViolationCollector {
  events: SecurityPolicyViolationEvent[];
  stop: () => void;
}

function collectViolations(target: Document): ViolationCollector {
  const events: SecurityPolicyViolationEvent[] = [];
  const onViolation = (event: Event): void => {
    events.push(event as SecurityPolicyViolationEvent);
  };
  target.addEventListener('securitypolicyviolation', onViolation);
  return {
    events,
    stop: () => {
      target.removeEventListener('securitypolicyviolation', onViolation);
    },
  };
}

function violationFor(
  events: SecurityPolicyViolationEvent[],
  needle: string,
): SecurityPolicyViolationEvent | undefined {
  return events.find((event) => event.blockedURI.includes(needle));
}

function describeViolation(event: SecurityPolicyViolationEvent | undefined): string {
  if (event === undefined) {
    return 'no securitypolicyviolation reported';
  }
  return `violated ${event.effectiveDirective || event.violatedDirective} (blockedURI ${event.blockedURI})`;
}

/** Resolved styles are read through the frame's OWN window: the used colour
 *  scheme is a property of that document's view, and asking the parent's window
 *  about another document's element is not what is being measured. */
function colorsOf(doc: Document): FrameColors {
  const view = doc.defaultView ?? window;
  return {
    documentElementColorScheme: view.getComputedStyle(doc.documentElement).colorScheme,
    bodyColor: view.getComputedStyle(doc.body).color,
    bodyBackground: view.getComputedStyle(doc.body).backgroundColor,
    htmlBackground: view.getComputedStyle(doc.documentElement).backgroundColor,
  };
}

/** A click event built in the frame's own realm. Constructing it in the parent's
 *  realm and dispatching it into another document is legal but not identical,
 *  and this probe cannot afford the difference: an event the engine declines to
 *  deliver would make every "nothing ran" result vacuous. */
function frameClickEvent(doc: Document): MouseEvent {
  const view = doc.defaultView;
  const ctor = view === null ? MouseEvent : view.MouseEvent;
  return new ctor('click', { bubbles: true, cancelable: true });
}

interface ClickDispatch {
  viaClickMethod: boolean;
  viaDispatchEvent: boolean;
  worked: boolean;
}

/** Positive control for the click-driven checks. `HTMLElement.click()` and a
 *  constructed `MouseEvent` are counted separately because they are different
 *  mechanisms, and an engine that delivers one but not the other would otherwise
 *  read as "the frame is contained". */
function measureClickDispatch(doc: Document): ClickDispatch {
  const control = doc.getElementById('click-control');
  if (control === null) {
    return { viaClickMethod: false, viaDispatchEvent: false, worked: false };
  }
  let seen = 0;
  const onClick = (): void => {
    seen += 1;
  };
  doc.addEventListener('click', onClick);
  control.click();
  const viaClickMethod = seen > 0;
  seen = 0;
  control.dispatchEvent(frameClickEvent(doc));
  const viaDispatchEvent = seen > 0;
  doc.removeEventListener('click', onClick);
  return { viaClickMethod, viaDispatchEvent, worked: viaClickMethod || viaDispatchEvent };
}

/** Drive a click through whichever mechanism the control showed works. */
function clickIn(doc: Document, id: string, dispatch: ClickDispatch): void {
  const element = doc.getElementById(id);
  if (element === null) {
    return;
  }
  if (dispatch.viaClickMethod || !dispatch.viaDispatchEvent) {
    element.click();
  }
  if (dispatch.viaDispatchEvent) {
    element.dispatchEvent(frameClickEvent(doc));
  }
}

/** AC #14. The sandbox probe is only meaningful once the same script is known
 *  to run when the parent loads it — otherwise a 404 reads as containment. */
async function runMarkerInParent(): Promise<boolean> {
  const before = window.__mallowProbeMark ?? 0;
  const script = document.createElement('script');
  script.src = MARKER_SRC;
  await new Promise<void>((resolve) => {
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => resolve(), { once: true });
    document.head.appendChild(script);
  });
  script.remove();
  return (window.__mallowProbeMark ?? 0) > before;
}

/** AC #15. Provokes one violation in the app document and reads the effective
 *  policy back off the event, because `tauri.conf.json` is not what ships: the
 *  bootstrap script's sha256 is added to `script-src` at build time. No
 *  violation means there is no CSP on this run at all. */
async function captureParentCsp(): Promise<{ policy: string | null; present: boolean }> {
  const collector = collectViolations(document);
  const script = document.createElement('script');
  script.src = `${BLOCKED_ORIGIN}/parent-csp-control.js`;
  document.head.appendChild(script);
  await sleep(VIOLATION_WAIT_MS);
  collector.stop();
  script.remove();
  const hit = violationFor(collector.events, BLOCKED_ORIGIN);
  return { policy: hit?.originalPolicy ?? null, present: hit !== undefined };
}

async function runScriptsFixture(host: HTMLElement, cspPresent: boolean, markerControl: boolean): Promise<Check[]> {
  const frame = mountFrame(host, scriptsFixture());
  const doc = await waitForFixture(frame);
  const win = frame.contentWindow;

  const dispatch = measureClickDispatch(doc);
  clickIn(doc, 'onclick-probe', dispatch);
  clickIn(doc, 'jsurl-probe', dispatch);
  await sleep(400);

  const markerRan = (win?.__mallowProbeMark ?? 0) > 0;
  const nested = doc.getElementById('nested-probe') as HTMLIFrameElement | null;
  const nestedRan = nested?.contentWindow?.__probeNested === true;
  const styled = doc.getElementById('styled');
  const styledColor = styled === null ? '' : (doc.defaultView ?? window).getComputedStyle(styled).color;

  const clickNote = `click dispatch control: HTMLElement.click() delivered ${dispatch.viaClickMethod}, dispatchEvent delivered ${dispatch.viaDispatchEvent}`;

  return [
    check(
      'control.click-dispatch',
      [3, 10],
      'control',
      'A click driven from the parent actually reaches the frame document',
      expect(dispatch.worked),
      dispatch.worked
        ? clickNote
        : `${clickNote} — no click reaches the frame at all, so every "nothing ran when clicked" result below is vacuous rather than evidence of containment`,
    ),
    check(
      'sandbox.external-script',
      [1],
      'sandbox',
      'App-origin external script does not execute inside the frame',
      markerControl ? expect(!markerRan) : 'inconclusive',
      markerControl
        ? `window.__mallowProbeMark inside the frame: ${win?.__mallowProbeMark ?? 'undefined'}. ${MARKER_SRC} is permitted by script-src 'self', so a non-execution here is the sandbox and nothing else.`
        : `the positive control failed: ${MARKER_SRC} did not execute in the parent either, so a non-execution in the frame proves nothing`,
    ),
    check(
      'sandbox.inline-script',
      [3],
      cspPresent ? 'both' : 'sandbox',
      'Inline <script> does not execute',
      expect(win?.__probeInline !== true),
      `window.__probeInline: ${String(win?.__probeInline)}. ${cspPresent ? 'Stopped by the sandbox AND the CSP; this cannot attribute to either.' : 'No CSP on this run, so the sandbox is the only candidate.'}`,
    ),
    check(
      'sandbox.onclick',
      [3],
      cspPresent ? 'both' : 'sandbox',
      'on-click content attribute does not run when clicked',
      dispatch.worked ? expect(win?.__probeOnclick !== true) : 'inconclusive',
      `window.__probeOnclick: ${String(win?.__probeOnclick)} after dispatching a click. ${clickNote}`,
    ),
    check(
      'sandbox.javascript-url',
      [3],
      cspPresent ? 'both' : 'sandbox',
      'javascript: link is inert when clicked',
      dispatch.worked ? expect(win?.__probeJsUrl !== true && stillOnFixture(frame)) : 'inconclusive',
      `window.__probeJsUrl: ${String(win?.__probeJsUrl)}; fixture still loaded: ${stillOnFixture(frame)}. ${clickNote}`,
    ),
    check(
      'sandbox.nested-iframe',
      [5],
      'sandbox',
      'A nested iframe inherits the sandbox flags, so its inline script does not run',
      expect(!nestedRan),
      `nested window.__probeNested: ${String(nested?.contentWindow?.__probeNested)}; nested contentWindow reachable: ${nested?.contentWindow != null}`,
    ),
    check(
      'render.inline-style',
      [16],
      'render',
      'An inline <style> block applies',
      expect(styledColor === 'rgb(0, 128, 0)'),
      `computed colour of #styled: ${styledColor || 'unreadable'} (expected rgb(0, 128, 0)); document.compatMode: ${doc.compatMode}`,
    ),
  ];
}

/** Whether the frame's document is under the policy, judged by what the policy
 *  DOES rather than by what it reports. `blocked` = inherited. */
type Inheritance = 'blocked' | 'applied' | 'unknown';

interface NetworkOutcome {
  checks: Check[];
  frameCsp: string | null;
  inheritance: Inheritance;
  reportsViolations: boolean;
}

async function runNetworkFixture(host: HTMLElement, cspPresent: boolean): Promise<NetworkOutcome> {
  const frame = mountFrame(host, networkFixture());
  const doc = await waitForFixture(frame);
  const collector = collectViolations(doc);

  // Injected from the parent so the listener is in place before the fetch. The
  // CSP is a property of the frame's document, not of who inserted the node.
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = `${BLOCKED_ORIGIN}/injected.css`;
  doc.head.appendChild(link);

  const script = doc.createElement('script');
  script.src = `${BLOCKED_ORIGIN}/injected.js`;
  doc.head.appendChild(script);

  const image = doc.createElement('img');
  image.src = REMOTE_IMAGE;
  doc.body.appendChild(image);

  const dataSheet = doc.createElement('link');
  dataSheet.rel = 'stylesheet';
  dataSheet.href = DATA_STYLESHEET;
  doc.head.appendChild(dataSheet);

  const dataImage = doc.createElement('img');
  dataImage.src = DATA_IMAGE;
  doc.body.appendChild(dataImage);

  // A font is only fetched once something uses it, which is why the authored
  // @font-face is the one blocked shape whose violation can still be caught.
  try {
    await doc.fonts.load("12px 'ProbeAuthoredFont'");
  } catch {
    // A refused fetch rejects here on some engines; the violation is the record.
  }
  await sleep(VIOLATION_WAIT_MS);
  collector.stop();

  const cssHit = violationFor(collector.events, 'injected.css');
  const jsHit = violationFor(collector.events, 'injected.js');
  const fontHit = violationFor(collector.events, 'authored.woff2');
  const imageHit = violationFor(collector.events, 'raw.githubusercontent.com');
  const frameCsp = collector.events[0]?.originalPolicy ?? null;
  const reportsViolations = collector.events.length > 0;

  const remoteImg = doc.getElementById('remote-img') as HTMLImageElement | null;
  const authoredImageLoaded = (remoteImg?.naturalWidth ?? 0) > 0;
  const injectedImageLoaded = image.naturalWidth > 0;

  const target = doc.getElementById('csp-effect-target');
  const targetColor = target === null ? '' : (doc.defaultView ?? window).getComputedStyle(target).color;
  const dataSheetApplied = targetColor === 'rgb(255, 0, 0)';
  const dataImageLoaded = dataImage.naturalWidth > 0;
  const inheritance: Inheritance = !dataImageLoaded ? 'unknown' : dataSheetApplied ? 'applied' : 'blocked';

  const effectNote = `data: stylesheet applied: ${dataSheetApplied} (computed colour ${targetColor || 'unreadable'}; red means it applied, blue means the policy refused it); data: image control loaded: ${dataImageLoaded}`;

  // A missing violation has two causes that look identical from the event side:
  // the policy was never inherited, or this engine does not report violations in
  // a srcdoc document. The effect probe is what separates them, so a silent
  // engine yields "inconclusive" rather than a false failure.
  const remoteVerdict = (hit: SecurityPolicyViolationEvent | undefined): Verdict => {
    if (!cspPresent) {
      return 'inconclusive';
    }
    if (hit !== undefined) {
      return 'pass';
    }
    return inheritance === 'applied' ? 'fail' : 'inconclusive';
  };
  const remoteNote = (hit: SecurityPolicyViolationEvent | undefined): string => {
    if (!cspPresent) {
      return 'no CSP was present on this run, so the CSP layer was not measured';
    }
    if (hit !== undefined) {
      return describeViolation(hit);
    }
    if (inheritance === 'blocked') {
      return `no securitypolicyviolation reported, but the effect probe shows the policy IS in force inside the frame — this engine does not report violations there. ${effectNote}`;
    }
    if (inheritance === 'applied') {
      return `no securitypolicyviolation reported, and the effect probe shows the policy is NOT in force inside the frame. ${effectNote}`;
    }
    return `no securitypolicyviolation reported, and the effect probe was itself inconclusive. ${effectNote}`;
  };

  return {
    frameCsp,
    inheritance,
    reportsViolations,
    checks: [
      check(
        'csp.inheritance-by-effect',
        [2, 15],
        'csp',
        'The srcdoc document is under the parent CSP, measured by what the policy does',
        inheritance === 'blocked' ? 'pass' : inheritance === 'applied' ? 'fail' : 'inconclusive',
        `${effectNote}. style-src is 'self' 'unsafe-inline' with no data:, so an inherited policy must refuse the stylesheet; img-src lists data: explicitly, so the image must load. Neither touches the network, which is why this stands where the violation events are silent.`,
      ),
      check(
        'csp.violation-reporting',
        [15],
        'control',
        'This engine reports securitypolicyviolation inside a srcdoc frame',
        expect(reportsViolations),
        reportsViolations
          ? `${collector.events.length} violation(s) reported inside the frame`
          : 'no violations reported inside the frame. This is about the REPORTING, not the policy — read csp.inheritance-by-effect for whether the policy is there.',
      ),
      check(
        'csp.remote-stylesheet',
        [2],
        'csp',
        'A remote stylesheet is refused by the inherited CSP',
        remoteVerdict(cssHit),
        remoteNote(cssHit),
      ),
      check(
        'csp.remote-script',
        [2],
        'csp',
        'A remote script is refused by the inherited CSP',
        remoteVerdict(jsHit),
        remoteNote(jsHit),
      ),
      check(
        'csp.remote-font',
        [2],
        'csp',
        'A remote font declared by the document itself is refused by the inherited CSP',
        remoteVerdict(fontHit),
        `${remoteNote(fontHit)} Authored in the fixture's own markup, so this is the document inheriting the policy rather than a parent-injected node.`,
      ),
      check(
        'csp.remote-image',
        [2, 16],
        'csp',
        'A remote image is NOT refused, and loads',
        expect(imageHit === undefined && (authoredImageLoaded || injectedImageLoaded)),
        `CSP verdict: ${imageHit === undefined ? 'no violation reported (img-src allows https:)' : describeViolation(imageHit)}. Load verdict: authored ${authoredImageLoaded}, injected ${injectedImageLoaded}. A false here with no violation means the network was unavailable, not that the CSP refused it.`,
      ),
    ],
  };
}

async function runFormFixture(host: HTMLElement): Promise<Check[]> {
  const frame = mountFrame(host, formFixture());
  const doc = await waitForFixture(frame);
  const collector = collectViolations(doc);

  (doc.getElementById('submit-plain') as HTMLButtonElement | null)?.click();
  await sleep(600);
  const afterPlain = stillOnFixture(frame);
  if (afterPlain) {
    (doc.getElementById('submit-formaction') as HTMLButtonElement | null)?.click();
  }
  await sleep(600);
  collector.stop();
  const afterFormaction = stillOnFixture(frame);
  const hit = violationFor(collector.events, BLOCKED_ORIGIN);

  return [
    check(
      'sandbox.form-submit',
      [4],
      hit === undefined ? 'sandbox' : 'csp',
      'Neither the form action nor a button formaction submits',
      expect(afterPlain && afterFormaction),
      `fixture still loaded after the plain submit: ${afterPlain}, after the formaction submit: ${afterFormaction}. Layer: ${hit === undefined ? 'no CSP violation was reported, so the submission was stopped before it became a navigation — the sandbox (allow-forms is absent)' : describeViolation(hit)}`,
    ),
  ];
}

async function runMetaRefreshFixture(host: HTMLElement): Promise<Check[]> {
  const frame = mountFrame(host, metaRefreshFixture());
  const doc = await waitForFixture(frame);
  const collector = collectViolations(doc);
  await sleep(2000);
  collector.stop();
  const survived = stillOnFixture(frame);
  const hit = violationFor(collector.events, BLOCKED_ORIGIN);

  return [
    check(
      'nav.meta-refresh',
      [4],
      hit === undefined ? 'sandbox' : 'csp',
      'A meta refresh does not navigate the frame',
      expect(survived),
      `fixture still loaded after 2s: ${survived}. Layer: ${hit === undefined ? 'no CSP violation reported' : describeViolation(hit)}. A sandbox without allow-top-navigation does not stop a frame navigating ITSELF, so frame-src is the expected stop here.`,
    ),
  ];
}

async function runTopNavFixture(host: HTMLElement): Promise<Check[]> {
  const frame = mountFrame(host, topNavFixture());
  const doc = await waitForFixture(frame);
  (doc.getElementById('top-link') as HTMLAnchorElement | null)?.click();
  await sleep(1200);
  // Reaching this line at all is most of the answer: the link targets the app's
  // own index, so a successful top navigation would have reloaded this page.
  const survived = !window.location.search.includes(TOP_NAV_QUERY);

  return [
    check(
      'sandbox.top-navigation',
      [4],
      'sandbox',
      'target="_top" cannot navigate the app away',
      expect(survived),
      survived
        ? 'the probe page was not reloaded and no query flag is present'
        : `the app navigated to ${window.location.href}: allow-top-navigation is absent, so this is a sandbox failure`,
    ),
  ];
}

async function runPlainLinkFixture(host: HTMLElement): Promise<Check[]> {
  const frame = mountFrame(host, plainLinkFixture());
  const doc = await waitForFixture(frame);

  const dispatch = measureClickDispatch(doc);
  let intercepted = 0;
  const onClick = (event: Event): void => {
    intercepted += 1;
    event.preventDefault();
  };
  doc.addEventListener('click', onClick);
  clickIn(doc, 'plain-link', dispatch);
  await sleep(800);
  const survivedWithHandler = stillOnFixture(frame);
  doc.removeEventListener('click', onClick);

  // Informational: what the frame does on its own, once the parent stops
  // intercepting. Recorded because TASK-5.2 needs to know whether interception
  // is the only thing standing between a click and a navigation.
  const collector = collectViolations(doc);
  clickIn(doc, 'plain-link', dispatch);
  await sleep(1000);
  collector.stop();
  const survivedWithout = stillOnFixture(frame);
  const hit = violationFor(collector.events, BLOCKED_ORIGIN);

  return [
    check(
      'parent.link-interception',
      [10],
      'parent',
      'A plain link with no target does not navigate the frame once the parent intercepts clicks',
      dispatch.worked ? expect(intercepted > 0 && survivedWithHandler) : 'inconclusive',
      `the parent's listener saw ${intercepted} click(s) on the link; fixture still loaded: ${survivedWithHandler}. Click dispatch control on this fixture: HTMLElement.click() delivered ${dispatch.viaClickMethod}, dispatchEvent delivered ${dispatch.viaDispatchEvent}. 0 intercepted clicks with a working control means the LINK specifically swallowed it, which would be a real defect for TASK-5.2; 0 with a failed control means only that the probe could not reach the frame.`,
    ),
    check(
      'nav.plain-link-uncontrolled',
      [10],
      hit === undefined ? 'sandbox' : 'csp',
      'Informational: what a plain link does with NO parent interception',
      survivedWithout ? 'pass' : 'fail',
      `fixture still loaded without interception: ${survivedWithout}. ${hit === undefined ? 'no CSP violation reported' : describeViolation(hit)}. A false here is not a defect — it records that interception is load-bearing for TASK-5.2.`,
    ),
  ];
}

interface ScrollOutcome {
  checks: Check[];
  compatMode: string | null;
  scrollHeight: number | null;
  scrollIntoViewMovedParent: boolean | null;
  parentSideScrollWorks: boolean | null;
}

async function runScrollFixture(scroller: HTMLElement, host: HTMLElement): Promise<ScrollOutcome> {
  const frame = mountFrame(host, tallFixture());
  const doc = await waitForFixture(frame);

  const scrollHeight = doc.documentElement.scrollHeight;
  // The frame is sized to its content, as decision-3 specifies, so the app's
  // scroller stays the only scroller. Every scroll result below assumes this.
  frame.style.height = `${scrollHeight}px`;
  await sleep(150);

  const target = doc.getElementById('deep-target');
  if (target === null) {
    return {
      compatMode: doc.compatMode,
      scrollHeight,
      scrollIntoViewMovedParent: null,
      parentSideScrollWorks: null,
      checks: [
        check(
          'parent.reach-in',
          [6],
          'parent',
          'The parent can reach into contentDocument',
          'fail',
          'deep-target missing',
        ),
      ],
    };
  }

  scroller.scrollTop = 0;
  await sleep(100);
  target.scrollIntoView({ block: 'start' });
  await sleep(300);
  const afterScrollIntoView = scroller.scrollTop;
  const movedParent = afterScrollIntoView > 4;

  // The alternative TASK-8 has to choose between: convert the target's rect out
  // of the frame's coordinate space and drive the parent's scroller directly.
  scroller.scrollTop = 0;
  await sleep(100);
  const desired =
    target.getBoundingClientRect().top + frame.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  scroller.scrollTop = desired;
  await sleep(200);
  const residual =
    target.getBoundingClientRect().top + frame.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  const parentSideWorks = Math.abs(residual) < 3;

  return {
    compatMode: doc.compatMode,
    scrollHeight,
    scrollIntoViewMovedParent: movedParent,
    parentSideScrollWorks: parentSideWorks,
    checks: [
      check(
        'parent.reach-in',
        [6],
        'parent',
        'The parent can read contentDocument, scroll it, and measure scrollHeight',
        expect(scrollHeight > 0 && (movedParent || parentSideWorks)),
        `documentElement.scrollHeight ${scrollHeight}px, body.scrollHeight ${doc.body.scrollHeight}px, compatMode ${doc.compatMode}. At least one boundary-crossing scroll mechanism works.`,
      ),
      check(
        'parent.scroll-mechanism',
        [13],
        'parent',
        'Which mechanism crosses the frame boundary (TASK-8 picks from this)',
        scrollIntoViewOrParentSide(movedParent, parentSideWorks),
        `scrollIntoView on an element inside the frame moved the parent scroller: ${movedParent} (scrollTop became ${afterScrollIntoView}). Parent-side rect conversion + scrollTop landed the target: ${parentSideWorks} (residual ${Math.round(residual)}px). decision-3 assumes scrollIntoView does NOT move the parent and specifies the second mechanism.`,
      ),
    ],
  };
}

function scrollIntoViewOrParentSide(movedParent: boolean, parentSideWorks: boolean): Verdict {
  // Either answer is a legitimate observation; only "neither works" is a defect,
  // because TASK-8 would then have no mechanism at all.
  return movedParent || parentSideWorks ? 'pass' : 'fail';
}

interface RenderOutcome {
  checks: Check[];
  unstyled: FrameColors | null;
  colorScheme: FrameColors | null;
  prefersDarkInsideFrame: boolean | null;
}

async function runRenderFixtures(unstyledHost: HTMLElement, colorSchemeHost: HTMLElement): Promise<RenderOutcome> {
  const unstyledFrame = mountFrame(unstyledHost, unstyledFixture());
  const unstyledDoc = await waitForFixture(unstyledFrame);
  const colorFrame = mountFrame(colorSchemeHost, colorSchemeFixture());
  const colorDoc = await waitForFixture(colorFrame);
  await sleep(200);

  const prefersDark = colorFrame.contentWindow?.matchMedia('(prefers-color-scheme: dark)').matches ?? null;

  return {
    unstyled: colorsOf(unstyledDoc),
    colorScheme: colorsOf(colorDoc),
    prefersDarkInsideFrame: prefersDark,
    checks: [
      check(
        'render.both-documents',
        [11],
        'render',
        'Both an unstyled document and a colour-scheme-declaring document render',
        expect(unstyledDoc.body.textContent !== '' && colorDoc.body.textContent !== ''),
        `unstyled compatMode ${unstyledDoc.compatMode}, colour-scheme compatMode ${colorDoc.compatMode}. prefers-color-scheme inside the frame evaluates to dark: ${String(prefersDark)}. The canvas colour and the contrast are visual and are recorded by hand below.`,
      ),
    ],
  };
}

/** What reached the parent from a real click inside the frame, counted per
 *  attachment point. decision-3 puts link interception on a listener the parent
 *  adds to `contentDocument`; if that listener never runs, the mechanism has to
 *  change, and the alternatives worth knowing about are the same listener in the
 *  capture phase, on the frame's `Window`, or on the element itself. */
export interface ClickCounts {
  documentBubble: number;
  documentCapture: number;
  windowBubble: number;
  elementBubble: number;
  documentMousedown: number;
  customEvent: number;
  navigatedAway: boolean;
}

const NO_CLICKS: ClickCounts = {
  documentBubble: 0,
  documentCapture: 0,
  windowBubble: 0,
  elementBubble: 0,
  documentMousedown: 0,
  customEvent: 0,
  navigatedAway: false,
};

/** Mount the by-hand click fixture and report every delivery as it happens.
 *  Returns a teardown. The custom-event counter is dispatched immediately: it
 *  separates "this document runs no listeners at all" from "clicks specifically
 *  do not arrive", which are different problems with different fixes. */
export async function armClickProbe(host: HTMLElement, onUpdate: (counts: ClickCounts) => void): Promise<() => void> {
  const frame = mountFrame(host, manualClickFixture());
  const doc = await waitForFixture(frame);
  const counts: ClickCounts = { ...NO_CLICKS };
  const publish = (): void => {
    counts.navigatedAway = !stillOnFixture(frame);
    onUpdate({ ...counts });
  };

  const bump = (key: keyof Omit<ClickCounts, 'navigatedAway'>) => (event: Event) => {
    counts[key] += 1;
    event.preventDefault();
    publish();
  };
  const onDocumentBubble = bump('documentBubble');
  const onDocumentCapture = bump('documentCapture');
  const onWindowBubble = bump('windowBubble');
  const onElementBubble = bump('elementBubble');
  const onMousedown = bump('documentMousedown');
  const onCustom = bump('customEvent');

  doc.addEventListener('click', onDocumentBubble);
  doc.addEventListener('click', onDocumentCapture, true);
  doc.addEventListener('mousedown', onMousedown);
  doc.addEventListener('probe-ping', onCustom);
  frame.contentWindow?.addEventListener('click', onWindowBubble);
  doc.getElementById('manual-link')?.addEventListener('click', onElementBubble);
  doc.getElementById('manual-button')?.addEventListener('click', onElementBubble);

  doc.dispatchEvent(new (doc.defaultView ?? window).Event('probe-ping', { cancelable: true }));
  publish();

  return () => {
    doc.removeEventListener('click', onDocumentBubble);
    doc.removeEventListener('click', onDocumentCapture, true);
    doc.removeEventListener('mousedown', onMousedown);
    doc.removeEventListener('probe-ping', onCustom);
  };
}

/** Reproduce what `Outline` does when a heading is chosen: make the target
 *  focusable and focus it. The keyboard-scrolling question (AC #12) is only
 *  meaningful once focus is actually inside the frame, and clicking a plain
 *  heading does not put it there. */
export function focusHeadingInFrame(host: HTMLElement): string {
  const frame = host.querySelector('iframe');
  const target = frame?.contentDocument?.getElementById('deep-target');
  if (target === undefined || target === null) {
    return 'no heading found — run the checks first';
  }
  target.setAttribute('tabindex', '-1');
  target.focus();
  const active = frame?.contentDocument?.activeElement;
  return `focused ${target.id}; the frame document's activeElement is now ${active?.tagName ?? 'unknown'}#${active?.id ?? ''}`;
}

/** AC #16's asset-protocol half. Split out because it needs a file the user
 *  picks: the probe build ships no image on disk outside the bundle, and an
 *  app-origin image would not exercise `convertFileSrc` at all. */
export async function runAssetImageCheck(host: HTMLElement, filePath: string): Promise<Check> {
  const separator = filePath.includes('\\') ? '\\' : '/';
  const dir = filePath.slice(0, filePath.lastIndexOf(separator)) || filePath;
  await allowMediaDir(dir);
  const assetUrl = convertFileSrc(filePath);
  const frame = mountFrame(host, assetImageFixture(assetUrl));
  const doc = await waitForFixture(frame);
  await sleep(1200);
  const img = doc.getElementById('asset-img') as HTMLImageElement | null;
  const loaded = (img?.naturalWidth ?? 0) > 0;

  return check(
    'render.asset-image',
    [16],
    'render',
    'A rewritten asset: image loads inside the frame',
    expect(loaded),
    `${filePath} → ${assetUrl}; naturalWidth ${img?.naturalWidth ?? 0}. allow_media_dir was granted for ${dir}.`,
  );
}

export async function run(hosts: Hosts): Promise<RunResult> {
  const markerRunsInParent = await runMarkerInParent();
  const parent = await captureParentCsp();

  const controls: Check[] = [
    check(
      'control.marker-in-parent',
      [14],
      'control',
      `${MARKER_SRC} executes when the parent document loads it`,
      expect(markerRunsInParent),
      markerRunsInParent
        ? `window.__mallowProbeMark = ${window.__mallowProbeMark ?? 0} in the app document`
        : 'the script did not run in the parent either — every sandbox verdict below is inconclusive until this passes',
    ),
    check(
      'control.csp-present',
      [15],
      'control',
      'A CSP is actually in force on this run',
      expect(parent.present),
      parent.present
        ? 'a blocked request in the app document reported a policy'
        : 'no securitypolicyviolation was reported for a blatantly blocked request. There is no CSP on this run — every CSP verdict below is inconclusive. `tauri dev` on desktop is always this state; rebuild with `tauri build`.',
    ),
  ];

  let contentDocumentReadable = true;
  const checks: Check[] = [...controls];
  let frameCsp: string | null = null;
  let compatMode: string | null = null;
  let scrollHeight: number | null = null;
  let scrollIntoViewMovedParent: boolean | null = null;
  let parentSideScrollWorks: boolean | null = null;
  let unstyled: FrameColors | null = null;
  let colorScheme: FrameColors | null = null;
  let prefersDarkInsideFrame: boolean | null = null;

  try {
    checks.push(...(await runScriptsFixture(hosts.scripts, parent.present, markerRunsInParent)));
  } catch (error) {
    contentDocumentReadable = false;
    checks.push(
      check(
        'premise.same-origin',
        [1, 6],
        'sandbox',
        'The frame stays same-origin with the parent under sandbox="allow-same-origin"',
        'fail',
        `${String(error)} — decision-3's first premise does not hold on this WebView.`,
      ),
    );
  }

  if (contentDocumentReadable) {
    const network = await runNetworkFixture(hosts.network, parent.present);
    frameCsp = network.frameCsp;
    checks.push(...network.checks);
    checks.push(
      check(
        'csp.inherited-policy-text',
        [2, 15],
        'csp',
        'The policy reported inside the frame is the app document’s own',
        !parent.present || !network.reportsViolations
          ? 'inconclusive'
          : expect(frameCsp !== null && frameCsp === parent.policy),
        !parent.present
          ? 'no CSP on this run'
          : network.reportsViolations
            ? `policy reported inside the frame: ${frameCsp ?? 'none reported'}. Identical to the app document's: ${String(frameCsp === parent.policy)}.`
            : 'this engine reports no violations inside the frame, so no policy text is available from there. Whether the policy is in force is answered by csp.inheritance-by-effect, not here.',
      ),
    );

    checks.push(...(await runFormFixture(hosts.form)));
    checks.push(...(await runMetaRefreshFixture(hosts.metaRefresh)));
    checks.push(...(await runPlainLinkFixture(hosts.plainLink)));

    const scroll = await runScrollFixture(hosts.tallScroller, hosts.tall);
    compatMode = scroll.compatMode;
    scrollHeight = scroll.scrollHeight;
    scrollIntoViewMovedParent = scroll.scrollIntoViewMovedParent;
    parentSideScrollWorks = scroll.parentSideScrollWorks;
    checks.push(...scroll.checks);

    const render = await runRenderFixtures(hosts.unstyled, hosts.colorScheme);
    unstyled = render.unstyled;
    colorScheme = render.colorScheme;
    prefersDarkInsideFrame = render.prefersDarkInsideFrame;
    checks.push(...render.checks);

    // Last, because a failure navigates this page away and would take every
    // result above with it.
    checks.push(...(await runTopNavFixture(hosts.topNav)));
  }

  return {
    checks,
    env: {
      origin: window.location.origin,
      href: window.location.href,
      userAgent: navigator.userAgent,
      parentCsp: parent.policy,
      frameCsp,
      cspPresent: parent.present,
      markerRunsInParent,
      contentDocumentReadable,
      compatMode,
      frameScrollHeight: scrollHeight,
      scrollIntoViewMovedParent,
      parentSideScrollWorks,
      prefersDarkInsideFrame,
      unstyled,
      colorScheme,
    },
  };
}
