import type { ReactNode } from 'react';
import { LoaderCircleIcon } from './icons';

/** Work under way, told in words beside the turning figure: the figure alone
 *  reaches only a reader who can see it (snz-design doc-8 §6.7). */
export function Busy({ children }: { children: ReactNode }) {
  return (
    <span className="busy">
      <span className="busy__figure">
        <LoaderCircleIcon />
      </span>
      {children}
    </span>
  );
}
