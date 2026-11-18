import { defineConfig } from '@mizchi/mutator';

export default defineConfig({
  runner: 'vitest',
  vitestConfig: 'vitest.config.ts',
  // scripts/ stays out: measure-paper's code runs in a child process, which
  // mutator cannot see, so every mutant there would read as not reached.
  include: ['src/lib/**/*.{ts,tsx}'],
  // These need the DOM or Tauri, and the suite runs under Node with no DOM by
  // design, so no test can reach them; mutating them would only add mutants
  // reported as not reached.
  exclude: [
    'src/lib/codeblock.ts',
    'src/lib/find-dom.ts',
    'src/lib/i18n.tsx',
    'src/lib/mermaid.ts',
    'src/lib/mermaid-copy.ts',
    'src/lib/render-signal.ts',
    'src/lib/scroll.ts',
    'src/lib/settings.ts',
    'src/lib/slide-theme-folder.ts',
    'src/lib/tauri.ts',
    'src/lib/theme.ts',
    'src/lib/watch.ts',
    // Two constants Vite substitutes at build time: nothing a test can observe.
    'src/lib/build-flags.ts',
  ],
  // json carries the mutant keys `mutator accept` takes; the html reporter loads
  // a component from unpkg, so it is left out to keep a run usable offline.
  reporters: ['text', 'json'],
});
