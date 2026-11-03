/** Turns one probe run into the Markdown block that becomes TASK-7's comment.
 *
 *  The report is the deliverable, not the on-screen table: TASK-7 is recorded
 *  per platform, and the machine that runs it is not the machine that writes the
 *  task up. So everything a reader needs to judge the run — the effective CSP,
 *  the positive controls, the WebView version, and which layer each verdict is
 *  evidence for — has to survive a copy and paste. */

import type { Check, ClickCounts, Environment, LateLayout } from './harness';
import type { HighlightReading, HighlightRun } from './highlight-checks';
import {
  EXPECTED_ATTEMPTS,
  LINK_ATTEMPT_LABEL,
  type LinkCheck,
  type LinkProbeMode,
  type LinkProbeState,
  missingAttempts,
} from './link-checks';
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
 *  evidence if it did something when it was not — which is what TASK-23 measured
 *  and TASK-25 then removed. */
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
function linkProbeBlock(mode: LinkProbeMode, label: string, state: LinkProbeState | null): string {
  const missing = missingAttempts(mode, state);
  const coverage =
    missing.length === 0
      ? `all ${EXPECTED_ATTEMPTS[mode].length} attempts armed`
      : `**NOT ARMED: ${missing.join(', ')}** — ${EXPECTED_ATTEMPTS[mode].length - missing.length} of ${EXPECTED_ATTEMPTS[mode].length} attempts covered, so this half answers nothing about the rest`;
  if (state === null) {
    return `- ${label}: not armed at all (${coverage})`;
  }
  const clicks = Object.entries(state.clicksByTarget);
  const readings = state.readings.map(
    (r) =>
      `  - ${r.seq} (${r.at}, ${r.attempt}): location \`${r.location}\`, still on the fixture: ${r.onFixture}, scroller scrollTop ${r.scrollTop}`,
  );
  return [
    `- ${label} — armed ${state.arms} time(s), ${coverage}:`,
    `  - app-origin hrefs on the fixture, read before this mode was applied: ${state.appOriginHrefs.length === 0 ? '(none)' : state.appOriginHrefs.join(', ')}`,
    `  - hrefs still in the tab order afterwards: ${state.tabbableHrefs.length === 0 ? '(none)' : state.tabbableHrefs.join(', ')}`,
    `  - hrefs still on an <area> afterwards: ${state.linkedAreaHrefs.length === 0 ? '(none — the region is no longer a link)' : state.linkedAreaHrefs.join(', ')}`,
    `  - custom event dispatched by the parent into contentDocument: ${state.customEvent} (0 means this document runs no parent-registered listener at all, so the click counts below say nothing about whether a click arrived)`,
    `  - activation control (<details> opened by a parent-driven click): ${state.activation}`,
    `  - clicks heard, per target: ${clicks.length === 0 ? '(none heard)' : clicks.map(([id, n]) => `${id}=${n}`).join(', ')}`,
    `  - readings${state.truncated ? ' (capped — later changes were not recorded)' : ''}, each naming the attempt its arm was for:`,
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
    linkProbeBlock('raw', 'raw (nothing neutralized)', link.raw),
    linkProbeBlock('neutralized', "neutralized (the app's own pass applied)", link.neutralized),
    '',
    '#### Real clicks, recorded by hand',
    '',
    `- AC #1 raw, ${LINK_ATTEMPT_LABEL['fragment-click']}: ${m.rawFragmentClick || '(not recorded)'}`,
    `- AC #1 raw, ${LINK_ATTEMPT_LABEL['relative-click']}: ${m.rawRelativeClick || '(not recorded)'}`,
    `- AC #3 raw, ${LINK_ATTEMPT_LABEL['area-click']}: ${m.rawAreaClick || '(not recorded)'}`,
    `- AC #5 raw, ${LINK_ATTEMPT_LABEL['mailto-click']}: ${m.rawMailtoClick || '(not recorded)'}`,
    `- AC #5 raw, ${LINK_ATTEMPT_LABEL['tel-click']}: ${m.rawTelClick || '(not recorded)'}`,
    `- AC #2 raw, ${LINK_ATTEMPT_LABEL['fragment-keyboard']}: ${m.rawKeyboard || '(not recorded)'}`,
    `- AC #3 neutralized, ${LINK_ATTEMPT_LABEL['fragment-click']} (the control for the row below): ${m.neutralizedFragmentClick || '(not recorded)'}`,
    `- AC #3 neutralized, ${LINK_ATTEMPT_LABEL['area-click']}: ${m.neutralizedAreaClick || '(not recorded)'}`,
    `- AC #2 neutralized, ${LINK_ATTEMPT_LABEL['fragment-keyboard']}: ${m.neutralizedKeyboard || '(not recorded)'}`,
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

/** TASK-46's hand-recorded answers. The section is reported on its own rather
 *  than inside TASK-7's report: it needs none of that run, and making a fifteen
 *  second run that deliberately tries to navigate the app away a precondition of
 *  a highlight measurement would only cost rounds.
 *
 *  One paint field per location per case, because the three locations can fail
 *  independently and the parent's answer is the positive control for the other
 *  two: a frame that does not paint means something only where the parent did. */
export interface HighlightManual {
  platform: string;
  osVersion: string;
  webviewVersion: string;
  runMode: string;
  parentSingle: string;
  parentAcross: string;
  parentCurrent: string;
  frameRealmSingle: string;
  frameRealmAcross: string;
  frameRealmCurrent: string;
  parentRealmSingle: string;
  parentRealmAcross: string;
  parentRealmCurrent: string;
  ctrlF: string;
  screenshots: string;
  notes: string;
}

export interface HighlightEnvironment {
  userAgent: string;
  cspPresent: boolean;
  policy: string | null;
}

function highlightReadingLine(r: HighlightReading): string {
  const m = r.mutations;
  const parts = [
    `CSS.highlights: ${r.registryPresent}`,
    `Highlight: ${r.constructorPresent}`,
    `CSS.supports(selector(::highlight())): ${r.selectorSupported ?? 'CSS.supports missing'}`,
    `rule survived parsing: ${r.ruleParsed}`,
    `registered at the end: ${r.registered}`,
    `registry size: ${r.registrySize ?? '-'}`,
  ];
  if (m !== null) {
    parts.push(`mutation records during / control: ${m.during} / ${m.control}`);
  }
  if (r.error !== null) {
    parts.push(`error: \`${r.error}\``);
  }
  return `- **${r.where}** — ${parts.join(', ')}`;
}

export function buildHighlightReport(
  env: HighlightEnvironment,
  run: HighlightRun | null,
  manual: HighlightManual,
): string {
  const rows =
    run === null
      ? ['not run']
      : [
          '| verdict | AC | check | observation |',
          '|---|---|---|---|',
          ...run.checks.map(
            (c) =>
              `| ${VERDICT_MARK[c.verdict]} | ${c.ac.map((n) => `#${n}`).join(', ')} | ${c.title} | ${c.detail.replace(/\|/g, '\\|')} |`,
          ),
        ];
  const paint = (label: string, value: string) => `- ${label}: ${value || '(not recorded)'}`;
  return [
    `## TASK-46 — CSS Custom Highlight API: ${manual.platform || '(platform)'}`,
    '',
    `AC numbers in this report are **TASK-46's**.`,
    '',
    env.cspPresent
      ? '**A CSP is in force on this run**, so it is a built app rather than `tauri dev`.'
      : '**No CSP is in force on this run** — this is what `tauri dev` looks like. The frame was not measured as it ships; rebuild with `MALLOW_PROBE=1 pnpm tauri build --debug --no-bundle`.',
    '',
    '### Environment (AC #1)',
    '',
    `- platform: ${manual.platform || '(not recorded)'} ${manual.osVersion}`,
    `- WebView: ${manual.webviewVersion || guessWebViewVersion(env.userAgent)}`,
    `- run mode: ${manual.runMode || '(not recorded)'}`,
    `- user agent: \`${env.userAgent}\``,
    `- effective CSP in the app document: \`${env.policy ?? 'NONE REPORTED'}\``,
    '',
    '### Automatic checks',
    '',
    'These establish what can be read without looking. None of them says a highlight painted.',
    '',
    ...rows,
    '',
    ...(run === null ? [] : ['#### Readings', '', ...run.readings.map(highlightReadingLine), '']),
    '### Paint, recorded by eye against the screenshots (AC #2, #3, #4)',
    '',
    paint('AC #2 parent, one text node (the positive control)', manual.parentSingle),
    paint('AC #3 parent, across inline elements', manual.parentAcross),
    paint("parent, current match over the others (TASK-47's AC #3)", manual.parentCurrent),
    paint('AC #4 frame (frame-realm Highlight), one text node', manual.frameRealmSingle),
    paint('AC #3/#4 frame (frame-realm Highlight), across inline elements', manual.frameRealmAcross),
    paint('frame (frame-realm Highlight), current match over the others', manual.frameRealmCurrent),
    paint('AC #4 frame (parent-realm Highlight), one text node', manual.parentRealmSingle),
    paint('AC #3/#4 frame (parent-realm Highlight), across inline elements', manual.parentRealmAcross),
    paint('frame (parent-realm Highlight), current match over the others', manual.parentRealmCurrent),
    `- screenshots: ${manual.screenshots || '(none named)'}`,
    '',
    '### Ctrl+F with nothing consuming it (AC #6, Windows)',
    '',
    `- ${manual.ctrlF || '(not recorded)'}`,
    '',
    '### Notes',
    '',
    manual.notes || '(none)',
    '',
  ].join('\n');
}
