/**
 * Render every `<pre class="mermaid">` block under `root` into an inline SVG and
 * keep diagrams in sync with the active theme. Mermaid is imported lazily so it
 * only loads when a document actually uses it.
 */
import { attachDiagramCopyControls } from './mermaid-copy';
import { onThemeChange, type Resolved, resolveTheme } from './theme';

type Mermaid = typeof import('mermaid').default;

let mermaidPromise: Promise<Mermaid> | null = null;
let renderSeq = 0;
let subscribed = false;
let themeGeneration = 0;
let rerenderChain: Promise<void> = Promise.resolve();

function loadMermaid(): Promise<Mermaid> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => m.default);
  }
  return mermaidPromise;
}

function initMermaid(mermaid: Mermaid, theme: Resolved): void {
  mermaid.initialize({
    startOnLoad: false,
    // Untrusted documents: 'strict' (mermaid's own default) sanitizes the rendered
    // SVG and disables click bindings / embedded HTML & script in diagrams. mallow
    // only renders diagrams for viewing — it uses no interactive `click` directives —
    // so tightening this from 'loose' drops nothing we rely on. Do NOT switch to
    // 'sandbox': that renders each diagram inside an <iframe>, which would break the
    // inline-SVG theme re-render and the PNG/SVG copy controls in lib/mermaid-copy.ts.
    securityLevel: 'strict',
    theme: theme === 'dark' ? 'dark' : 'default',
    flowchart: { useMaxWidth: true },
    themeVariables: { fontSize: '14px' },
  });
}

async function renderSvg(code: string, mermaid: Mermaid): Promise<string | null> {
  const id = `mermaid-svg-${renderSeq++}`;
  try {
    const { svg } = await mermaid.render(id, code);
    return svg;
  } catch (error) {
    console.error('Failed to render mermaid diagram', error);
    return null;
  }
}

function applySvg(wrapper: HTMLElement, svg: string): void {
  wrapper.innerHTML = svg;
  attachDiagramCopyControls(wrapper);
}

function enqueueRerender(theme: Resolved): void {
  const gen = ++themeGeneration;
  rerenderChain = rerenderChain.then(() => rerenderPass(theme, gen)).catch(() => {});
}

function subscribeThemeOnce(): void {
  if (subscribed) {
    return;
  }
  subscribed = true;
  onThemeChange((theme) => enqueueRerender(theme));
}

async function rerenderPass(theme: Resolved, gen: number): Promise<void> {
  if (gen !== themeGeneration) {
    return;
  }
  const wrappers = Array.from(document.querySelectorAll<HTMLElement>('.mermaid-rendered[data-mermaid-source]'));
  if (wrappers.length === 0) {
    return;
  }
  const mermaid = await loadMermaid();
  initMermaid(mermaid, theme);
  for (const wrapper of wrappers) {
    if (gen !== themeGeneration) {
      return;
    }
    const code = wrapper.dataset.mermaidSource;
    if (!code) {
      continue;
    }
    const svg = await renderSvg(code, mermaid);
    if (svg === null) {
      continue;
    }
    if (gen !== themeGeneration) {
      return;
    }
    applySvg(wrapper, svg);
  }
}

export async function renderMermaid(root: ParentNode = document): Promise<void> {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('pre.mermaid'));
  if (blocks.length === 0) {
    return;
  }

  const mermaid = await loadMermaid();
  const renderedTheme = resolveTheme();
  initMermaid(mermaid, renderedTheme);

  for (const block of blocks) {
    const code = (block.textContent ?? '').trim();
    if (!code) {
      continue;
    }
    const svg = await renderSvg(code, mermaid);
    if (svg === null) {
      continue;
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'mermaid-rendered';
    wrapper.dataset.mermaidSource = code;
    block.replaceWith(wrapper);
    applySvg(wrapper, svg);
  }

  subscribeThemeOnce();
  // Catch-up: a theme change during the async render above fired before we
  // subscribed, so re-enqueue against the now-current theme if it moved.
  const current = resolveTheme();
  if (current !== renderedTheme) {
    enqueueRerender(current);
  }
}
