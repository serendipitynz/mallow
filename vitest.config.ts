import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts (which carries the Tauri dev-server tuning).
// The tested modules are pure logic — markdown/config parsing, front-matter,
// titles — so a Node environment is enough; no jsdom/React plugin is needed.
export default defineConfig({
  test: {
    environment: 'node',
    // `scripts/**` is here for the paper measurement, whose pure half is plain
    // `.mjs` because the script that calls it is: a `.ts` module would need a
    // build step to be reachable from a Node script run straight out of the repo.
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
});
