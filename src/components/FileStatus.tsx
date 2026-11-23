import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { countCharacters, runInSlices } from '../lib/char-count';
import { formatSize, formatTime, onFileStatusChange, readFileStatus } from '../lib/file-status';
import { useI18n } from '../lib/i18n';
import { shownLineCount } from '../lib/source-cap';

const sliceClock = {
  now: () => performance.now(),
  schedule: (task: () => void) => {
    setTimeout(task, 0);
  },
};

/** The character count of `text`, or `null` while it is still being counted —
 *  in slices, so a 10 MiB document does not hold the main thread (TASK-69). */
function useCharacterCount(text: string | null): number | null {
  const [counted, setCounted] = useState<{ text: string; count: number } | null>(null);
  useEffect(() => {
    if (text === null) {
      return;
    }
    return runInSlices(countCharacters(text), sliceClock, (count) => setCounted({ text, count }));
  }, [text]);
  return counted !== null && counted.text === text ? counted.count : null;
}

/** The status bar's facts about the open file (TASK-69). Ordered by what a reader
 *  looks for first, because a narrow bar cuts them from the end. */
export function FileStatus() {
  const { lang, t } = useI18n();
  const status = useSyncExternalStore(onFileStatusChange, readFileStatus);
  const text = status?.text ?? null;
  const lines = useMemo(() => (text === null ? null : shownLineCount(text)), [text]);
  const chars = useCharacterCount(text);

  if (status === null) {
    return <div className="file-status" />;
  }
  const number = new Intl.NumberFormat(lang);
  const items: string[] = [];
  const { info } = status;
  if (info !== null) {
    items.push(
      info.modified === null ? t('fileModifiedUnknown') : t('fileModified', { date: formatTime(info.modified, lang) }),
    );
    items.push(formatSize(info.size, lang));
  }
  if (lines !== null) {
    items.push(t(lines === 1 ? 'fileLinesOne' : 'fileLines', { n: number.format(lines) }));
    items.push(
      chars === null
        ? t('fileCharsCounting')
        : t(chars === 1 ? 'fileCharsOne' : 'fileChars', { n: number.format(chars) }),
    );
  }
  if (info !== null) {
    items.push(
      info.created === null ? t('fileCreatedUnknown') : t('fileCreated', { date: formatTime(info.created, lang) }),
    );
  }
  // The title carries the whole line for when the bar has cut it.
  return (
    <div className="file-status" title={items.join('  ')}>
      {items.map((item) => (
        <span key={item} className="file-status__item">
          {item}
        </span>
      ))}
    </div>
  );
}
