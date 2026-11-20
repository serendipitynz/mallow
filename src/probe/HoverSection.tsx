/** TASK-72's section of the probe screen. Self-contained — its own arm, log and
 *  report — because it needs none of the other sections' runs. See
 *  `hover-checks.ts` for what it measures and why. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { captureParentCsp } from './harness';
import { armHoverProbe, type HoverLogEntry, type HoverProbe } from './hover-checks';
import { buildHoverReport, guessWebViewVersion, type HoverEnvironment, type HoverManual } from './report';

const EMPTY_MANUAL: HoverManual = {
  platform: '',
  osVersion: '',
  webviewVersion: '',
  runMode: '',
  pointerSteps: '',
  keyboardSteps: '',
  notes: '',
};

export function HoverSection({ onError }: { onError: (message: string) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const probe = useRef<HoverProbe | null>(null);
  const armedAt = useRef(0);
  const [arming, setArming] = useState(false);
  const [freePoll, setFreePoll] = useState(true);
  const [env, setEnv] = useState<HoverEnvironment | null>(null);
  const [entries, setEntries] = useState<HoverLogEntry[]>([]);
  const [manual, setManual] = useState<HoverManual>(EMPTY_MANUAL);

  useEffect(() => () => probe.current?.dispose(), []);

  const onArm = useCallback(async () => {
    setArming(true);
    probe.current?.dispose();
    probe.current = null;
    setEntries([]);
    try {
      const csp = await captureParentCsp();
      armedAt.current = performance.now();
      const armed = await armHoverProbe(hostRef.current as HTMLElement, { freePoll }, (entry) => {
        const t = performance.now() - armedAt.current;
        setEntries((all) => [...all, { ...entry, t }]);
      });
      probe.current = armed;
      setEnv({
        userAgent: navigator.userAgent,
        cspPresent: csp.present,
        policy: csp.policy,
        listenersRun: armed.listenersRun,
        neutralized: armed.neutralized,
        freePoll,
      });
      setManual((m) =>
        m.webviewVersion === '' ? { ...m, webviewVersion: guessWebViewVersion(navigator.userAgent) } : m,
      );
    } catch (e) {
      onError(String(e));
    } finally {
      setArming(false);
    }
  }, [freePoll, onError]);

  const report = useMemo(() => (env === null ? '' : buildHoverReport(env, entries, manual)), [env, entries, manual]);

  const field = (key: keyof HoverManual, label: string) => (
    <label className="probe-field">
      <span>{label}</span>
      <input
        value={manual[key]}
        onChange={(e) => {
          setManual((m) => ({ ...m, [key]: e.target.value }));
        }}
      />
    </label>
  );

  return (
    <section className="probe-manual">
      <h2>TASK-72 — reading hover and focus inside the frame</h2>
      <p className="probe-note">
        Whether the parent can tell which link inside a frame that runs no parent listener is under the pointer or holds
        the focus. The frame is prepared as <code>HtmlView</code> prepares one: app-origin links are neutralized where
        no listener runs. Nothing here may be clicked.
      </p>
      <ol className="probe-note">
        <li>
          Press <strong>Arm</strong>.
        </li>
        <li>
          <strong>Pointer:</strong> move the pointer into the frame from above, then onto each link in turn from top to
          bottom, pausing about a second on each — on the text itself. Then move it out of the frame downwards, onto
          this page.
        </li>
        <li>
          <strong>Keyboard:</strong> press <strong>Focus start</strong>, then press Tab one key at a time until the
          focus has left the frame (the log stops changing), then Shift+Tab once, then click the page outside the frame.
        </li>
        <li>Fill in the fields and copy the report. One report per platform.</li>
      </ol>
      <div className="probe-controls">
        <button type="button" onClick={onArm} disabled={arming}>
          {arming ? 'arming…' : env === null ? 'Arm' : 'Re-arm (clears the log)'}
        </button>
        <label>
          <input
            type="checkbox"
            checked={freePoll}
            onChange={(e) => {
              setFreePoll(e.target.checked);
            }}
          />{' '}
          free-running poll (the control; leave on)
        </label>
        <button type="button">Focus start</button>
      </div>
      <div className="probe-host" ref={hostRef} />
      <pre className="probe-counters">
        {entries
          .slice(-12)
          .map((e) => `${Math.round(e.t)} ms  ${e.source}  ${e.what}`)
          .join('\n') || '(nothing logged yet)'}
      </pre>
      <div className="probe-grid">
        {field('platform', 'platform (macOS / Windows / Linux)')}
        {field('osVersion', 'OS version')}
        {field('webviewVersion', 'WebView version — see README for macOS and Linux')}
        {field('runMode', 'run mode (tauri build --debug / other)')}
        {field('pointerSteps', 'pointer: what you did, if not the steps above')}
        {field('keyboardSteps', 'keyboard: what you did, if not the steps above')}
      </div>
      <label className="probe-field probe-field--wide">
        <span>notes for this section</span>
        <textarea
          rows={4}
          value={manual.notes}
          onChange={(e) => {
            setManual((m) => ({ ...m, notes: e.target.value }));
          }}
        />
      </label>
      <div className="probe-report">
        <h3>TASK-72 report — paste this back</h3>
        <textarea readOnly rows={16} value={report} />
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(report).catch(() => {
              /* Clipboard access can be refused; the textarea is selectable. */
            });
          }}
          disabled={report === ''}
        >
          Copy the TASK-72 report
        </button>
      </div>
    </section>
  );
}
