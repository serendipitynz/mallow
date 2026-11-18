import { describe, expect, it } from 'vitest';
import {
  advanceDownload,
  canConfirmInstall,
  downloadPercent,
  formatBytes,
  reportCheck,
  reportInstall,
  requestCheck,
  UPDATER_IDLE,
  type UpdateFlow,
  type UpdaterActivity,
  updateNotes,
} from './update-flow';

const target = { version: '0.7.0', notes: null };

function downloading(received: number, total: number | null): UpdateFlow {
  return { phase: 'downloading', target, received, total };
}

describe('updateNotes', () => {
  it('reports an absent notes field as null', () => {
    expect(updateNotes(undefined)).toBeNull();
  });

  it('reports the empty string latest.json carries today as null', () => {
    expect(updateNotes('')).toBeNull();
  });

  it('reports whitespace-only notes as null', () => {
    expect(updateNotes('  \n\t ')).toBeNull();
  });

  it('keeps notes that have content, trimmed', () => {
    expect(updateNotes('\n## Features\n- a\n')).toBe('## Features\n- a');
  });
});

describe('advanceDownload', () => {
  it('takes the content length from Started', () => {
    expect(advanceDownload(downloading(0, null), { event: 'Started', data: { contentLength: 4096 } })).toEqual(
      downloading(0, 4096),
    );
  });

  it('leaves the total unknown when Started carries no content length', () => {
    expect(advanceDownload(downloading(0, null), { event: 'Started', data: {} })).toEqual(downloading(0, null));
  });

  it('accumulates Progress chunks rather than replacing the running total', () => {
    let flow = downloading(0, 300);
    for (const chunkLength of [100, 100, 50]) {
      flow = advanceDownload(flow, { event: 'Progress', data: { chunkLength } });
    }
    expect(flow).toEqual(downloading(250, 300));
  });

  it('moves to installing on Finished, which is the end of the transfer', () => {
    expect(advanceDownload(downloading(300, 300), { event: 'Finished' })).toEqual({ phase: 'installing', target });
  });

  it('ignores an event that arrives outside the download', () => {
    const failed: UpdateFlow = { phase: 'failed', target, message: 'nope' };
    expect(advanceDownload(failed, { event: 'Progress', data: { chunkLength: 10 } })).toBe(failed);
  });
});

describe('downloadPercent', () => {
  it('has no answer when the total is unknown', () => {
    expect(downloadPercent(1024, null)).toBeNull();
  });

  it('has no answer for a zero total rather than dividing by it', () => {
    expect(downloadPercent(0, 0)).toBeNull();
  });

  it('rounds to whole percent', () => {
    expect(downloadPercent(1, 3)).toBe(33);
  });

  it('clamps a server that sends more than it announced', () => {
    expect(downloadPercent(200, 100)).toBe(100);
  });
});

describe('formatBytes', () => {
  it('shows bytes without a fraction', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('steps up a unit at 1024', () => {
    expect(formatBytes(1024)).toBe('1.0 KiB');
  });

  it('drops the fraction once three digits are in front of it', () => {
    expect(formatBytes(1024 * 1024 * 100)).toBe('100 MiB');
  });

  it('stops at the largest unit it knows', () => {
    expect(formatBytes(1024 ** 4)).toBe('1024 GiB');
  });

  it('reports a negative count as zero rather than as a negative size', () => {
    expect(formatBytes(-1)).toBe('0 B');
  });
});

const launchCheck: UpdaterActivity = { kind: 'checking', trigger: 'launch' };
const manualCheck: UpdaterActivity = { kind: 'checking', trigger: 'manual' };
const installing: UpdaterActivity = { kind: 'installing' };

describe('requestCheck', () => {
  it('starts a manual check when nothing is running, and shows it as checking', () => {
    expect(requestCheck(UPDATER_IDLE, 'manual')).toEqual({
      start: true,
      activity: manualCheck,
      check: { status: 'checking' },
      dropOffer: true,
    });
  });

  it('starts a launch check without showing anything', () => {
    expect(requestCheck(UPDATER_IDLE, 'launch')).toEqual({
      start: true,
      activity: launchCheck,
      check: null,
      dropOffer: true,
    });
  });

  it('promotes a running launch check on a manual press rather than starting a second', () => {
    expect(requestCheck(launchCheck, 'manual')).toEqual({
      start: false,
      activity: manualCheck,
      check: { status: 'checking' },
      dropOffer: false,
    });
  });

  it('starts nothing and changes nothing while a check or an install is running', () => {
    for (const [activity, trigger] of [
      [launchCheck, 'launch'],
      [manualCheck, 'manual'],
      [manualCheck, 'launch'],
      [installing, 'manual'],
      [installing, 'launch'],
    ] as const) {
      expect(requestCheck(activity, trigger)).toEqual({ start: false, activity, check: null, dropOffer: false });
    }
  });
});

describe('reportCheck', () => {
  it('reports up to date on a manual check, and goes quiet on a launch check', () => {
    expect(reportCheck(manualCheck, { kind: 'upToDate' })).toEqual({ check: { status: 'upToDate' }, flow: null });
    expect(reportCheck(launchCheck, { kind: 'upToDate' })).toEqual({ check: { status: 'idle' }, flow: null });
  });

  it('hands an available update to the dialog and clears the check line, whatever the trigger', () => {
    for (const activity of [manualCheck, launchCheck]) {
      expect(reportCheck(activity, { kind: 'available', target })).toEqual({
        check: { status: 'idle' },
        flow: { phase: 'available', target },
      });
    }
  });

  it('reports a failure on a manual check, and nothing on a launch check', () => {
    expect(reportCheck(manualCheck, { kind: 'failed', message: 'offline' })).toEqual({
      check: { status: 'failed', message: 'offline' },
      flow: null,
    });
    expect(reportCheck(launchCheck, { kind: 'failed', message: 'offline' })).toEqual({ check: null, flow: null });
  });

  it('reports a launch check promoted by a manual press as a manual one', () => {
    const promoted = requestCheck(launchCheck, 'manual').activity;
    expect(reportCheck(promoted, { kind: 'upToDate' }).check).toEqual({ status: 'upToDate' });
  });
});

describe('canConfirmInstall', () => {
  it('installs only with an offer in hand and nothing running', () => {
    expect(canConfirmInstall(UPDATER_IDLE, true)).toBe(true);
    expect(canConfirmInstall(UPDATER_IDLE, false)).toBe(false);
    expect(canConfirmInstall(launchCheck, true)).toBe(false);
    expect(canConfirmInstall(manualCheck, true)).toBe(false);
    expect(canConfirmInstall(installing, true)).toBe(false);
  });
});

describe('reportInstall', () => {
  it('reports any failure after consent as not installed', () => {
    expect(reportInstall(target, { kind: 'installFailed', message: 'bad signature' })).toEqual({
      phase: 'failed',
      target,
      message: 'bad signature',
    });
  });

  it('moves to relaunching once the install is in', () => {
    expect(reportInstall(target, { kind: 'installSucceeded' })).toEqual({ phase: 'relaunching', target });
  });

  it('reports a failed relaunch as installed, never as failed', () => {
    expect(reportInstall(target, { kind: 'relaunchFailed' })).toEqual({ phase: 'installed', target });
  });
});
