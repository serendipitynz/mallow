import type { ReactNode } from 'react';
import { useT } from '../lib/i18n';
import { BanIcon, CircleXIcon, CloseIcon, InfoIcon, TriangleAlertIcon } from './icons';

/** Four levels, each with a figure of its own: warning and degraded share a
 *  colour, so the figure is the only thing telling them apart (snz-design
 *  doc-9 §6.4). */
export type NoticeLevel = 'failure' | 'warning' | 'degraded' | 'info';

const FIGURES: Record<NoticeLevel, () => ReactNode> = {
  failure: () => <CircleXIcon />,
  warning: () => <TriangleAlertIcon />,
  degraded: () => <BanIcon />,
  info: () => <InfoIcon />,
};

interface NoticeProps {
  level: NoticeLevel;
  children: ReactNode;
  /** The operation that resolves the situation, beside the words. */
  actions?: ReactNode;
  /** Only an information notice can be closed; the other three go when whatever
   *  placed them sees the situation resolved (snz-design doc-9 §6.4). */
  onDismiss?: () => void;
  className?: string;
}

export function Notice({ level, children, actions, onDismiss, className }: NoticeProps) {
  const t = useT();
  const dismiss = level === 'info' ? onDismiss : undefined;
  return (
    <div
      className={className ? `notice ${className}` : 'notice'}
      data-level={level}
      role={level === 'failure' ? 'alert' : 'status'}
    >
      <span className="notice__figure" role="img" aria-label={t(`noticeLevel.${level}`)}>
        {FIGURES[level]()}
      </span>
      <div className="notice__body">{children}</div>
      {actions && <div className="notice__actions">{actions}</div>}
      {dismiss && (
        <button
          type="button"
          className="icon-btn notice__close"
          title={t('dismiss')}
          aria-label={t('dismiss')}
          onClick={dismiss}
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}
