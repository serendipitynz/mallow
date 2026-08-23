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
