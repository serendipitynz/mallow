/** The TASK-7 probe screen.
 *
 *  Reachable only from the probe build (`MALLOW_PROBE=1`), which swaps this in
 *  for `App` as the window's whole content. It is deliberately not a view inside
 *  mallow: the measurement has to run against a built app, and a built app has
 *  no address bar to navigate to a hidden route with. */

import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { THEMES, type ThemeId } from '../lib/theme';
import { TOP_NAV_QUERY } from './fixtures';
import {
  armClickProbe,
  type Check,
  type ClickCounts,
  focusHeadingInFrame,
  type Hosts,
  type RunResult,
  run,
  runAssetImageCheck,
} from './harness';
import { buildReport, guessWebViewVersion, type Manual } from './report';
import './probe.scss';

const YES_NO = ['(not recorded)', 'yes', 'no', 'partly — see notes'];
const CANVAS = ['(not recorded)', 'white / light', 'dark / the app surface', 'something else — see notes'];

const EMPTY_MANUAL: Manual = {
  platform: '',
  osVersion: '',
  webviewVersion: '',
  runMode: '',
  wheelChains: YES_NO[0],
  keyboardScrolls: YES_NO[0],
  unstyledCanvas: CANVAS[0],
  unstyledReadable: YES_NO[0],
  colorSchemeCanvas: CANVAS[0],
  colorSchemeReadable: YES_NO[0],
  notes: '',
};

function Host({ hostRef }: { hostRef: RefObject<HTMLDivElement | null> }) {
  return <div className="probe-host" ref={hostRef} />;
}

function verdictClass(verdict: Check['verdict']): string {
  return `probe-verdict probe-verdict--${verdict}`;
}

export default function Probe() {
  const [theme, setThemeId] = useState<ThemeId>('dark');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [assetCheck, setAssetCheck] = useState<Check | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState<Manual>(EMPTY_MANUAL);
  const [clicks, setClicks] = useState<ClickCounts | null>(null);
  const [focusNote, setFocusNote] = useState<string>('');
  // Shown live beside the tall frame so the two hand-recorded scroll answers are
  // a reading rather than a judgement: "yes" is this number changing.
  const [scrollTop, setScrollTop] = useState(0);

  const scriptsRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const metaRefreshRef = useRef<HTMLDivElement>(null);
  const topNavRef = useRef<HTMLDivElement>(null);
  const plainLinkRef = useRef<HTMLDivElement>(null);
  const tallRef = useRef<HTMLDivElement>(null);
  const unstyledRef = useRef<HTMLDivElement>(null);
  const colorSchemeRef = useRef<HTMLDivElement>(null);
  const assetRef = useRef<HTMLDivElement>(null);
  const manualClickRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Applied straight to the attribute rather than through `setTheme`, which
  // would persist into the real app's localStorage — the probe shares its origin.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const topNavHappened = window.location.search.includes(TOP_NAV_QUERY);

  const onRun = useCallback(async () => {
    setRunning(true);
    setError(null);
    setAssetCheck(null);
    try {
      const hosts: Hosts = {
        scripts: scriptsRef.current as HTMLElement,
        network: networkRef.current as HTMLElement,
        form: formRef.current as HTMLElement,
        metaRefresh: metaRefreshRef.current as HTMLElement,
        topNav: topNavRef.current as HTMLElement,
        plainLink: plainLinkRef.current as HTMLElement,
        tallScroller: scrollerRef.current as HTMLElement,
        tall: tallRef.current as HTMLElement,
        unstyled: unstyledRef.current as HTMLElement,
        colorScheme: colorSchemeRef.current as HTMLElement,
      };
      setResult(await run(hosts));
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }, []);

  const onPickImage = useCallback(async () => {
    const picked = await openDialog({ directory: false, multiple: false });
    if (typeof picked !== 'string') {
      return;
    }
    try {
      setAssetCheck(await runAssetImageCheck(assetRef.current as HTMLElement, picked));
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const onArmClicks = useCallback(async () => {
    try {
      await armClickProbe(manualClickRef.current as HTMLElement, setClicks);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const checks = useMemo(
    () => (result === null ? [] : assetCheck === null ? result.checks : [...result.checks, assetCheck]),
    [result, assetCheck],
  );

  const report = useMemo(
    () => (result === null ? '' : buildReport(result.env, checks, manual, clicks)),
    [result, checks, manual, clicks],
  );

  useEffect(() => {
    if (result !== null && manual.webviewVersion === '') {
      setManual((m) => ({ ...m, webviewVersion: guessWebViewVersion(result.env.userAgent) }));
    }
  }, [result, manual.webviewVersion]);

  const field = (key: keyof Manual, label: string, options?: string[]) => (
    <div className="probe-field" key={key}>
      <label htmlFor={`probe-${key}`}>{label}</label>
      {options === undefined ? (
        <input
          id={`probe-${key}`}
          type="text"
          value={manual[key]}
          onChange={(e) => {
            setManual((m) => ({ ...m, [key]: e.target.value }));
          }}
        />
      ) : (
        <select
          id={`probe-${key}`}
          value={manual[key]}
          onChange={(e) => {
            setManual((m) => ({ ...m, [key]: e.target.value }));
          }}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  return (
    <div className="probe">
      <header className="probe-header">
        <h1>TASK-7 — srcdoc sandbox / CSP probe</h1>
        <div className="probe-controls">
          <label className="probe-field">
            <span>palette</span>
            <select
              value={theme}
              onChange={(e) => {
                setThemeId(e.target.value as ThemeId);
              }}
            >
              {THEMES.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={onRun} disabled={running}>
            {running ? 'running…' : 'Run all checks'}
          </button>
          <button type="button" onClick={onPickImage} disabled={result === null}>
            Pick a local image (asset: check)
          </button>
        </div>
      </header>

      {topNavHappened && (
        <p className="probe-banner probe-banner--fail">
          The app was navigated away by <code>target=&quot;_top&quot;</code> on a previous run: the sandbox did NOT
          contain top navigation on this platform. Record this and re-run.
        </p>
      )}

      {result !== null && !result.env.cspPresent && (
        <p className="probe-banner probe-banner--fail">
          No CSP is in force on this run, so the CSP layer was not measured and every sandbox-only check would pass
          regardless. This is what every <code>tauri dev</code> run on desktop looks like — build the probe and run the
          built binary.
        </p>
      )}

      {result !== null && !result.env.markerRunsInParent && (
        <p className="probe-banner probe-banner--fail">
          The app-origin probe script did not execute in the parent document either, so its absence inside the frame is
          not evidence of containment. Check that <code>/probe-marker.js</code> is being served.
        </p>
      )}

      {error !== null && <p className="probe-banner probe-banner--fail">{error}</p>}

      {result !== null && (
        <table className="probe-table">
          <thead>
            <tr>
              <th>verdict</th>
              <th>AC</th>
              <th>layer</th>
              <th>check</th>
              <th>observation</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.id}>
                <td>
                  <span className={verdictClass(c.verdict)}>{c.verdict}</span>
                </td>
                <td>{c.ac.map((n) => `#${n}`).join(', ')}</td>
                <td>{c.layer}</td>
                <td>{c.title}</td>
                <td className="probe-detail">{c.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section className="probe-frames">
        <h2>Fixtures</h2>
        <p className="probe-note">
          AC #12 asks two questions about the box below, and the readout is the answer to both — &quot;yes&quot; means
          that number changes, nothing else. <strong>Wheel:</strong> put the pointer inside the box and turn the wheel.
          <strong> Keyboard:</strong> press <em>Focus a heading inside the tall frame</em> further down (that is what
          puts focus inside the frame — clicking a heading does not), then press PageDown or ArrowDown without touching
          anything else.
        </p>
        <h3>
          Tall document — parent scroller scrollTop: <code>{scrollTop}</code>
        </h3>
        <div
          className="probe-scroller"
          ref={scrollerRef}
          onScroll={(e) => {
            setScrollTop(Math.round(e.currentTarget.scrollTop));
          }}
        >
          <Host hostRef={tallRef} />
        </div>
        <div className="probe-grid">
          <div>
            <h3>Unstyled document</h3>
            <Host hostRef={unstyledRef} />
          </div>
          <div>
            <h3>color-scheme: light dark, colour but no background</h3>
            <Host hostRef={colorSchemeRef} />
          </div>
          <div>
            <h3>Scripts</h3>
            <Host hostRef={scriptsRef} />
          </div>
          <div>
            <h3>Remote subresources</h3>
            <Host hostRef={networkRef} />
          </div>
          <div>
            <h3>Form</h3>
            <Host hostRef={formRef} />
          </div>
          <div>
            <h3>Meta refresh</h3>
            <Host hostRef={metaRefreshRef} />
          </div>
          <div>
            <h3>target=_top</h3>
            <Host hostRef={topNavRef} />
          </div>
          <div>
            <h3>Plain link</h3>
            <Host hostRef={plainLinkRef} />
          </div>
          <div>
            <h3>asset: image</h3>
            <Host hostRef={assetRef} />
          </div>
        </div>
      </section>

      <section className="probe-manual">
        <h2>Click the frame yourself</h2>
        <p className="probe-note">
          A synthetic click is not what decision-3&apos;s link interception has to survive — a user&apos;s click is, and
          the two are not delivered alike. Press <strong>Arm</strong>, then click the link and the button inside the
          frame with the mouse. The counters update live; every listener calls <code>preventDefault</code>, so the frame
          should stay put. If they all stay at 0 while the custom-event counter is 1, clicks specifically are not
          arriving; if the custom event is 0 too, this document runs no parent-registered listener at all.
        </p>
        <div className="probe-controls">
          <button type="button" onClick={onArmClicks}>
            Arm the click test
          </button>
          <button
            type="button"
            onClick={() => {
              setFocusNote(focusHeadingInFrame(tallRef.current as HTMLElement));
            }}
            disabled={result === null}
          >
            Focus a heading inside the tall frame
          </button>
        </div>
        {clicks !== null && (
          <ul className="probe-counters">
            <li>listener on contentDocument, bubble: {clicks.documentBubble}</li>
            <li>listener on contentDocument, capture: {clicks.documentCapture}</li>
            <li>listener on contentWindow: {clicks.windowBubble}</li>
            <li>listener on the element itself: {clicks.elementBubble}</li>
            <li>mousedown on contentDocument: {clicks.documentMousedown}</li>
            <li>custom event dispatched by the parent: {clicks.customEvent}</li>
            <li>frame navigated away despite preventDefault: {String(clicks.navigatedAway)}</li>
          </ul>
        )}
        {focusNote !== '' && <p className="probe-note">{focusNote}</p>}
        <Host hostRef={manualClickRef} />
      </section>

      <section className="probe-manual">
        <h2>Recorded by hand</h2>
        <div className="probe-grid">
          {field('platform', 'platform (macOS / Windows / Linux)')}
          {field('osVersion', 'OS version')}
          {field('webviewVersion', 'WebView version (AC #9)')}
          {field('runMode', 'run mode (tauri build / tauri build --debug / other)')}
          {field('wheelChains', 'AC #12 wheel: scrollTop changed while the wheel turned over the frame', YES_NO)}
          {field('keyboardScrolls', 'AC #12 keyboard: scrollTop changed on PageDown after the focus button', YES_NO)}
          {field('unstyledCanvas', 'unstyled document canvas colour (AC #11)', CANVAS)}
          {field('unstyledReadable', 'unstyled document text readable (AC #11)', YES_NO)}
          {field('colorSchemeCanvas', 'color-scheme document canvas colour (AC #11)', CANVAS)}
          {field('colorSchemeReadable', 'color-scheme document text readable (AC #11)', YES_NO)}
        </div>
        <label className="probe-field probe-field--wide">
          <span>notes</span>
          <textarea
            rows={4}
            value={manual.notes}
            onChange={(e) => {
              setManual((m) => ({ ...m, notes: e.target.value }));
            }}
          />
        </label>
      </section>

      <section className="probe-report">
        <h2>Report — paste this back</h2>
        <textarea readOnly rows={20} value={report} />
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(report).catch(() => {
              /* Clipboard access can be refused; the textarea is selectable. */
            });
          }}
          disabled={report === ''}
        >
          Copy report
        </button>
      </section>
    </div>
  );
}
