import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { useCallback, useEffect, useRef, useState } from 'react';
import { advanceDownload, type CheckState, type UpdateFlow, updateNotes } from '../lib/update-flow';

/** Where an update check came from. A launch check is silent about everything
 *  except an available update: offline is the normal case at launch, and an
 *  error box for it is worse than never checking (AC #9). */
export type CheckTrigger = 'launch' | 'manual';

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

export function useUpdater(): Updater {
  const [runningVersion, setRunningVersion] = useState<string | null>(null);
  const [checkState, setCheckState] = useState<CheckState>({ status: 'idle' });
  const [flow, setFlow] = useState<UpdateFlow>({ phase: 'none' });

  // The Rust-side handle the consent will act on, held between the check and the
  // confirmation. Closed on dismissal and on unmount so the resource is not
  // leaked when the user says no.
  const pending = useRef<Update | null>(null);
  // Guards both the check and the install: a second check while one is running
  // would replace the handle a confirmation is about to use.
  const inFlight = useRef(false);
  // The trigger of the check that is running, null when none is. A manual press
  // cannot start a second check, and a launch check reports none of its three
  // outcomes — so without promoting the trigger the press would be swallowed
  // whole, which is exactly what the manual path exists to answer. `check()`
  // sets no timeout of its own, so the window this covers is as long as the OS
  // connect timeout.
  const runningTrigger = useRef<CheckTrigger | null>(null);

  useEffect(() => {
    getVersion()
      .then(setRunningVersion)
      .catch((e) => console.error('Failed to read the app version', e));
  }, []);

  const releasePending = useCallback(() => {
    const update = pending.current;
    pending.current = null;
    void update?.close().catch((e) => console.error('Failed to close the update handle', e));
  }, []);

  // Close the handle if the window goes away with an offer still on screen.
  useEffect(() => releasePending, [releasePending]);

  const checkForUpdate = useCallback(
    (trigger: CheckTrigger) => {
      if (inFlight.current) {
        if (trigger === 'manual' && runningTrigger.current === 'launch') {
          runningTrigger.current = 'manual';
          setCheckState({ status: 'checking' });
        }
        return;
      }
      inFlight.current = true;
      runningTrigger.current = trigger;
      // An offer the user has not acted on is superseded by this check, whatever
      // it returns: the handle it was made with is about to be closed. Dropping
      // it here rather than in the branches below is what keeps `available` from
      // outliving the handle a confirmation would act on. A check cannot reach
      // this point while an install is running, since `inFlight` covers both.
      releasePending();
      setFlow({ phase: 'none' });
      if (trigger === 'manual') {
        setCheckState({ status: 'checking' });
      }
      void (async () => {
        try {
          const update = await check();
          // Read the trigger back rather than closing over it: a manual press
          // landing mid-check promotes it, and the outcome is then owed to the
          // screen.
          if (!update) {
            setCheckState(runningTrigger.current === 'manual' ? { status: 'upToDate' } : { status: 'idle' });
            return;
          }
          pending.current = update;
          // The dialog takes over reporting from here, so the manual path's
          // inline line goes back to saying nothing.
          setCheckState({ status: 'idle' });
          setFlow({ phase: 'available', target: { version: update.version, notes: updateNotes(update.body) } });
        } catch (e) {
          console.error('Update check failed', e);
          if (runningTrigger.current === 'manual') {
            setCheckState({ status: 'failed', message: String(e) });
          }
        } finally {
          inFlight.current = false;
          runningTrigger.current = null;
        }
      })();
    },
    [releasePending],
  );

  const confirmInstall = useCallback(() => {
    const update = pending.current;
    if (!update || inFlight.current) {
      return;
    }
    inFlight.current = true;
    const target = { version: update.version, notes: updateNotes(update.body) };
    setFlow({ phase: 'downloading', target, received: 0, total: null });
    void (async () => {
      try {
        await update.downloadAndInstall((event) => setFlow((current) => advanceDownload(current, event)));
      } catch (e) {
        // Any failure after consent is reported as the update not having been
        // installed. The plugin's errors serialize to a bare string, and its
        // variants do not line up with the causes anyway, so there is nothing to
        // branch on and matching on the text would break on a reword.
        console.error('Update install failed', e);
        setFlow({ phase: 'failed', target, message: String(e) });
        inFlight.current = false;
        return;
      }
      // Only reached where the process survives the install: on Windows the
      // installer takes over and this process is already gone.
      setFlow({ phase: 'relaunching', target });
      try {
        await relaunch();
      } catch (e) {
        // Outside the catch above on purpose: the update is in by now, so
        // reporting a failure to restart as a failure to install would be a lie
        // that invites a second install.
        console.error('Relaunch after install failed', e);
        setFlow({ phase: 'installed', target });
      } finally {
        inFlight.current = false;
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
