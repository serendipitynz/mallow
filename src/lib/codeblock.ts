/**
 * Progressive enhancement for Shiki-highlighted code blocks: wrap each
 * `<pre class="shiki">` in a GitHub-style container and add a copy button.
 * The `.shiki` class is what @shikijs/markdown-it emits.
 *
 * Mermaid diagrams render as `<pre class="mermaid">`, so the `.shiki` selector
 * excludes them automatically. The pass is idempotent.
 */

// GitHub octicons (copy / check). Inlined to avoid shipping an icon dependency.
const COPY_ICON =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">' +
  '<path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path>' +
  '<path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>' +
  '</svg>';
const CHECK_ICON =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">' +
  '<path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L1.72 8.78a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>' +
  '</svg>';

/** Copy `text`, preferring the async Clipboard API with a legacy fallback. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path (e.g. denied permission, insecure origin).
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  try {
    textarea.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

/** Wrap a single `<pre>` and attach its copy button. */
function enhance(pre: HTMLElement): void {
  if (pre.parentElement?.classList.contains('code-block')) {
    return;
  }

  const code = pre.querySelector('code');
  if (!code) {
    return;
  }

  const container = document.createElement('div');
  container.className = 'code-block';
  pre.replaceWith(container);
  container.appendChild(pre);

  const IDLE_LABEL = 'コードをコピー';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'code-block__copy';
  button.setAttribute('aria-label', IDLE_LABEL);
  button.title = 'コピー';
  button.innerHTML = COPY_ICON;
  container.appendChild(button);

  let resetTimer = 0;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    void copyText(code.textContent ?? '').then((ok) => {
      const label = ok ? 'コピーしました' : 'コピーに失敗しました';
      button.innerHTML = ok ? CHECK_ICON : COPY_ICON;
      button.classList.toggle('is-copied', ok);
      button.title = label;
      button.setAttribute('aria-label', label);
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        button.innerHTML = COPY_ICON;
        button.classList.remove('is-copied');
        button.title = 'コピー';
        button.setAttribute('aria-label', IDLE_LABEL);
      }, 2000);
    });
  });
}

/** Enhance every Shiki code block under `root` (mermaid blocks are excluded). */
export function enhanceCodeBlocks(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('pre.shiki').forEach(enhance);
}
