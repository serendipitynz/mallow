/**
 * The update flow's state, kept free of Tauri APIs so it stays unit-testable
 * under a Node environment (the same split as `lib/read-error`).
 *
 * Two states, not one, because the task's two "confirmations" are different
 * events: an **update check** asks `latest.json` whether a newer version is
 * listed and downloads nothing, while **install consent** is the user allowing
 * that version in after seeing its number. Either can fail without the other
 * happening, so `CheckState.failed` ("could not ask") and `UpdateFlow.failed`
 * ("did not get installed") are deliberately separate types.
 */
import type { DownloadEvent } from '@tauri-apps/plugin-updater';

/** What a manual update check has to report. The automatic one shows nothing:
 *  `checking` and `failed` never reach the screen on that path. */
export type CheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'upToDate' }
  | { status: 'failed'; message: string };

export interface UpdateTarget {
  version: string;
  /** `latest.json`'s `notes`, or null when it carries none — which is the case
   *  today, since `release.yml` passes no `releaseBody` to tauri-action. */
  notes: string | null;
}

/**
 * Everything from "a newer version is listed" onwards.
 *
 * `relaunching` is entered only where `downloadAndInstall` resolves. On Windows
 * the plugin hands the installer to the shell and the process exits during the
 * install, so the promise never resumes and this state is never reached — which
 * is why the phase is defined by the promise resolving rather than by a platform
 * check, and why `installing` has to be worded to hold on a machine that
 * disappears in it.
 */
export type UpdateFlow =
  | { phase: 'none' }
  | { phase: 'available'; target: UpdateTarget }
  | { phase: 'downloading'; target: UpdateTarget; received: number; total: number | null }
  | { phase: 'installing'; target: UpdateTarget }
  | { phase: 'relaunching'; target: UpdateTarget }
  /** Installed, but the app did not restart itself. Reachable only where
   *  `relaunch` rejects, which is why it is not a failure: reporting it as one
   *  would invite a second install of an update already in place. */
  | { phase: 'installed'; target: UpdateTarget }
  | { phase: 'failed'; target: UpdateTarget; message: string };

/** Where an update check came from. A launch check is silent about everything
 *  except an available update: offline is the normal case at launch, and an
 *  error box for it is worse than never checking (AC #9). */
export type CheckTrigger = 'launch' | 'manual';

/** What the updater is running. One value covers the check and the install
 *  together, because a check started during either would replace the handle a
 *  confirmation or the install is about to use. */
export type UpdaterActivity = { kind: 'idle' } | { kind: 'checking'; trigger: CheckTrigger } | { kind: 'installing' };

export const UPDATER_IDLE: UpdaterActivity = { kind: 'idle' };

export interface CheckRequest {
  /** Whether a check is started: never while one is running or an install is. */
  start: boolean;
  activity: UpdaterActivity;
  /** The check line to show, or null to leave it as it is. */
  check: CheckState | null;
  /** Whether the offer on screen goes, with the handle it was made with. */
  dropOffer: boolean;
}

/**
 * What asking for a check does.
 *
 * A manual press during a launch check promotes that check instead of starting a
 * second: a launch check reports none of its outcomes, so without promoting it
 * the press would be swallowed whole, which is exactly what the manual path
 * exists to answer. `check()` sets no timeout of its own, so the window this
 * covers is as long as the OS connect timeout.
 *
 * A check that starts drops an offer the reader has not acted on, whatever it
 * then returns: the handle that offer was made with is about to be closed, and
 * dropping it here rather than on the outcome is what keeps `available` from
 * outliving the handle a confirmation would act on.
 */
export function requestCheck(activity: UpdaterActivity, trigger: CheckTrigger): CheckRequest {
  if (activity.kind !== 'idle') {
    if (trigger === 'manual' && activity.kind === 'checking' && activity.trigger === 'launch') {
      return {
        start: false,
        activity: { kind: 'checking', trigger: 'manual' },
        check: { status: 'checking' },
        dropOffer: false,
      };
    }
    return { start: false, activity, check: null, dropOffer: false };
  }
  return {
    start: true,
    activity: { kind: 'checking', trigger },
    check: trigger === 'manual' ? { status: 'checking' } : null,
    dropOffer: true,
  };
}

export type CheckResult =
  | { kind: 'upToDate' }
  | { kind: 'available'; target: UpdateTarget }
  | { kind: 'failed'; message: string };

/** The check line and the flow to show, each null where it stays as it is. */
export interface CheckReport {
  check: CheckState | null;
  flow: UpdateFlow | null;
}

/** What a finished check reports. `activity` is read when the check finishes, not
 *  when it started, because a manual press landing mid-check promotes it and the
 *  outcome is then owed to the screen. An available update goes to the dialog,
 *  which takes over reporting, so the check line goes back to saying nothing. */
export function reportCheck(activity: UpdaterActivity, result: CheckResult): CheckReport {
  const manual = activity.kind === 'checking' && activity.trigger === 'manual';
  switch (result.kind) {
    case 'upToDate':
      return { check: manual ? { status: 'upToDate' } : { status: 'idle' }, flow: null };
    case 'available':
      return { check: { status: 'idle' }, flow: { phase: 'available', target: result.target } };
    case 'failed':
      return { check: manual ? { status: 'failed', message: result.message } : null, flow: null };
  }
}

/** Whether install consent starts the install: only with an offer's handle in
 *  hand, and never while a check or an install is running. */
export function canConfirmInstall(activity: UpdaterActivity, hasOffer: boolean): boolean {
  return hasOffer && activity.kind === 'idle';
}

export type InstallResult =
  | { kind: 'installFailed'; message: string }
  | { kind: 'installSucceeded' }
  | { kind: 'relaunchFailed' };

/**
 * The flow once the install has run.
 *
 * Any failure after consent is reported as the update not having been installed.
 * The plugin's errors serialize to a bare string, and its variants do not line
 * up with the causes anyway, so there is nothing to branch on and matching on
 * the text would break on a reword. A relaunch that fails is reported as
 * installed: the update is in by then, and reporting a failure to restart as a
 * failure to install would be a lie that invites a second install.
 */
export function reportInstall(target: UpdateTarget, result: InstallResult): UpdateFlow {
  switch (result.kind) {
    case 'installFailed':
      return { phase: 'failed', target, message: result.message };
    case 'installSucceeded':
      return { phase: 'relaunching', target };
    case 'relaunchFailed':
      return { phase: 'installed', target };
  }
}

/** A blank or whitespace-only `notes` is reported as absent rather than shown as
 *  an empty section: the dialog has to read correctly either way (AC #4). */
export function updateNotes(body: string | undefined): string | null {
  const trimmed = (body ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Fold one plugin download event into the flow.
 *
 * `Progress` carries `chunkLength`, the size of that chunk and not the running
 * total, so the total is accumulated here. `Finished` marks the end of the
 * transfer and not the end of the install — the installer, and any password
 * prompt it brings, runs after it — so it moves to `installing` rather than to
 * anything named for completion. An event arriving outside the download (a late
 * one after a failure) leaves the flow alone.
 */
export function advanceDownload(flow: UpdateFlow, event: DownloadEvent): UpdateFlow {
  if (flow.phase !== 'downloading') {
    return flow;
  }
  switch (event.event) {
    case 'Started':
      return { ...flow, received: 0, total: event.data.contentLength ?? null };
    case 'Progress':
      return { ...flow, received: flow.received + event.data.chunkLength };
    case 'Finished':
      return { phase: 'installing', target: flow.target };
  }
}

/** Whole percent for the progress readout, or null when the response carried no
 *  `Content-Length` and there is nothing to be a percentage of. Clamped because
 *  a server may send more than it announced. */
export function downloadPercent(received: number, total: number | null): number | null {
  if (total === null || total <= 0) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.round((received / total) * 100)));
}

const BYTE_UNITS = ['B', 'KiB', 'MiB', 'GiB'];

/** Byte count for the unknown-total case, where a percentage cannot be shown and
 *  the raw figure is the only sign the transfer is moving. */
export function formatBytes(bytes: number): string {
  const safe = Math.max(0, bytes);
  let value = safe;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${BYTE_UNITS[unit]}`;
}
