/** Frontend side of the Rust filesystem watcher (watch.rs). */
import { invoke } from '@tauri-apps/api/core';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

/** Start watching a folder recursively (replaces this window's previous watch). */
export function startWatch(path: string): Promise<void> {
  return invoke('start_watch', { path });
}

/** Stop this window's watch. Other windows keep theirs. */
export function stopWatch(): Promise<void> {
  return invoke('stop_watch');
}

/**
 * Subscribe to this window's `fs:change` events (a list of changed paths).
 *
 * The window-scoped listener is half of per-window delivery, not a refinement of
 * it: a plain `listen()` registers `EventTarget::Any`, which matches whatever the
 * emitter filtered on, so it would receive every window's changes however
 * narrowly Rust emits. It is not a blanket rule — an event meant to reach every
 * window relies on exactly that behaviour of `Any`.
 */
export function onFsChange(callback: (paths: string[]) => void): Promise<UnlistenFn> {
  return getCurrentWebviewWindow().listen<string[]>('fs:change', (event) => callback(event.payload));
}
