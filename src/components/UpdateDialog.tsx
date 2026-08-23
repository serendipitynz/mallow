import { useEffect } from 'react';
import { type TFn, useT } from '../lib/i18n';
import { downloadPercent, formatBytes, type UpdateFlow } from '../lib/update-flow';
import { CloseIcon } from './icons';

interface UpdateDialogProps {
  flow: UpdateFlow;
  runningVersion: string | null;
  onConfirm: () => void;
  onDismiss: () => void;
}

/** Only the phases that are waiting on the user can be closed. Once the download
 *  has started the plugin offers no way to stop it, so a close control would
 *  leave the install running behind a dismissed dialog. */
function isDismissable(flow: UpdateFlow): boolean {
  return flow.phase === 'available' || flow.phase === 'failed' || flow.phase === 'installed';
}

function dialogTitle(flow: UpdateFlow, t: TFn): string {
  switch (flow.phase) {
    case 'failed':
      return t('updateInstallFailed');
    case 'installed':
      return t('updateInstalled');
    default:
      return t('updateAvailable');
  }
}

export function UpdateDialog({ flow, runningVersion, onConfirm, onDismiss }: UpdateDialogProps) {
  const t = useT();
  const dismissable = isDismissable(flow);

  useEffect(() => {
    if (!dismissable) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dismissable, onDismiss]);

  if (flow.phase === 'none') {
    return null;
  }

  const title = dialogTitle(flow, t);

  return (
    /* biome-ignore lint/a11y/noStaticElementInteractions: the overlay is a click-outside target,
       not a control — the same pattern as the settings modal, and closing is also reachable by
       Escape and by the close button whenever this dialog can be closed at all. */
    <div
      className="modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (dismissable && e.target === e.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
          {dismissable ? (
            <button type="button" className="icon-btn" title={t('close')} aria-label={t('close')} onClick={onDismiss}>
              <CloseIcon />
            </button>
          ) : null}
        </div>
        <div className="modal__body">
          <div className="update">
            <p className="update__version">{t('updateTargetVersion', { version: flow.target.version })}</p>
            {runningVersion ? (
              <p className="update__running">{t('updateRunningVersion', { version: runningVersion })}</p>
            ) : null}
          </div>

          {flow.target.notes ? (
            <section className="settings-group">
              <h3 className="settings-group__label">{t('updateNotesLabel')}</h3>
              {/* Shown as plain text rather than through the markdown pipeline: the
                  notes arrive over the network, and a release body is legible as
                  written without giving this dialog a second rendering path. */}
              <pre className="update__notes">{flow.target.notes}</pre>
            </section>
          ) : null}

          {flow.phase === 'available' ? (
            <>
              <p className="settings-group__hint">{t('updateAuthNotice')}</p>
              <div className="seg">
                <button type="button" className="btn is-active" onClick={onConfirm}>
                  {t('updateInstallNow')}
                </button>
                <button type="button" className="btn" onClick={onDismiss}>
                  {t('updateLater')}
                </button>
              </div>
            </>
          ) : null}

          {flow.phase === 'downloading' ? (
            <UpdateProgress
              label={t('updateDownloading')}
              readout={downloadReadout(flow.received, flow.total)}
              ariaLabel={t('updateProgress')}
              received={flow.received}
              total={flow.total}
            />
          ) : null}

          {/* The install itself reports nothing, and on Windows this process is
              gone before it ends — so the copy has to hold for a window that
              simply disappears here, and no "restarting" state is promised. */}
          {flow.phase === 'installing' ? (
            <UpdateProgress label={t('updateInstalling')} ariaLabel={t('updateProgress')} />
          ) : null}

          {flow.phase === 'relaunching' ? (
            <UpdateProgress label={t('updateRelaunching')} ariaLabel={t('updateProgress')} />
          ) : null}

          {flow.phase === 'installed' ? (
            <>
              <p className="settings-group__hint">{t('updateInstalledHint')}</p>
              <div className="seg">
                <button type="button" className="btn" onClick={onDismiss}>
                  {t('close')}
                </button>
              </div>
            </>
          ) : null}

          {flow.phase === 'failed' ? (
            <>
              <p className="settings-group__hint">{t('updateInstallFailedHint')}</p>
              <p className="update__detail">{flow.message}</p>
              <div className="seg">
                <button type="button" className="btn" onClick={onDismiss}>
                  {t('close')}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** A percentage when the response announced its length, and the raw byte count
 *  when it did not — with no length there is nothing to be a percentage of, and
 *  the figure is the only sign the transfer is moving. */
function downloadReadout(received: number, total: number | null): string {
  const percent = downloadPercent(received, total);
  return percent === null ? formatBytes(received) : `${percent}%`;
}

interface UpdateProgressProps {
  label: string;
  readout?: string;
  ariaLabel: string;
  /** Both together, or neither: with no announced length there is no extent, and
   *  the bar is rendered indeterminate. The install and the relaunch pass
   *  neither, since neither reports anything at all. */
  received?: number;
  total?: number | null;
}

function UpdateProgress({ label, readout, ariaLabel, received, total }: UpdateProgressProps) {
  const measurable = received !== undefined && total !== undefined && total !== null;
  return (
    <div className="update-progress">
      <div className="update-progress__row">
        <span className="update-progress__label">{label}</span>
        {readout ? <span className="update-progress__readout">{readout}</span> : null}
      </div>
      {/* Omitting `value` is what makes <progress> indeterminate. */}
      <progress
        className="update-progress__bar"
        aria-label={ariaLabel}
        max={measurable ? total : undefined}
        value={measurable ? received : undefined}
      />
    </div>
  );
}
