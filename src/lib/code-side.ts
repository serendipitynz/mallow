/** Which of Shiki's two token sets a code block on a slide is drawn with: the side
 *  of the ground the block sits on, not the drawn mode (decision-19 §5, TASK-60).
 *  A theme may put a dark code ground in Light mode — kinari's `invert` does, and
 *  so may a folder theme — and the drawn mode then picks tokens for the other
 *  side of the paper. */

export type CodeSide = 'light' | 'dark';

/** r, g and b in 0–255, a in 0–1. */
export type Rgba = readonly [number, number, number, number];

/** The colour the layers paint, innermost first: each is laid over the ones
 *  outside it, down to the first opaque one. `null` when none is opaque — a
 *  ground that shows what lies outside the slide is no ground to read. */
export function compositeGround(layers: readonly Rgba[]): Rgba | null {
  const opaqueAt = layers.findIndex((layer) => layer[3] >= 1);
  if (opaqueAt === -1) {
    return null;
  }
  let [r, g, b] = layers[opaqueAt];
  for (let i = opaqueAt - 1; i >= 0; i--) {
    const [lr, lg, lb, la] = layers[i];
    r = lr * la + r * (1 - la);
    g = lg * la + g * (1 - la);
    b = lb * la + b * (1 - la);
  }
  return [r, g, b, 1];
}

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2's relative luminance. */
export function relativeLuminance([r, g, b]: Rgba): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** The luminance at which black and white ink have the same WCAG contrast,
 *  √(1.05 × 0.05) − 0.05. Below it light ink reads better, so the ground is dark. */
const EVEN_CONTRAST_LUMINANCE = Math.sqrt(1.05 * 0.05) - 0.05;

export function codeSideOf(ground: Rgba): CodeSide {
  return relativeLuminance(ground) < EVEN_CONTRAST_LUMINANCE ? 'dark' : 'light';
}

let probe: CanvasRenderingContext2D | null | undefined;

/** A computed colour as sRGB. Painted rather than parsed, because an engine may
 *  serialize a computed colour as `rgb()`, `color(srgb …)` or `oklch()` depending
 *  on how the theme wrote it, and painting takes them all. */
function toRgba(color: string): Rgba | null {
  if (probe === undefined) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    probe = canvas.getContext('2d', { willReadFrequently: true });
  }
  if (!probe) {
    return null;
  }
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = 'transparent';
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}

/** The background layers from `pre` out to its slide. Nothing past the slide
 *  counts: what lies outside it is the app's stage, not the theme's ground. */
function groundLayers(pre: Element): Rgba[] | null {
  const layers: Rgba[] = [];
  for (let el: Element | null = pre; el; el = el.parentElement) {
    const rgba = toRgba(getComputedStyle(el).backgroundColor);
    if (!rgba) {
      return null;
    }
    layers.push(rgba);
    if (el.localName === 'section') {
      return layers;
    }
  }
  return null;
}

/** Marks every Shiki block under `host` with `data-code-side`, which
 *  `slides.scss` draws the tokens by. A block whose ground cannot be read is left
 *  unmarked and follows the drawn mode, as every block did before. Reads computed
 *  colours, so it is rerun whenever they can change: a new slide, or the drawn
 *  mode or colour family changing under the same one. */
export function markCodeSides(host: Element): void {
  for (const pre of host.querySelectorAll('pre.shiki')) {
    const layers = groundLayers(pre);
    const ground = layers && compositeGround(layers);
    if (ground) {
      pre.setAttribute('data-code-side', codeSideOf(ground));
    } else {
      pre.removeAttribute('data-code-side');
    }
  }
}
