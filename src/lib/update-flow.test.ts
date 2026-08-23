import { describe, expect, it } from 'vitest';
import { advanceDownload, downloadPercent, formatBytes, type UpdateFlow, updateNotes } from './update-flow';

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
