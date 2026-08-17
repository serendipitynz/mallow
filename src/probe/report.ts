/** Turns one probe run into the Markdown block that becomes TASK-7's comment.
 *
 *  The report is the deliverable, not the on-screen table: TASK-7 is recorded
 *  per platform, and the machine that runs it is not the machine that writes the
 *  task up. So everything a reader needs to judge the run — the effective CSP,
 *  the positive controls, the WebView version, and which layer each verdict is
 *  evidence for — has to survive a copy and paste. */

import type { Check, ClickCounts, Environment } from './harness';

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

export function buildReport(env: Environment, checks: Check[], manual: Manual, clicks: ClickCounts | null): string {
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
    '',
    '### Input, recorded by hand',
    '',
    `- wheel scrolling chains from the frame to the parent scroller: ${manual.wheelChains || '(not recorded)'}`,
    `- keyboard scrolling reaches the parent scroller with focus inside the frame: ${manual.keyboardScrolls || '(not recorded)'}`,
    '',
    '### Notes',
    '',
    manual.notes || '(none)',
    '',
  ].join('\n');
}
