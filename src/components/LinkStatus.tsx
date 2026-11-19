import { useSyncExternalStore } from 'react';
import { useT } from '../lib/i18n';
import { onLinkStatusChange, readLinkStatus } from '../lib/link-status';

/** The status bar's link destination (TASK-68). Deliberately not a live region:
 *  it changes on every link the pointer crosses, and announcing each would be
 *  noise; the link itself is what a screen reader reads. */
export function LinkStatus() {
  const t = useT();
  const destination = useSyncExternalStore(onLinkStatusChange, readLinkStatus);

  if (destination === null) {
    return <div className="link-status" />;
  }
  return (
    <div className="link-status">
      {destination.text !== '' && (
        <span className="link-status__text">
          {destination.kind === 'fragment' ? t('linkMovesTo', { target: destination.text }) : destination.text}
        </span>
      )}
      {destination.kind === 'inert' && <span className="link-status__note">{t('linkDoesNotOpen')}</span>}
    </div>
  );
}
