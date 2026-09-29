import { type ReactNode, useId } from 'react';
import { type TFn, useT } from '../lib/i18n';
import { downloadPercent, formatBytes, type UpdateFlow } from '../lib/update-flow';
import { Modal } from './Modal';

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
  const reasonId = useId();

  if (flow.phase === 'none') {
    return null;
  }

  const title = dialogTitle(flow, t);

  return (
    <Modal
      title={title}
      onClose={onDismiss}
      dismissible={dismissable}
      closeReasonId={dismissable ? undefined : reasonId}
      refocusKey={flow.phase}
      actions={dialogActions(flow, t, onConfirm, onDismiss)}
    >
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
          <pre
            className="update__notes"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll box has to be a Tab stop so the keyboard can scroll it; WebKit gives it none of its own.
            tabIndex={0}
          >
            {flow.target.notes}
          </pre>
        </section>
      ) : null}

      {flow.phase === 'available' ? <p className="settings-group__hint">{t('updateAuthNotice')}</p> : null}

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

      {dismissable ? null : (
        <p id={reasonId} className="settings-group__hint">
          {t('updateCannotClose')}
        </p>
      )}

      {flow.phase === 'installed' ? <p className="settings-group__hint">{t('updateInstalledHint')}</p> : null}

      {flow.phase === 'failed' ? (
        <>
          <p className="settings-group__hint">{t('updateInstallFailedHint')}</p>
          <p className="update__detail">{flow.message}</p>
        </>
      ) : null}
    </Modal>
  );
}

/** Cancel before execute, so the execute button ends the row (snz-design
 *  doc-9 §6.6). The stages that cannot be closed have nothing to press. */
function dialogActions(flow: UpdateFlow, t: TFn, onConfirm: () => void, onDismiss: () => void): ReactNode {
  switch (flow.phase) {
    case 'available':
      return (
        <>
          <button type="button" className="btn" onClick={onDismiss}>
            {t('updateLater')}
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm}>
            {t('updateInstallNow')}
          </button>
        </>
      );
    case 'installed':
    case 'failed':
      return (
        <button type="button" className="btn" onClick={onDismiss}>
          {t('close')}
        </button>
      );
    default:
      return null;
  }
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
