import { type ReactNode, type RefObject, useEffect, useId, useRef, useState } from 'react';
import { useT } from '../lib/i18n';
import { keyboardOwner, type ModalEntry } from '../lib/modal-stack';
import { CloseIcon } from './icons';

// The update dialog opens over the settings modal, and both listen on the
// document, so without this one Escape would close both and Tab would wrap
// inside the one underneath (snz-design doc-9 §5.2). Which one is on top is
// `covered`, not mount order — see `keyboardOwner`.
const openModals: ModalEntry[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  title: string;
  onClose: () => void;
  /** Whether Escape and a press on the overlay close it. */
  dismissible?: boolean;
  /** Set while the close control cannot close: it then stays, disabled, and
   *  is described by the element with this id, which states the reason
   *  (snz-design doc-9 §6.6, doc-8 §5.4). */
  closeReasonId?: string;
  /** True while another modal is painted over this one. */
  covered?: boolean;
  /** Where the focus goes back to when what held it on open is gone or was
   *  never a control: WebKit does not focus a button on a pointer press. */
  returnFocusTo?: RefObject<HTMLElement | null>;
  /** When this changes and the focus is no longer inside, it is put back on
   *  the surface — a stage change removes the button that held it. */
  refocusKey?: string;
  /** Cancel before execute, in document order: the visual order is never
   *  reversed in CSS, which would part Tab from what is seen. */
  actions?: ReactNode;
  children: ReactNode;
}

/** The modal shared by the settings and the update dialog: a fixed heading, a
 *  body that alone scrolls, and an action area that stays in view (snz-design
 *  doc-9 §6.6). It is mounted only while open, so what it reads on mount is what
 *  held the focus before it. */
export function Modal({
  title,
  onClose,
  dismissible = true,
  closeReasonId,
  covered = false,
  returnFocusTo,
  refocusKey,
  actions,
  children,
}: ModalProps) {
  const t = useT();
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  // Read while rendering, not in an effect: an autofocused child takes the focus
  // during commit, before any effect runs.
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  const latest = useRef({ onClose, dismissible });
  latest.current = { onClose, dismissible };
  const entry = useRef<ModalEntry>({ covered });
  entry.current.covered = covered;
  const returnTarget = useRef(returnFocusTo);
  returnTarget.current = returnFocusTo;

  useEffect(() => {
    const card = cardRef.current;
    if (!card) {
      return;
    }
    const token = entry.current;
    openModals.push(token);
    // A modal that mounts underneath another leaves the focus where it is.
    if (!token.covered && !card.contains(document.activeElement)) {
      // A work modal opens on its first input; with none to prefer the surface
      // takes the focus, and Tab goes on from there (snz-design doc-9 §6.6).
      (card.querySelector<HTMLElement>('[data-autofocus]') ?? card).focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (keyboardOwner(openModals) !== token) {
        return;
      }
      // A conversion in progress is cancelled by Escape, not the dialog.
      if (e.key === 'Escape' && !e.isComposing && e.keyCode !== 229) {
        if (latest.current.dismissible) {
          latest.current.onClose();
        }
        return;
      }
      if (e.key === 'Tab') {
        keepTabInside(e, card);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openModals.splice(openModals.indexOf(token), 1);
      const target = opener?.isConnected && opener !== document.body ? opener : returnTarget.current?.current;
      // Deferred until the card has left the DOM: the focus is not handed back
      // while this modal is still there to be closed.
      queueMicrotask(() => {
        if (!card.isConnected && target?.isConnected) {
          target.focus();
        }
      });
    };
  }, [opener]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the key is the trigger, not a value read
  useEffect(() => {
    const card = cardRef.current;
    if (card && !covered && !card.contains(document.activeElement)) {
      card.focus();
    }
  }, [refocusKey]);

  return (
    /* biome-ignore lint/a11y/noStaticElementInteractions: the overlay is a click-outside target,
       not a control. Closing is also reachable by Escape and by the close button, so the
       overlay is not the only path to it. */
    <div
      className="modal-overlay"
      role="presentation"
      inert={covered}
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div ref={cardRef} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="modal__header">
          <h2 id={titleId} className="modal__title">
            {title}
          </h2>
          <button
            type="button"
            className="icon-btn"
            title={t('close')}
            aria-label={t('close')}
            aria-disabled={closeReasonId ? true : undefined}
            aria-describedby={closeReasonId}
            onClick={closeReasonId ? undefined : onClose}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {actions ? <div className="modal__actions">{actions}</div> : null}
      </div>
    </div>
  );
}

/** The modal is not a scope the platform can be told to keep the focus in, and
 *  the page behind stays in the tab order, so Tab is wrapped by hand. Escape
 *  and the close control are the way out, so this is not a keyboard trap
 *  (snz-design doc-9 §5.3). */
function keepTabInside(e: KeyboardEvent, card: HTMLElement) {
  const focusable = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0,
  );
  if (focusable.length === 0) {
    e.preventDefault();
    card.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  const outside = !card.contains(active);
  if (e.shiftKey && (active === first || active === card || outside)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (active === last || outside)) {
    e.preventDefault();
    first.focus();
  }
}
