import { useEffect, useState } from 'react';
import { detectEditors } from '../lib/tauri';
import type { EditorInfo } from '../lib/types';

let detected: Promise<EditorInfo[]> | null = null;

/** The editors `detect_editors` found, asked once per window and shared, so the
 *  toolbar's Open menu and the explorer's context menu list the same answer
 *  rather than two that can disagree. A failed detection is not kept, so the
 *  next menu to mount asks again. */
export function useEditors(): EditorInfo[] {
  const [editors, setEditors] = useState<EditorInfo[]>([]);

  useEffect(() => {
    let live = true;
    detected ??= detectEditors().catch((e) => {
      console.error('detectEditors failed', e);
      detected = null;
      return [];
    });
    void detected.then((list) => {
      if (live) {
        setEditors(list);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  return editors;
}
