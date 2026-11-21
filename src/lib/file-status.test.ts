import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatSize,
  formatTime,
  onFileStatusChange,
  readFileStatus,
  setFileInfo,
  setFileText,
  showFile,
} from './file-status';
import { shownLineCount } from './source-cap';

describe('formatSize', () => {
  it('gives bytes below 1 KiB', () => {
    expect(formatSize(0, 'en')).toBe('0 B');
    expect(formatSize(1023, 'en')).toBe('1,023 B');
  });

  it('gives 1024-based units to one decimal', () => {
    expect(formatSize(1024, 'en')).toBe('1.0 KiB');
    expect(formatSize(12_345, 'en')).toBe('12.1 KiB');
    expect(formatSize(10 * 1024 * 1024, 'en')).toBe('10.0 MiB');
    expect(formatSize(3 * 1024 ** 3, 'en')).toBe('3.0 GiB');
    expect(formatSize(2 * 1024 ** 4, 'en')).toBe('2.0 TiB');
  });

  it('stops at TiB rather than running out of units', () => {
    expect(formatSize(1024 ** 5, 'en')).toBe('1,024.0 TiB');
  });

  it('moves to the next unit where rounding would reach 1024', () => {
    expect(formatSize(1024 * 1024 - 1, 'en')).toBe('1.0 MiB');
    expect(formatSize(1024 * 1023, 'en')).toBe('1,023.0 KiB');
  });

  it('follows the UI language', () => {
    expect(formatSize(1023, 'ja')).toBe('1,023 B');
    expect(formatSize(1536, 'ja')).toBe('1.5 KiB');
  });
});

describe('formatTime', () => {
  it('reads to the minute in the UI language', () => {
    const at = new Date(2026, 10, 21, 14, 3, 59).getTime();
    expect(formatTime(at, 'ja')).toBe('2026/11/21 14:03');
    expect(formatTime(at, 'en')).toMatch(/^Nov 21, 2026, 2:03\sPM$/);
  });
});

describe('shownLineCount', () => {
  it('is the source view last line number: trailing breaks dropped, a CRLF one break', () => {
    expect(shownLineCount('')).toBe(1);
    expect(shownLineCount('a')).toBe(1);
    expect(shownLineCount('a\n')).toBe(1);
    expect(shownLineCount('a\n\n\n')).toBe(1);
    expect(shownLineCount('a\r\nb\r\n')).toBe(2);
    expect(shownLineCount('a\n\nb')).toBe(3);
  });
});

describe('the file status store', () => {
  afterEach(() => {
    showFile(null);
  });

  const info = { size: 10, modified: 1, created: null };

  it('starts a file with nothing known and fills it in', () => {
    showFile('/a.md');
    expect(readFileStatus()).toEqual({ path: '/a.md', info: null, text: null });
    setFileInfo('/a.md', info);
    setFileText('/a.md', 'hi');
    expect(readFileStatus()).toEqual({ path: '/a.md', info, text: 'hi' });
  });

  it('ignores what answers for a file no longer shown', () => {
    showFile('/a.md');
    showFile('/b.md');
    setFileInfo('/a.md', info);
    setFileText('/a.md', 'old');
    expect(readFileStatus()).toEqual({ path: '/b.md', info: null, text: null });
  });

  it('keeps what is known when the file shown is opened again, as a reload does', () => {
    showFile('/a.md');
    setFileInfo('/a.md', info);
    showFile('/a.md');
    expect(readFileStatus()?.info).toBe(info);
  });

  it('notifies on a change only', () => {
    const cb = vi.fn();
    const off = onFileStatusChange(cb);
    showFile('/a.md');
    showFile('/a.md');
    setFileInfo('/a.md', info);
    setFileInfo('/a.md', info);
    setFileText('/a.md', null);
    showFile(null);
    showFile(null);
    off();
    showFile('/b.md');
    expect(cb).toHaveBeenCalledTimes(3);
  });
});
