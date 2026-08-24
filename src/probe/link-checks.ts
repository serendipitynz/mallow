/** TASK-23's app-origin link section: what decision-10's six unmeasured cases
 *  actually do on this engine.
 *
 *  decision-9 inferred that a `#` link inside the frame was inert, TASK-5.2's
 *  visual round found it navigates the frame to the app shell and blanks the
 *  view, and TASK-7's probe had nothing to say either way because it clicked
 *  external links only. These are the cases that would have caught it, plus the
 *  two TASK-5.3's review rounds added because a count had to stay silent where
 *  the answer differs by platform.
 *
 *  Each case is here rather than folded into one because each is closed by a
 *  different mechanism and can therefore fail on its own: a click by
 *  `pointer-events: none`, keyboard activation by `tabindex="-1"`, an `<area>`'s
 *  region by neither of those — it navigated on all three, which was TASK-25, and
 *  what closes it now is the `href` being removed before the branch
 *  (`neutralizeAppOriginAreas`) — a meta refresh by the sandboxed automatic
 *  features flag rather than by anything decision-10 put there, and the two
 *  external-protocol schemes by nothing at all.
 *
 *  This section stands apart from the TASK-7 run above it for the same reason
 *  TASK-5.1's does: its `#N` are TASK-23's acceptance criteria, and one table
 *  carrying two numbering schemes is a record nobody can read back.
 *
 *  The frame plumbing is imported from `harness` rather than copied. A second
 *  copy would drift on exactly the details that make a reading trustworthy —
 *  `stillOnFixture`'s null handling is the difference between "the document is
 *  gone" and "nothing navigated". */

import { navigatesAppOrigin, neutralizeAppOriginAreas, neutralizeAppOriginLinks } from '../lib/html-doc';
import {
  APP_ORIGIN_TARGET,
  appOriginLinkFixture,
  DATA_IMAGE,
  DATA_STYLESHEET,
  metaRefreshAppOriginFixture,
  PROTOCOL_RELATIVE_IMAGE,
  protocolRelativeFixture,
} from './fixtures';
import {
  collectViolations,
  describeViolation,
  measureActivation,
  mountFrame,
  sleep,
  stillOnFixture,
  type Verdict,
  violationFor,
  waitForFixture,
} from './harness';

/** `neither` is the outcome the TASK-7 table has no word for and this section
 *  needs one for: a navigation that happened, which means no layer stopped it. */
export type LinkLayer = 'sandbox' | 'csp' | 'parent' | 'neither' | 'control';

export interface LinkCheck {
  id: string;
  /** TASK-23 acceptance criteria this check is evidence for. */
  ac: number[];
  layer: LinkLayer;
  title: string;
  verdict: Verdict;
  detail: string;
}

const VIOLATION_WAIT_MS = 2000;
const REFRESH_WAIT_MS = 3000;

/** Beyond this the readings stop being appended and the state says so. A reading
 *  is only recorded on a change, so reaching the cap means the frame or the
 *  scroller kept moving — worth saying rather than letting the list grow without
 *  bound behind a probe that stays armed. */
const MAX_READINGS = 60;

function linkCheck(
  id: string,
  ac: number[],
  layer: LinkLayer,
  title: string,
  verdict: Verdict,
  detail: string,
): LinkCheck {
  return { id, ac, layer, title, verdict, detail };
}

function expect(condition: boolean): Verdict {
  return condition ? 'pass' : 'fail';
}

/** Where the frame is now. A navigation to the app's own origin stays readable,
 *  which is the point — the destination is what names the failure decision-10
 *  describes, and "the fixture is gone" alone does not. */
function frameLocation(frame: HTMLIFrameElement): string {
  try {
    return frame.contentDocument?.location?.href ?? '(no document readable from the parent)';
  } catch {
    return '(reading location threw: the frame is no longer same-origin)';
  }
}

/** Whether the policy is in force inside the frame and whether this engine says
 *  so out loud. Both are needed before a missing violation means anything, and
 *  they fail differently: an uninherited policy is a TASK-7-level defect, a
 *  silent engine is a limit on what this section can conclude.
 *
 *  Measured here rather than taken from TASK-7's run so this section can be read
 *  on its own — the two nodes are injected from the parent because a `<link>` in
 *  the initial markup is fetched before any listener can exist. */
interface PolicyControl {
  inForce: 'inherited' | 'absent' | 'unknown';
  reportsViolations: boolean;
  note: string;
}

async function runAppOriginMetaRefresh(host: HTMLElement, cspPresent: boolean): Promise<LinkCheck> {
  const frame = mountFrame(host, metaRefreshAppOriginFixture());
  let doc: Document | null = null;
  try {
    doc = await waitForFixture(frame);
  } catch {
    // Not an error to report as one: the fixture being gone before the parent
    // could read it is the navigation this check is looking for, arriving faster
    // than the poll that watches for it.
  }
  const collector = doc === null ? null : collectViolations(doc);
  await sleep(REFRESH_WAIT_MS);
  collector?.stop();
  const survived = doc !== null && stillOnFixture(frame);
  const hit = collector === null ? undefined : violationFor(collector.events, APP_ORIGIN_TARGET);
  const layer: LinkLayer = survived ? (hit === undefined ? 'sandbox' : 'csp') : 'neither';

  return linkCheck(
    'nav.meta-refresh-app-origin',
    [4],
    layer,
    'A meta refresh aimed at the app’s own origin does not navigate the frame',
    expect(survived),
    [
      `fixture still loaded after ${REFRESH_WAIT_MS}ms: ${survived}; the frame is now at ${frameLocation(frame)}.`,
      doc === null ? 'The parent never got to read the fixture at all, which is itself the navigation.' : '',
      `CSP: ${cspPresent ? describeViolation(hit) : 'no CSP on this run, so the CSP layer was not measured'}.`,
      `frame-src is 'self', so it CARRIES this destination — unlike TASK-7's nav.meta-refresh, which aims at a host frame-src does not carry and can therefore be answered by the CSP. So the CSP cannot be what stops this one, and the sandbox is: a declarative refresh is one of the automatic features the sandboxed automatic features browsing context flag gates, and that flag stays set unless the sandbox carries allow-scripts, which this one deliberately does not (https://html.spec.whatwg.org/multipage/semantics.html#attr-meta-http-equiv-refresh). "allow-top-navigation is absent" is NOT the reason and would be the wrong one — a sandbox does not need that keyword to navigate ITSELF. A fail therefore means this engine performs a declarative refresh with the flag set, and a document can blank the rendered view with no interaction at all — which neutralizing links does not cover.`,
    ]
      .filter((part) => part !== '')
      .join(' '),
  );
}

async function runProtocolRelativeImage(host: HTMLElement, cspPresent: boolean): Promise<LinkCheck[]> {
  const frame = mountFrame(host, protocolRelativeFixture());
  const doc = await waitForFixture(frame);
  const collector = collectViolations(doc);

  const image = doc.createElement('img');
  image.src = PROTOCOL_RELATIVE_IMAGE;
  doc.body.appendChild(image);
  // The IDL attribute answers with the absolute URL the reference resolved to,
  // which is the per-platform reading this case is about. Read straight after
  // assignment, because a refused load does not change it. The node is created
  // through the FRAME's document so the resolution is against that document's
  // base URL — which for a `srcdoc` document happens to be the parent's, so a
  // node created in the parent would agree here by coincidence rather than for
  // a reason.
  const resolved = image.src;

  const dataSheet = doc.createElement('link');
  dataSheet.rel = 'stylesheet';
  dataSheet.href = DATA_STYLESHEET;
  doc.head.appendChild(dataSheet);

  const dataImage = doc.createElement('img');
  dataImage.src = DATA_IMAGE;
  doc.body.appendChild(dataImage);

  await sleep(VIOLATION_WAIT_MS);
  collector.stop();

  const target = doc.getElementById('csp-effect-target');
  const targetColor = target === null ? '' : (doc.defaultView ?? window).getComputedStyle(target).color;
  const dataSheetApplied = targetColor === 'rgb(255, 0, 0)';
  const dataImageLoaded = dataImage.naturalWidth > 0;
  const control: PolicyControl = {
    inForce: !dataImageLoaded ? 'unknown' : dataSheetApplied ? 'absent' : 'inherited',
    reportsViolations: collector.events.length > 0,
    note: `data: stylesheet applied: ${dataSheetApplied} (computed colour ${targetColor || 'unreadable'}; red means it applied and the policy is NOT in force, blue means it was refused); data: image control loaded: ${dataImageLoaded}; violations reported inside the frame: ${collector.events.length}`,
  };

  const hit = violationFor(collector.events, 'probe.invalid');
  const scheme = resolved.slice(0, resolved.indexOf(':') + 1).toLowerCase();
  // `img-src` is `'self' data: https: http: asset: http://asset.localhost`, and
  // the host is `probe.invalid` on every platform, so it is never `'self'`. The
  // scheme is therefore the whole prediction.
  const carried = scheme === 'http:' || scheme === 'https:';
  const measurable = cspPresent && control.inForce === 'inherited' && control.reportsViolations;

  return [
    linkCheck(
      'control.frame-policy-readable',
      [6],
      'control',
      'The policy is in force inside this frame AND this engine reports violations there',
      expect(control.inForce === 'inherited' && control.reportsViolations),
      `${control.note}. Without both, the silence of a refused reference is not evidence of anything: an uninherited policy would be a TASK-7-level defect, and a silent engine only limits what the check below can conclude.`,
    ),
    linkCheck(
      'csp.protocol-relative-image',
      [6],
      'csp',
      'A protocol-relative image reference resolves against the parent’s base URL, and img-src answers for the scheme that produces',
      measurable ? expect(carried ? hit === undefined : hit !== undefined) : 'inconclusive',
      [
        `\`${PROTOCOL_RELATIVE_IMAGE}\` resolved to \`${resolved}\`.`,
        `img-src carries that scheme: ${carried}, so the CSP is expected to ${carried ? 'let it through' : 'refuse it'}.`,
        `Observed: ${describeViolation(hit)}.`,
        `Load outcome (naturalWidth ${image.naturalWidth}) says nothing either way — probe.invalid cannot resolve on any platform, which is deliberate: only the resolved URL and the violation separate the two answers.`,
        measurable
          ? ''
          : `INCONCLUSIVE because ${!cspPresent ? 'there is no CSP on this run' : control.inForce !== 'inherited' ? 'the policy is not established as in force inside the frame' : 'this engine reports no violations inside a srcdoc frame'} — the resolved URL above is still this platform's answer, and it is the half refTally would have to be keyed on.`,
        `refTally counts this reference as nothing rather than being wrong on a platform; a broken image announces itself, so nothing is silently unexplained.`,
      ]
        .filter((part) => part !== '')
        .join(' '),
    ),
  ];
}

/** The two cases that need no interaction. Kept apart from the armed probe below
 *  because a run that measures them costs nothing and a run that clicks costs a
 *  person's attention. */
export async function runLinkChecks(
  metaRefreshHost: HTMLElement,
  protocolRelativeHost: HTMLElement,
  cspPresent: boolean,
): Promise<LinkCheck[]> {
  const checks = await runProtocolRelativeImage(protocolRelativeHost, cspPresent);
  // Last, because it is the one that can replace its own document, and a frame
  // left on the app shell is confusing to look at beside the ones that did not.
  checks.push(await runAppOriginMetaRefresh(metaRefreshHost, cspPresent));
  return checks;
}

/** Which of the two states the fixture is armed in. `raw` is what a document
 *  does on its own — decision-10's premise, measured on one engine so far.
 *  `neutralized` applies the app's own pass, so what it measures is the shipped
 *  mechanism rather than a description of it. */
export type LinkProbeMode = 'raw' | 'neutralized';

/** What one arm is for: which element, reached by which input.
 *
 *  **The arm carries it, rather than a field filled in afterwards.** The first
 *  round left every hand-recorded field blank and the record could then answer
 *  nothing about the `<area>`, the keyboard or the two external-protocol schemes
 *  — an arm in which nothing navigated and an arm in which nothing was clicked
 *  are the same readings. Where the engine runs no parent-registered listener
 *  (WebKit, decision-9) the click counters are zero by construction, so nothing
 *  else can break that tie: naming the attempt before the click is the only
 *  attribution that survives on every engine. */
export const LINK_ATTEMPTS = [
  'fragment-click',
  'relative-click',
  'area-click',
  'mailto-click',
  'tel-click',
  'fragment-keyboard',
] as const;

export type LinkAttempt = (typeof LINK_ATTEMPTS)[number];

/** Shared by the screen and the report so the operator's instruction and the
 *  record use one wording. */
export const LINK_ATTEMPT_LABEL: Record<LinkAttempt, string> = {
  'fragment-click': 'click the # link',
  'relative-click': 'click the relative link',
  'area-click': 'click inside the image map',
  'mailto-click': 'click the mailto: link',
  'tel-click': 'click the tel: link',
  'fragment-keyboard': 'Tab to the # link, then press Enter',
};

export interface FrameReading {
  seq: number;
  at: 'armed' | 'changed';
  attempt: LinkAttempt;
  location: string;
  onFixture: boolean;
  scrollTop: number;
}

/** Which attempts each mode needs before its half of the record is complete.
 *
 *  They differ because the pass only touches app-origin hrefs: `mailto:` and
 *  `tel:` are the same links in both modes, so arming them again measures the
 *  same thing twice. Stating the set is what lets the report say what is missing
 *  rather than only what is there — rounds 1 and 2 both ended with the
 *  neutralized half unarmed, and a record that only lists what was done reads as
 *  complete either way. */
export const EXPECTED_ATTEMPTS: Record<LinkProbeMode, readonly LinkAttempt[]> = {
  raw: LINK_ATTEMPTS,
  neutralized: ['fragment-click', 'relative-click', 'area-click', 'fragment-keyboard'],
};

export interface LinkProbeState {
  mode: LinkProbeMode;
  /** How many times this mode has been armed. A click that navigates destroys
   *  the fixture, so the attempts are worked through one arm at a time and the
   *  readings accumulate across them, each carrying the attempt it belongs to. */
  arms: number;
  /** One entry per arm, in order. Kept beside the readings rather than derived
   *  from them because the reading cap can drop an arm's marker, and a lost
   *  marker would report an attempt as never made. */
  armedAttempts: LinkAttempt[];
  neutralizedHrefs: string[];
  /** Hrefs still in the tab order after the mode was applied. In `neutralized`
   *  this is the stated expectation the keyboard reading is checked against. */
  tabbableHrefs: string[];
  /** Hrefs still on an `<area>` after the mode was applied — the fixture's one in
   *  `raw`, none in `neutralized` (TASK-25).
   *
   *  Read after the pass rather than inferred from it, because on the two WebKit
   *  engines nothing else in this record can say the pass acted: the click
   *  counters are 0 there by construction, so "the region navigated nothing"
   *  and "the region was never clicked" would otherwise rest on the declared
   *  attempt alone. */
  linkedAreaHrefs: string[];
  activation: boolean;
  customEvent: number;
  clicksByTarget: Record<string, number>;
  readings: FrameReading[];
  truncated: boolean;
}

/** Attempts this mode still owes, in the order the selector offers them. */
export function missingAttempts(mode: LinkProbeMode, state: LinkProbeState | null): LinkAttempt[] {
  const armed = new Set(state === null ? [] : state.armedAttempts);
  return EXPECTED_ATTEMPTS[mode].filter((attempt) => !armed.has(attempt));
}

export function emptyLinkProbeState(mode: LinkProbeMode): LinkProbeState {
  return {
    mode,
    arms: 0,
    armedAttempts: [],
    neutralizedHrefs: [],
    tabbableHrefs: [],
    linkedAreaHrefs: [],
    activation: false,
    customEvent: 0,
    clicksByTarget: {},
    readings: [],
    truncated: false,
  };
}

/** Mount the app-origin link fixture and watch it while a person clicks it.
 *
 *  Nothing here calls `preventDefault`, which is the difference between this and
 *  TASK-7's `armClickProbe`: that one measures whether a listener can stop a
 *  navigation, and this one measures what the click does when the branch under
 *  test is the branch where no listener runs. Suppressing the outcome would
 *  remove the observation.
 *
 *  The frame is sized to its content so the parent scroller is the only
 *  scroller, as the app ships it — that is what makes the scroller's `scrollTop`
 *  a reading rather than a coincidence.
 *
 *  `previous` carries the readings forward across re-arms of the same mode, so
 *  working through the attempts one at a time leaves one record instead of six,
 *  and `attempt` is what makes each stretch of that record attributable. */
export async function armLinkProbe(
  scroller: HTMLElement,
  host: HTMLElement,
  mode: LinkProbeMode,
  attempt: LinkAttempt,
  previous: LinkProbeState | null,
  onUpdate: (state: LinkProbeState) => void,
): Promise<() => void> {
  const state: LinkProbeState =
    previous === null || previous.mode !== mode
      ? emptyLinkProbeState(mode)
      : {
          ...previous,
          armedAttempts: [...previous.armedAttempts],
          readings: [...previous.readings],
          clicksByTarget: { ...previous.clicksByTarget },
        };
  state.arms += 1;
  state.armedAttempts.push(attempt);

  const frame = mountFrame(host, appOriginLinkFixture());
  const doc = await waitForFixture(frame);
  frame.style.height = `${doc.documentElement.scrollHeight}px`;
  await sleep(150);
  scroller.scrollTop = 0;

  state.activation = measureActivation(doc);

  const links = [...doc.querySelectorAll<HTMLElement>('a[href], area[href]')];
  const hrefOf = (link: HTMLElement): string => link.getAttribute('href') ?? '';
  if (mode === 'neutralized') {
    // The hrefs are collected before the pass rather than inferred from it: the
    // predicate is the app's, so what it selects is part of the measurement.
    state.neutralizedHrefs = links.map(hrefOf).filter(navigatesAppOrigin);
    // Both passes, because the app applies both to every document it renders —
    // the areas one ahead of the listener branch and this one inside it (TASK-25).
    // Applying only the first would measure a document the app never shows.
    neutralizeAppOriginAreas(doc);
    neutralizeAppOriginLinks(doc);
  } else {
    state.neutralizedHrefs = [];
  }
  state.tabbableHrefs = links.filter((link) => link.getAttribute('tabindex') !== '-1').map(hrefOf);
  // Re-queried rather than filtered out of `links`, since what is being read is
  // which elements still match `area[href]` at all.
  state.linkedAreaHrefs = [...doc.querySelectorAll<HTMLElement>('area[href]')].map(hrefOf);

  let last = '';
  const record = (at: FrameReading['at']): void => {
    const reading: FrameReading = {
      seq: state.readings.length,
      at,
      attempt,
      location: frameLocation(frame),
      onFixture: stillOnFixture(frame),
      scrollTop: Math.round(scroller.scrollTop),
    };
    const key = `${reading.location}|${reading.onFixture}|${reading.scrollTop}`;
    if (at === 'changed' && key === last) {
      return;
    }
    last = key;
    if (state.readings.length >= MAX_READINGS) {
      state.truncated = true;
      return;
    }
    state.readings.push(reading);
  };
  const publish = (at: FrameReading['at']): void => {
    record(at);
    onUpdate({
      ...state,
      armedAttempts: [...state.armedAttempts],
      readings: [...state.readings],
      clicksByTarget: { ...state.clicksByTarget },
    });
  };

  const onClick = (event: Event): void => {
    const from = (event.target as Element | null) ?? null;
    const link = from?.closest?.('a[href], area[href]') ?? null;
    // An `<area>` whose href the pass removed is no longer a link, so the click
    // lands on the `<img usemap>` beneath it. Keyed on links alone that reads as
    // `(not a link)` — the same entry a click that missed the map produces, which
    // is the tie TASK-23 spent a round learning to break. So a target with an id
    // is named even when it is not a link, and said to be one or the other.
    const identified = link ?? from?.closest?.('[id]') ?? null;
    let key: string;
    if (link !== null) {
      key = link.id || '(link with no id)';
    } else if (identified !== null) {
      key = `${identified.id} (not a link)`;
    } else {
      key = '(not a link)';
    }
    state.clicksByTarget[key] = (state.clicksByTarget[key] ?? 0) + 1;
    publish('changed');
  };
  // The positive control TASK-7 established the need for: a click that never
  // arrives and a document that runs no parent-registered listener at all read
  // alike from the counters, and only this separates them.
  const onPing = (): void => {
    state.customEvent += 1;
  };
  doc.addEventListener('click', onClick);
  doc.addEventListener('probe-ping', onPing);
  doc.dispatchEvent(new (doc.defaultView ?? window).Event('probe-ping'));

  publish('armed');
  const timer = window.setInterval(() => {
    publish('changed');
  }, 250);

  return () => {
    window.clearInterval(timer);
    doc.removeEventListener('click', onClick);
    doc.removeEventListener('probe-ping', onPing);
  };
}
