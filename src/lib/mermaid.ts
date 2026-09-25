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
    // Without it a failed render draws mermaid's own error diagram into a
    // temporary container it then leaves at the end of <body> — out of sight
    // under the app's height chain, on the paper once print.scss releases it.
    // The reader is told by `markFailed` instead.
    suppressErrorRendering: true,
    theme: theme === 'dark' ? 'dark' : 'default',
    flowchart: { useMaxWidth: true },
    themeVariables: { fontSize: '14px' },
  });
}

type SvgResult = { ok: true; svg: string } | { ok: false; error: unknown };

async function renderSvg(code: string, mermaid: Mermaid): Promise<SvgResult> {
  const id = `mermaid-svg-${renderSeq++}`;
  try {
    const { svg } = await mermaid.render(id, code);
    return { ok: true, svg };
  } catch (error) {
    console.error('Failed to render mermaid diagram', error);
    return { ok: false, error };
  }
}

/** The text a reader is shown above a diagram that could not be drawn, given
 *  mermaid's own message. Supplied by the caller because it is a UI string and
 *  this module has no access to the language. */
export type DescribeFailure = (message: string) => string;

// The source stays on screen below the note: it is what the reader needs to find
// the fault, and without the note it is indistinguishable from a document mallow
// does not render at all.
function markFailed(block: HTMLElement, error: unknown, describe: DescribeFailure): void {
  const message = error instanceof Error ? error.message : String(error);
  const previous = block.previousElementSibling;
  const note = previous?.classList.contains('mermaid-error') ? previous : document.createElement('p');
  note.className = 'mermaid-error';
  note.textContent = describe(message);
  if (note !== previous) {
    block.before(note);
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
    const result = await renderSvg(code, mermaid);
    if (!result.ok) {
      continue;
    }
    if (gen !== themeGeneration) {
      return;
    }
    applySvg(wrapper, result.svg);
  }
}

/** Rejects only when mermaid itself cannot be loaded, after every block has been
 *  marked as not drawn; a diagram that fails on its own is marked and the rest
 *  still render. */
export async function renderMermaid(root: ParentNode, describeFailure: DescribeFailure): Promise<void> {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('pre.mermaid'));
  if (blocks.length === 0) {
    return;
  }

  let mermaid: Mermaid;
  try {
    mermaid = await loadMermaid();
  } catch (error) {
    for (const block of blocks) {
      markFailed(block, error, describeFailure);
    }
    throw error;
  }
  const renderedTheme = resolveTheme();
  initMermaid(mermaid, renderedTheme);

  for (const block of blocks) {
    const code = (block.textContent ?? '').trim();
    if (!code) {
      continue;
    }
    const result = await renderSvg(code, mermaid);
    if (!result.ok) {
      markFailed(block, result.error, describeFailure);
      continue;
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'mermaid-rendered';
    wrapper.dataset.mermaidSource = code;
    block.replaceWith(wrapper);
    applySvg(wrapper, result.svg);
  }

  subscribeThemeOnce();
  // Catch-up: a theme change during the async render above fired before we
  // subscribed, so re-enqueue against the now-current theme if it moved.
  const current = resolveTheme();
  if (current !== renderedTheme) {
    enqueueRerender(current);
  }
}
