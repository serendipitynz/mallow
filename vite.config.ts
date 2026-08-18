import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
// @ts-expect-error process is a nodejs global
const probe = process.env.MALLOW_PROBE === '1';

// Served at the app origin so `script-src 'self'` permits it. TASK-7 uses it to
// measure the sandbox on its own: an inline script would be refused by the CSP
// even with the sandbox broken, so it cannot tell the two layers apart.
const PROBE_MARKER_JS = 'window.__mallowProbeMark = (window.__mallowProbeMark || 0) + 1;\n';

/** Swaps the window's contents for TASK-7's probe screen. Off by default: the
 *  measurement has to run against a built app, and a built app has no address
 *  bar to reach a hidden route with, so the probe takes the whole entry rather
 *  than living behind one. `index.html` is left untouched apart from the module
 *  it points at — its inline bootstrap script is what the CSP's `script-src`
 *  hash covers, so the probe build's effective CSP stays the app's own. */
function probeEntry(): Plugin {
  return {
    name: 'mallow-probe-entry',
    // `pre`, because Vite collects the entry modules out of index.html as part
    // of its own html transform: a default-order hook only sees the output HTML,
    // where the entry has already been rewritten to a hashed asset URL and the
    // swap silently does nothing.
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace('/src/main.tsx', '/src/probe/main.tsx');
      },
    },
    configureServer(server) {
      server.middlewares.use('/probe-marker.js', (_req, res) => {
        res.setHeader('Content-Type', 'text/javascript');
        res.end(PROBE_MARKER_JS);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'probe-marker.js', source: PROBE_MARKER_JS });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: probe ? [react(), probeEntry()] : [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
}));
