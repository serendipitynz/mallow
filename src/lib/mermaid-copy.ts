/**
 * Copy controls for rendered mermaid diagrams: a small toolbar (PNG / SVG) added
 * to each `.mermaid-rendered` block after lib/mermaid.ts inlines the SVG.
 *
 * - SVG copy: serialize the live `<svg>` and copy the markup as text.
 * - PNG copy: inline the foreignObject styles, rasterize to a 2x canvas, and
 *   write `image/png` to the clipboard (falls back to a download).
 */
import { copyText } from './codeblock';

const PNG_SCALE = 2;
const FEEDBACK_MS = 1800;

const FOREIGN_OBJECT_PROPS = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'color',
  'line-height',
  'text-align',
  'white-space',
] as const;

type CopyResult = 'copied' | 'downloaded' | 'failed';

function cloneForExport(live: SVGSVGElement): { clone: SVGSVGElement; width: number; height: number } {
  const clone = live.cloneNode(true) as SVGSVGElement;

  const box = live.getBoundingClientRect();
  const viewBox = live.viewBox.baseVal;
  const width = viewBox?.width ? viewBox.width : box.width;
  const height = viewBox?.height ? viewBox.height : box.height;

  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.style.maxWidth = 'none';

  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!clone.getAttribute('xmlns:xlink')) clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  return { clone, width, height };
}

function inlineForeignObjectStyles(live: SVGSVGElement, clone: SVGSVGElement): void {
  const liveNodes = live.querySelectorAll<HTMLElement>('foreignObject *');
  const cloneNodes = clone.querySelectorAll<HTMLElement>('foreignObject *');
  liveNodes.forEach((node, i) => {
    const target = cloneNodes[i];
    if (!target) return;
    const computed = getComputedStyle(node);
    let inline = target.getAttribute('style')?.trim() ?? '';
    if (inline && !inline.endsWith(';')) inline += ';';
    for (const prop of FOREIGN_OBJECT_PROPS) {
      const value = computed.getPropertyValue(prop);
      if (value) inline += `${prop}:${value};`;
    }
    target.setAttribute('style', inline);
  });
}

function serialize(svg: SVGSVGElement): string {
  return new XMLSerializer().serializeToString(svg);
}

function rasterize(svgString: string, width: number, height: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(width * PNG_SCALE));
      canvas.height = Math.max(1, Math.ceil(height * PNG_SCALE));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('2d canvas context unavailable'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      try {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))), 'image/png');
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error('Failed to load SVG into an image'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
  });
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copySvg(svg: SVGSVGElement): Promise<CopyResult> {
  const { clone } = cloneForExport(svg);
  inlineForeignObjectStyles(svg, clone);
  return (await copyText(serialize(clone))) ? 'copied' : 'failed';
}

async function copyPng(svg: SVGSVGElement): Promise<CopyResult> {
  const { clone, width, height } = cloneForExport(svg);
  inlineForeignObjectStyles(svg, clone);
  const blobPromise = rasterize(serialize(clone), width, height);

  if (navigator.clipboard && 'write' in navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
      return 'copied';
    } catch (error) {
      console.warn('Clipboard image write failed; falling back to download', error);
    }
  }

  const blob = await blobPromise.catch((error) => {
    console.error('Failed to rasterize diagram to PNG', error);
    return null;
  });
  if (!blob) return 'failed';
  download(blob, 'diagram.png');
  return 'downloaded';
}

interface Action {
  label: string;
  idleTitle: string;
  run: (svg: SVGSVGElement) => Promise<CopyResult>;
}

const ACTIONS: Action[] = [
  { label: 'PNG', idleTitle: 'PNG 画像としてコピー', run: copyPng },
  { label: 'SVG', idleTitle: 'SVG としてコピー', run: copySvg },
];

function makeButton(action: Action, svg: SVGSVGElement): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mermaid-copy__button';
  button.textContent = action.label;
  button.title = action.idleTitle;
  button.setAttribute('aria-label', action.idleTitle);

  let resetTimer = 0;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    void action.run(svg).then((result) => {
      const feedback =
        result === 'copied' ? 'コピーしました' : result === 'downloaded' ? 'ダウンロードしました' : 'コピーに失敗しました';
      const ok = result !== 'failed';
      button.textContent = ok ? '✓' : '×';
      button.classList.toggle('is-copied', ok);
      button.classList.toggle('is-error', !ok);
      button.title = feedback;
      button.setAttribute('aria-label', feedback);
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        button.textContent = action.label;
        button.classList.remove('is-copied', 'is-error');
        button.title = action.idleTitle;
        button.setAttribute('aria-label', action.idleTitle);
      }, FEEDBACK_MS);
    });
  });

  return button;
}

/** Attach the PNG/SVG copy toolbar to a rendered `.mermaid-rendered` container. */
export function attachDiagramCopyControls(container: HTMLElement): void {
  if (container.querySelector(':scope > .mermaid-copy')) return;
  const svg = container.querySelector<SVGSVGElement>('svg');
  if (!svg) return;

  const bar = document.createElement('div');
  bar.className = 'mermaid-copy';
  for (const action of ACTIONS) bar.appendChild(makeButton(action, svg));
  container.appendChild(bar);
}
