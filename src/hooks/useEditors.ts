import { useEffect, useSyncExternalStore } from 'react';
import { detectEditors } from '../lib/tauri';
import type { EditorInfo } from '../lib/types';

const NONE: EditorInfo[] = [];
let editors: EditorInfo[] = NONE;
let detecting: Promise<void> | null = null;
let detected = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function detect(): void {
  if (detected || detecting) {
    return;
  }
  detecting = detectEditors()
    .then((list) => {
      editors = list;
      detected = true;
      for (const listener of listeners) {
        listener();
      }
    })
    .catch((e) => console.error('detectEditors failed', e))
    .finally(() => {
      detecting = null;
    });
}

/** The editors `detect_editors` found, asked once per window and held in one
 *  store, so the toolbar's Open menu and the explorer's context menu list the
 *  same answer rather than two that can disagree. A failed detection is retried
 *  by the next menu to mount, and every mounted menu takes the answer. */
export function useEditors(): EditorInfo[] {
  useEffect(detect, []);
  return useSyncExternalStore(subscribe, () => editors);
}
