/** Entry point of the probe build. `vite.config.ts` points `index.html` here
 *  instead of `src/main.tsx` when `MALLOW_PROBE=1`, so the ordinary build is
 *  byte-identical to what it was and the probe never ships. */

import ReactDOM from 'react-dom/client';
import Probe from './Probe';
import '../styles/global.scss';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<Probe />);
