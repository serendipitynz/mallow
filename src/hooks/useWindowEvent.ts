import type { UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useEffect, useRef } from 'react';

/** Listen for `event` **on this window alone**, for the life of the component.
 *
 *  The window-scoped target is half of per-window delivery rather than a
 *  refinement of it, and the same pairing `lib/watch` establishes for
 *  `fs:change`: a plain `listen()` registers `EventTarget::Any`, which matches
 *  whatever the emitter filtered on (tauri-2.11.3
 *  `src/event/listener.rs:305-311`), so a menu event narrowed to the focused
 *  window in Rust would still reach every window here.
 *
 *  `handler` is held in a ref so a caller need not memoise one: registration is a
 *  round trip to Rust, and re-running it on every render would drop events in the
 *  gap between the unlisten and the next registration. */
export function useWindowEvent<T>(event: string, handler: (payload: T) => void): void {
  const current = useRef(handler);
  useEffect(() => {
    current.current = handler;
  }, [handler]);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let disposed = false;
    getCurrentWebviewWindow()
      .listen<T>(event, (received) => current.current(received.payload))
      .then((fn) => {
        if (disposed) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch((e) => console.error(`Failed to listen for ${event}`, e));
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [event]);
}
