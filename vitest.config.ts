import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts (which carries the Tauri dev-server tuning).
// The tested modules are pure logic — markdown/config parsing, front-matter,
// titles — so a Node environment is enough; no jsdom/React plugin is needed.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
