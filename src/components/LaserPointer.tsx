import { type RefObject, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { liveTrail, type TrailPoint, trailPoint, trailSegments } from '../lib/laser';

export interface PointerSpot {
  x: number;
  y: number;
}

const TRAIL_COLOR = 'rgb(255 48 48)';
const TRAIL_WIDTH_PX = 7;

/** The presentation's laser pointer (TASK-51.3), drawn over the whole window
 *  from `<body>`. **Moving it renders nothing in React and writes nothing into
 *  the slide**: the pointer's position goes straight to the dot's `transform`
 *  and onto a canvas of its own, so the slide's DOM is neither re-rendered nor
 *  mutated however the pointer moves. `lastPointer` is where the pointer was
 *  before the laser came on, so the dot appears there rather than waiting for
 *  the next move; with no move seen since the presentation started it appears
 *  mid-window, since the system cursor is hidden from the moment the laser is
 *  on and the reader would otherwise have nothing to point with. */
export function LaserPointer({ lastPointer }: { lastPointer: RefObject<PointerSpot | null> }) {
  const dotRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!dot || !canvas || !context) {
      return;
    }

    const place = (x: number, y: number) => {
      dot.style.transform = `translate(${x}px, ${y}px)`;
      dot.style.visibility = 'visible';
    };
    const spot = lastPointer.current ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    place(spot.x, spot.y);

    const sizeCanvas = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.lineCap = 'round';
      context.strokeStyle = TRAIL_COLOR;
      context.shadowColor = TRAIL_COLOR;
    };
    sizeCanvas();

    let points: TrailPoint[] = [];
    let seq = 0;
    let frame = 0;
    const draw = () => {
      frame = 0;
      const now = performance.now();
      points = liveTrail(points, now);
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const { from, to, strength } of trailSegments(points, now)) {
        context.globalAlpha = 0.85 * strength;
        context.lineWidth = 1 + (TRAIL_WIDTH_PX - 1) * strength;
        context.shadowBlur = 8 * strength;
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
      }
      // Drawing stops once the trail has gone, so a still pointer costs nothing.
      if (points.length > 0) {
        frame = requestAnimationFrame(draw);
      }
    };

    const onMove = (event: PointerEvent) => {
      place(event.clientX, event.clientY);
      points.push(trailPoint(event.clientX, event.clientY, performance.now(), event.shiftKey, seq++));
      if (frame === 0) {
        frame = requestAnimationFrame(draw);
      }
    };
    const onLeave = () => {
      dot.style.visibility = 'hidden';
    };
    const onResize = () => {
      sizeCanvas();
      points = [];
    };
    window.addEventListener('pointermove', onMove);
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frame);
    };
  }, [lastPointer]);

  return createPortal(
    <div className="laser" aria-hidden="true">
      <canvas ref={canvasRef} className="laser__trail" />
      <div ref={dotRef} className="laser__dot" />
    </div>,
    document.body,
  );
}
