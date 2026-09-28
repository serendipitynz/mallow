import type { ReactNode } from 'react';
import { useT } from '../lib/i18n';
import { CircleXIcon } from './icons';

/** Only the failure level exists so far; the other three arrive with TASK-40.5,
 *  each with a figure of its own, since two of them share a colour and the figure
 *  is then the only thing telling them apart (snz-design doc-9 §6.4). */
export type NoticeLevel = 'failure';

interface NoticeProps {
  level: NoticeLevel;
  children: ReactNode;
}

/** A failure cannot be dismissed, so there is no close control: it goes when
 *  whatever placed it sees the situation resolved (snz-design doc-9 §6.4). */
export function Notice({ level, children }: NoticeProps) {
  const t = useT();
  return (
    <div className="notice" data-level={level} role="alert">
      <span className="notice__figure" role="img" aria-label={t(`noticeLevel.${level}`)}>
        <CircleXIcon />
      </span>
      <p className="notice__body">{children}</p>
    </div>
  );
}
