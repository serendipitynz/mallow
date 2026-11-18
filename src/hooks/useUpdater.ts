import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { useCallback, useEffect, useRef, useState } from 'react';
import { STORE } from '../lib/build-flags';
import {
  advanceDownload,
  type CheckReport,
  type CheckState,
  type CheckTrigger,
  canConfirmInstall,
  reportCheck,
  reportInstall,
  requestCheck,
  UPDATER_IDLE,
  type UpdateFlow,
  type UpdaterActivity,
  updateNotes,
} from '../lib/update-flow';

export interface Updater {
  /** The running version, for Settings — until now it was legible only in the
   *  macOS About dialog, so Windows and Linux had no way to confirm an update
   *  landed. Null only for the moment before `getVersion` resolves. */
  runningVersion: string | null;
  check: CheckState;
  flow: UpdateFlow;
  checkForUpdate: (trigger: CheckTrigger) => void;
  /** Install consent: the only path from `available` to a download. */
  confirmInstall: () => void;
  dismiss: () => void;
  resetCheck: () => void;
}

/** The GitHub Releases build's updater, or the Store build's stand-in. Chosen by
 *  a build-time constant, so the branch not taken — and `check` and `relaunch`
 *  with it — is not in the bundle at all. */
export const useUpdater: () => Updater = STORE ? useStoreUpdater : useReleaseUpdater;

function useRunningVersion(): string | null {
  const [runningVersion, setRunningVersion] = useState<string | null>(null);
  useEffect(() => {
    getVersion()
      .then(setRunningVersion)
      .catch((e) => console.error('Failed to read the app version', e));
  }, []);
  return runningVersion;
}

const NO_CHECK: CheckState = { status: 'idle' };
const NO_FLOW: UpdateFlow = { phase: 'none' };
const nothing = () => {};

/** The Store delivers updates to its package, so nothing here checks or
 *  installs; only the running version is still worth showing. */
function useStoreUpdater(): Updater {
  const runningVersion = useRunningVersion();
  return {
    runningVersion,
    check: NO_CHECK,
    flow: NO_FLOW,
    checkForUpdate: nothing,
    confirmInstall: nothing,
    dismiss: nothing,
    resetCheck: nothing,
  };
}

function useReleaseUpdater(): Updater {
  const runningVersion = useRunningVersion();
  const [checkState, setCheckState] = useState<CheckState>({ status: 'idle' });
  const [flow, setFlow] = useState<UpdateFlow>({ phase: 'none' });

  // The Rust-side handle the consent will act on, held between the check and the
  // confirmation. Closed on dismissal and on unmount so the resource is not
  // leaked when the user says no.
  const pending = useRef<Update | null>(null);
  const activity = useRef<UpdaterActivity>(UPDATER_IDLE);

  const releasePending = useCallback(() => {
    const update = pending.current;
    pending.current = null;
    void update?.close().catch((e) => console.error('Failed to close the update handle', e));
  }, []);

  // Close the handle if the window goes away with an offer still on screen.
  useEffect(() => releasePending, [releasePending]);

  const showReport = useCallback((report: CheckReport) => {
    if (report.check) {
      setCheckState(report.check);
    }
    if (report.flow) {
      setFlow(report.flow);
    }
  }, []);

  const checkForUpdate = useCallback(
    (trigger: CheckTrigger) => {
      const request = requestCheck(activity.current, trigger);
      activity.current = request.activity;
      if (request.dropOffer) {
        releasePending();
        setFlow({ phase: 'none' });
      }
      if (request.check) {
        setCheckState(request.check);
      }
      if (!request.start) {
        return;
      }
      void (async () => {
        try {
          const update = await check();
          pending.current = update;
          showReport(
            reportCheck(
              activity.current,
              update
                ? { kind: 'available', target: { version: update.version, notes: updateNotes(update.body) } }
                : { kind: 'upToDate' },
            ),
          );
        } catch (e) {
          console.error('Update check failed', e);
          showReport(reportCheck(activity.current, { kind: 'failed', message: String(e) }));
        } finally {
          activity.current = UPDATER_IDLE;
        }
      })();
    },
    [releasePending, showReport],
  );

  const confirmInstall = useCallback(() => {
    const update = pending.current;
    if (!canConfirmInstall(activity.current, update !== null) || !update) {
      return;
    }
    activity.current = { kind: 'installing' };
    const target = { version: update.version, notes: updateNotes(update.body) };
    setFlow({ phase: 'downloading', target, received: 0, total: null });
    void (async () => {
      try {
        await update.downloadAndInstall((event) => setFlow((current) => advanceDownload(current, event)));
      } catch (e) {
        console.error('Update install failed', e);
        setFlow(reportInstall(target, { kind: 'installFailed', message: String(e) }));
        activity.current = UPDATER_IDLE;
        return;
      }
      // Only reached where the process survives the install: on Windows the
      // installer takes over and this process is already gone.
      setFlow(reportInstall(target, { kind: 'installSucceeded' }));
      try {
        await relaunch();
      } catch (e) {
        console.error('Relaunch after install failed', e);
        setFlow(reportInstall(target, { kind: 'relaunchFailed' }));
      } finally {
        activity.current = UPDATER_IDLE;
      }
    })();
  }, []);

  const dismiss = useCallback(() => {
    releasePending();
    setFlow({ phase: 'none' });
  }, [releasePending]);

  const resetCheck = useCallback(() => setCheckState({ status: 'idle' }), []);

  return { runningVersion, check: checkState, flow, checkForUpdate, confirmInstall, dismiss, resetCheck };
}
