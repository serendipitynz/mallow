/** Turns one probe run into the Markdown block that becomes TASK-7's comment.
 *
 *  The report is the deliverable, not the on-screen table: TASK-7 is recorded
 *  per platform, and the machine that runs it is not the machine that writes the
 *  task up. So everything a reader needs to judge the run — the effective CSP,
 *  the positive controls, the WebView version, and which layer each verdict is
 *  evidence for — has to survive a copy and paste. */

import type { Check, ClickCounts, Environment, LateLayout } from './harness';
import type { LinkCheck, LinkProbeState } from './link-checks';
import type { TransformCheck } from './transform-checks';

export interface Manual {
  platform: string;
  osVersion: string;
  webviewVersion: string;
  runMode: string;
  wheelChains: string;
  keyboardScrolls: string;
  unstyledCanvas: string;
  unstyledReadable: string;
  colorSchemeCanvas: string;
  colorSchemeReadable: string;
  notes: string;
}

/** TASK-23's hand-recorded answers, kept apart from `Manual` for the same reason
 *  its table is kept apart from TASK-7's: these are a different task's criteria,
 *  and a reader who cannot tell which task a field belongs to cannot use either.
 *
 *  There is one field per target per mode rather than one per case. A click on a
 *  link that navigates destroys the fixture, so the targets are clicked one at a
 *  time across several arms, and the raw answer is what makes the neutralized
 *  one mean anything: an `<area>` that does nothing when neutralized is only
 *  evidence if it did something when it was not. */
export interface LinkManual {
  rawFragmentClick: string;
  rawRelativeClick: string;
  rawAreaClick: string;
  rawMailtoClick: string;
  rawTelClick: string;
  rawKeyboard: string;
  neutralizedFragmentClick: string;
  neutralizedAreaClick: string;
  neutralizedKeyboard: string;
  notes: string;
}

/** Everything TASK-23's section puts in the report. One parameter rather than
 *  four, because the four are only readable together. */
export interface LinkSection {
  checks: LinkCheck[];
  raw: LinkProbeState | null;
  neutralized: LinkProbeState | null;
  manual: LinkManual;
}

const VERDICT_MARK: Record<Check['verdict'], string> = {
  pass: 'PASS',
  fail: 'FAIL',
  inconclusive: 'INCONCLUSIVE',
};

/** Best guess at the WebView version from the user agent, to be corrected by
 *  hand. WebView2 puts its runtime version in `Edg/…`; WKWebView and WebKitGTK
 *  both report the frozen `AppleWebKit/605.1.15`, so on Linux the real
 *  webkit2gtk version has to come from the package manager. */
export function guessWebViewVersion(userAgent: string): string {
  const edge = /Edg\/([\d.]+)/.exec(userAgent);
  if (edge !== null) {
    return `WebView2 ${edge[1]}`;
  }
  const version = /Version\/([\d.]+)/.exec(userAgent);
  const webkit = /AppleWebKit\/([\d.]+)/.exec(userAgent);
  if (version !== null) {
    return `WebKit ${version[1]} (AppleWebKit/${webkit?.[1] ?? '?'}) — confirm by hand`;
  }
  return webkit !== null ? `AppleWebKit/${webkit[1]} — frozen token, confirm by hand` : 'unknown';
}

function table(checks: Check[]): string {
  const rows = checks.map(
    (c) =>
      `| ${VERDICT_MARK[c.verdict]} | ${c.ac.map((n) => `#${n}`).join(', ')} | ${c.layer} | ${c.title} | ${c.detail.replace(/\|/g, '\\|')} |`,
  );
  return ['| verdict | AC | layer | check | observation |', '|---|---|---|---|---|', ...rows].join('\n');
}

function colorsBlock(label: string, colors: Environment['unstyled']): string {
  if (colors === null) {
    return `- ${label}: not measured`;
  }
  return [
    `- ${label}:`,
    `  - computed \`color-scheme\` on documentElement: \`${colors.documentElementColorScheme}\``,
    `  - computed body colour: \`${colors.bodyColor}\``,
    `  - computed body background: \`${colors.bodyBackground}\``,
    `  - computed html background: \`${colors.htmlBackground}\``,
  ].join('\n');
}

function clicksBlock(clicks: ClickCounts | null): string {
  if (clicks === null) {
    return '- real mouse click inside the frame: not run';
  }
  return [
    '- real mouse click inside the frame, counted per attachment point:',
    `  - listener on contentDocument, bubble phase: ${clicks.documentBubble}`,
    `  - listener on contentDocument, capture phase: ${clicks.documentCapture}`,
    `  - listener on contentWindow: ${clicks.windowBubble}`,
    `  - listener on the element itself: ${clicks.elementBubble}`,
    `  - mousedown on contentDocument: ${clicks.documentMousedown}`,
    `  - custom event dispatched by the parent into contentDocument: ${clicks.customEvent}`,
    `  - the frame navigated away despite preventDefault: ${clicks.navigatedAway}`,
  ].join('\n');
}

function lateLayoutBlock(late: LateLayout | null): string {
  if (late === null) {
    return '- late layout (height re-measurement for TASK-5.2): not run';
  }
  return [
    '- late layout, i.e. how the parent can learn the frame got taller:',
    `  - load event on the iframe ELEMENT (app document): ${late.iframeElementLoadFired}`,
    `  - height before / now: ${late.heightBefore}px / ${late.heightNow}px`,
    `  - the late image loaded: ${late.imageLoaded} (if false, nothing below had a change to report)`,
    `  - load listener on the <img> INSIDE the frame: ${late.imageLoadListenerFired}`,
    `  - ResizeObserver callbacks on the frame's documentElement: ${late.resizeObserverCalls} (1 is the initial one observe() always delivers; above 1 means it reported a real change)`,
    `  - MutationObserver callbacks on the frame's document: ${late.mutationObserverCalls}`,
    `  - polling saw the height change: ${late.pollSawChange}`,
    `  - <details> was opened by hand: ${late.detailsOpen}`,
  ].join('\n');
}

/** TASK-5.1's section, kept out of the table above because its `#N` are that
 *  task's acceptance criteria and not TASK-7's — one table carrying two
 *  numbering schemes is a record nobody can read back. */
function transformBlock(checks: TransformCheck[] | null): string {
  if (checks === null || checks.length === 0) {
    return ['### TASK-5.1 — markup transform on this engine', '', 'not run', ''].join('\n');
  }
  const rows = checks.map(
    (c) =>
      `| ${c.verdict === 'pass' ? 'PASS' : 'FAIL'} | ${c.ac.map((n) => `#${n}`).join(', ')} | ${c.title} | ${c.detail.replace(/\|/g, '\\|')} |`,
  );
  return [
    '### TASK-5.1 — markup transform on this engine',
    '',
    `AC numbers in this table are **TASK-5.1's**. ${checks.filter((c) => c.verdict === 'pass').length} pass / ${checks.filter((c) => c.verdict === 'fail').length} fail`,
    '',
    ['| verdict | AC | check | observation |', '|---|---|---|---|', ...rows].join('\n'),
    '',
  ].join('\n');
}

/** One armed mode's record: what the parent could still see of the frame, and
 *  what it heard. The readings are the evidence behind the hand-recorded answers
 *  and are printed in full — a click whose outcome was "nothing visible" is only
 *  worth having if the frame's location and the scroller's offset are there to
 *  say what "nothing" covered. */
function linkProbeBlock(label: string, state: LinkProbeState | null): string {
  if (state === null) {
    return `- ${label}: not armed`;
  }
  const clicks = Object.entries(state.clicksByTarget);
  const readings = state.readings.map(
    (r) =>
      `  - ${r.seq} (${r.at}): location \`${r.location}\`, still on the fixture: ${r.onFixture}, scroller scrollTop ${r.scrollTop}`,
  );
  return [
    `- ${label} — armed ${state.arms} time(s):`,
    `  - hrefs the app's own pass neutralized: ${state.neutralizedHrefs.length === 0 ? '(none)' : state.neutralizedHrefs.join(', ')}`,
    `  - hrefs still in the tab order afterwards: ${state.tabbableHrefs.length === 0 ? '(none)' : state.tabbableHrefs.join(', ')}`,
    `  - custom event dispatched by the parent into contentDocument: ${state.customEvent} (0 means this document runs no parent-registered listener at all, so the click counts below say nothing about whether a click arrived)`,
    `  - activation control (<details> opened by a parent-driven click): ${state.activation}`,
    `  - clicks heard, per target: ${clicks.length === 0 ? '(none heard)' : clicks.map(([id, n]) => `${id}=${n}`).join(', ')}`,
    `  - readings${state.truncated ? ` (capped — later changes were not recorded)` : ''}:`,
    ...readings,
  ].join('\n');
}

/** TASK-23's section. Apart from the tables above it for the same reason
 *  TASK-5.1's is: its `#N` are TASK-23's acceptance criteria. */
function linkBlock(link: LinkSection | null): string {
  if (link === null) {
    return ["### TASK-23 — decision-10's link cases on this engine", '', 'not run', ''].join('\n');
  }
  const rows = link.checks.map(
    (c) =>
      `| ${VERDICT_MARK[c.verdict]} | ${c.ac.map((n) => `#${n}`).join(', ')} | ${c.layer} | ${c.title} | ${c.detail.replace(/\|/g, '\\|')} |`,
  );
  const m = link.manual;
  return [
    "### TASK-23 — decision-10's link cases on this engine",
    '',
    `AC numbers in this section are **TASK-23's**.`,
    '',
    link.checks.length === 0
      ? 'automatic checks: not run'
      : ['| verdict | AC | layer | check | observation |', '|---|---|---|---|---|', ...rows].join('\n'),
    '',
    '#### Real clicks, measured',
    '',
    linkProbeBlock('raw (nothing neutralized)', link.raw),
    linkProbeBlock("neutralized (the app's own pass applied)", link.neutralized),
    '',
    '#### Real clicks, recorded by hand',
    '',
    `- AC #1 raw, \`#\` link clicked: ${m.rawFragmentClick || '(not recorded)'}`,
    `- AC #1 raw, relative link clicked: ${m.rawRelativeClick || '(not recorded)'}`,
    `- AC #3 raw, \`<area>\` region clicked: ${m.rawAreaClick || '(not recorded)'}`,
    `- AC #5 raw, \`mailto:\` clicked: ${m.rawMailtoClick || '(not recorded)'}`,
    `- AC #5 raw, \`tel:\` clicked: ${m.rawTelClick || '(not recorded)'}`,
    `- AC #2 raw, keyboard on the \`#\` link: ${m.rawKeyboard || '(not recorded)'}`,
    `- AC #3 neutralized, \`#\` link clicked (the control for the row below): ${m.neutralizedFragmentClick || '(not recorded)'}`,
    `- AC #3 neutralized, \`<area>\` region clicked: ${m.neutralizedAreaClick || '(not recorded)'}`,
    `- AC #2 neutralized, keyboard on the \`#\` link: ${m.neutralizedKeyboard || '(not recorded)'}`,
    '',
    '#### Notes',
    '',
    m.notes || '(none)',
    '',
  ].join('\n');
}

export function buildReport(
  env: Environment,
  checks: Check[],
  manual: Manual,
  clicks: ClickCounts | null,
  late: LateLayout | null,
  transformChecks: TransformCheck[] | null,
  link: LinkSection | null,
): string {
  const counts = {
    pass: checks.filter((c) => c.verdict === 'pass').length,
    fail: checks.filter((c) => c.verdict === 'fail').length,
    inconclusive: checks.filter((c) => c.verdict === 'inconclusive').length,
  };
  const valid = env.markerRunsInParent && env.cspPresent;

  return [
    `## TASK-7 — srcdoc sandbox / CSP observation: ${manual.platform || '(platform)'}`,
    '',
    valid
      ? '**Run validity: both positive controls passed.** The app-origin script runs in the parent, and a CSP is in force.'
      : `**Run validity: INVALID — do not read the verdicts below as observations.** marker script runs in parent: ${env.markerRunsInParent}; CSP in force: ${env.cspPresent}.`,
    '',
    '### Environment',
    '',
    `- platform: ${manual.platform || '(not recorded)'} ${manual.osVersion}`,
    `- WebView: ${manual.webviewVersion || guessWebViewVersion(env.userAgent)}`,
    `- run mode: ${manual.runMode || '(not recorded)'}`,
    `- app origin: \`${env.origin}\` (loaded from \`${env.href}\`)`,
    `- user agent: \`${env.userAgent}\``,
    `- effective CSP in the app document: \`${env.parentCsp ?? 'NONE REPORTED'}\``,
    `- effective CSP reported inside the frame: \`${env.frameCsp ?? 'none reported'}\``,
    `- frame document compatMode: ${env.compatMode ?? 'not measured'}`,
    `- measured frame scrollHeight: ${env.frameScrollHeight ?? 'not measured'}`,
    `- \`prefers-color-scheme: dark\` inside the frame: ${String(env.prefersDarkInsideFrame)}`,
    '',
    '### Automatic checks',
    '',
    `${counts.pass} pass / ${counts.fail} fail / ${counts.inconclusive} inconclusive`,
    '',
    table(checks),
    '',
    '### Rendering (recorded by eye, under a dark palette)',
    '',
    colorsBlock('unstyled document', env.unstyled),
    colorsBlock('color-scheme document', env.colorScheme),
    `- unstyled document canvas: ${manual.unstyledCanvas || '(not recorded)'} / text readable: ${manual.unstyledReadable || '(not recorded)'}`,
    `- color-scheme document canvas: ${manual.colorSchemeCanvas || '(not recorded)'} / text readable: ${manual.colorSchemeReadable || '(not recorded)'}`,
    '',
    '### Input, measured',
    '',
    `- \`scrollIntoView\` inside the frame moved the parent scroller: ${String(env.scrollIntoViewMovedParent)}`,
    `- parent-side rect conversion + \`scrollTop\` landed the target: ${String(env.parentSideScrollWorks)}`,
    clicksBlock(clicks),
    lateLayoutBlock(late),
    '',
    '### Input, recorded by hand',
    '',
    `- wheel scrolling chains from the frame to the parent scroller: ${manual.wheelChains || '(not recorded)'}`,
    `- keyboard scrolling reaches the parent scroller with focus inside the frame: ${manual.keyboardScrolls || '(not recorded)'}`,
    '',
    transformBlock(transformChecks),
    linkBlock(link),
    '### Notes',
    '',
    manual.notes || '(none)',
    '',
  ].join('\n');
}
