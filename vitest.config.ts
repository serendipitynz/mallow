import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts (which carries the Tauri dev-server tuning).
// The tested modules are pure logic — markdown/config parsing, front-matter,
// titles — so a Node environment is enough; no jsdom/React plugin is needed.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The first markdown render boots the Shiki highlighter (WASM + grammars),
    // which can exceed the 5s default. Set once here rather than as a third
    // argument on each `it`: Biome's formatter expands a three-argument call
    // across lines, which would double the length of every test in
    // markdown.test.ts.
    testTimeout: 20_000,
  },
});
