import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { menuKeyTarget } from '../lib/menu-nav';

export type OpenFocus = 'first' | 'last' | 'current';

const ITEM_SELECTOR = '[role^="menuitem"]';

/** What an open menu's body does, whatever opened it (snz-design doc-9 §6.11):
 *  the focus onto an item on open, arrows that wrap, Escape, Tab, and a press
 *  outside `insideRef` closing it. Items are found by role inside the body, so
 *  they take `tabIndex={-1}`: the body is one stop, moved through with the
 *  arrows. `close(true)` is where the focus goes back to what the menu was
 *  opened from; that is the caller's to know. */
export function useMenuBody({
  open,
  close,
  focusOnOpen,
  insideRef,
}: {
  open: boolean;
  close: (returnFocus: boolean) => void;
  focusOnOpen: RefObject<OpenFocus>;
  insideRef?: RefObject<HTMLElement | null>;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const popupId = useId();

  const items = useCallback(() => Array.from(popupRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []), []);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const list = items();
    if (list.length === 0) {
      popupRef.current?.focus();
      return;
    }
    let target = list[0];
    if (focusOnOpen.current === 'last') {
      target = list[list.length - 1];
    } else if (focusOnOpen.current === 'current') {
      target = list.find((el) => el.getAttribute('aria-checked') === 'true') ?? list[0];
    }
    target.focus();
  }, [open, items, focusOnOpen]);

  // A press outside does not pull the focus back: the pointer has already chosen
  // where it goes next.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onDown = (e: MouseEvent) => {
      const inside = insideRef?.current ?? popupRef.current;
      if (!inside?.contains(e.target as Node)) {
        close(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close, insideRef]);

  const onPopupKeyDown = (e: KeyboardEvent) => {
    if (e.nativeEvent.isComposing) {
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      // Only the innermost layer closes, so a dialog behind keeps its Escape.
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.key === 'Tab') {
      // Closed after the browser has moved the focus, not before: removing the
      // focused item first would leave Tab starting from nowhere. Tab moves on,
      // so the focus is not pulled back to the trigger.
      window.setTimeout(() => close(false), 0);
      return;
    }
    const list = items();
    const target = menuKeyTarget(e.key, list.indexOf(document.activeElement as HTMLElement), list.length);
    if (target !== null) {
      e.preventDefault();
      list[target].focus();
    }
  };

  return {
    popupId,
    popupProps: {
      ref: popupRef,
      id: popupId,
      tabIndex: -1,
      onKeyDown: onPopupKeyDown,
    },
  };
}

/** A menu opened from a trigger button — both toolbar menus.
 *
 *  `valueMenu` opens on the item marked `aria-checked`, which is where the
 *  reader's current value is. */
export function useMenu({ valueMenu = false, disabled = false } = {}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const focusOnOpen = useRef<OpenFocus>('first');

  const openMenu = useCallback((focus: OpenFocus) => {
    focusOnOpen.current = focus;
    setOpen(true);
  }, []);

  /** The focus goes back to the trigger itself rather than to whatever held it
   *  before opening: WebKit does not focus a button on a pointer press, so that
   *  would be some other control (snz-design doc-9 §6.11). */
  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  const { popupId, popupProps } = useMenuBody({ open, close, focusOnOpen, insideRef: rootRef });

  useEffect(() => {
    if (open && disabled) {
      close(false);
    }
  }, [open, disabled, close]);

  const onTriggerClick = () => {
    if (disabled) {
      return;
    }
    if (open) {
      close(true);
    } else {
      openMenu(valueMenu ? 'current' : 'first');
    }
  };

  const onTriggerKeyDown = (e: KeyboardEvent) => {
    if (disabled || open) {
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      openMenu(valueMenu ? 'current' : 'first');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu('last');
    }
  };

  return {
    open,
    close,
    rootRef,
    triggerProps: {
      ref: triggerRef,
      'aria-haspopup': 'menu' as const,
      'aria-expanded': open,
      'aria-controls': open ? popupId : undefined,
      onClick: onTriggerClick,
      onKeyDown: onTriggerKeyDown,
    },
    popupProps,
  };
}
