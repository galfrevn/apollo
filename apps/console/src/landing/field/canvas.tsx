import { useCallback, useEffect, useRef } from 'react';

import {
  FIELD_CELL_SIZE,
  pruneRippleList,
  rasterizeFieldFrame,
} from '@/landing/field/geometry';
import {
  REDUCED_MOTION_QUERY,
  REDUCED_MOTION_SAFE_QUERY,
  gsap,
  prefersReducedMotion,
  useGSAP,
} from '@/landing/motion';

import type { FieldRenderState } from '@/landing/field/geometry';

interface FieldCanvasProps {
  readonly wakeSignal?: number;
  readonly className?: string;
}

const FIELD_INK_COLOR = '#fafafa';
const GLYPH_SIZE_RATIO = 1;
const TARGET_FRAME_INTERVAL = 1000 / 30;

const AMBIENT_RIPPLE_INTERVAL_SECONDS = 5.5;
const AMBIENT_RIPPLE_STRENGTH = 0.62;
const POINTER_RIPPLE_STRENGTH = 0.8;
const WAKE_RIPPLE_STRENGTH = 1.15;
const WAKE_RIPPLE_ORIGIN_X = 0.5;
const WAKE_RIPPLE_ORIGIN_Y = 0.26;
const STATIC_FRAME_SECONDS = 12;

interface PointerPlacement {
  readonly normalizedX: number;
  readonly normalizedY: number;
}

function isInsideField(placement: PointerPlacement): boolean {
  return (
    placement.normalizedX >= 0 &&
    placement.normalizedX <= 1 &&
    placement.normalizedY >= 0 &&
    placement.normalizedY <= 1
  );
}

export function FieldCanvas({ wakeSignal = 0, className }: FieldCanvasProps) {
  const canvasReference = useRef<HTMLCanvasElement | null>(null);
  const renderStateReference = useRef<FieldRenderState>({
    elapsedSeconds: 0,
    pointerX: 0.5,
    pointerY: 0.5,
    pointerPresence: 0,
    rippleList: [],
  });
  const isVisibleReference = useRef(true);

  const emitRipple = useCallback((originX: number, originY: number, strength: number) => {
    const renderState = renderStateReference.current;
    renderState.rippleList = [
      ...pruneRippleList(renderState.rippleList, renderState.elapsedSeconds),
      {
        originX,
        originY,
        emittedSeconds: renderState.elapsedSeconds,
        strength,
      },
    ];
  }, []);

  const paintFrame = useCallback(() => {
    const canvas = canvasReference.current;
    const context = canvas?.getContext('2d');
    if (canvas === null || context === null || context === undefined) {
      return;
    }
    const pixelRatio = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * pixelRatio);
    const height = Math.round(canvas.clientHeight * pixelRatio);
    if (width === 0 || height === 0) {
      return;
    }
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const cellSize = FIELD_CELL_SIZE * pixelRatio;
    const columnCount = Math.ceil(width / cellSize);
    const rowCount = Math.ceil(height / cellSize);
    const litCellList = rasterizeFieldFrame(
      renderStateReference.current,
      columnCount,
      rowCount,
    );
    context.clearRect(0, 0, width, height);
    context.fillStyle = FIELD_INK_COLOR;
    context.font = `${Math.ceil(cellSize * GLYPH_SIZE_RATIO)}px 'JetBrains Mono', monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const cell of litCellList) {
      context.globalAlpha = cell.inkAlpha;
      context.fillText(
        cell.glyph,
        (cell.columnIndex + 0.5) * cellSize,
        (cell.rowIndex + 0.5) * cellSize,
      );
    }
    context.globalAlpha = 1;
  }, []);

  useEffect(() => {
    const canvas = canvasReference.current;
    if (canvas === null) {
      return;
    }
    const resizeObserver = new ResizeObserver(() => paintFrame());
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [paintFrame]);

  // The hero sits above a long page, so the field stops costing anything the
  // moment it scrolls away instead of repainting behind five other sections.
  useEffect(() => {
    const canvas = canvasReference.current;
    if (canvas === null) {
      return;
    }
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isVisibleReference.current = entry.isIntersecting;
    });
    intersectionObserver.observe(canvas);
    return () => intersectionObserver.disconnect();
  }, []);

  useGSAP(
    () => {
      const renderState = renderStateReference.current;
      const responsiveMotion = gsap.matchMedia();
      responsiveMotion.add(REDUCED_MOTION_SAFE_QUERY, () => {
        emitRipple(
          gsap.utils.random(0.25, 0.75),
          gsap.utils.random(0.14, 0.34),
          AMBIENT_RIPPLE_STRENGTH,
        );
        let lastPaintTimestamp = 0;
        let nextAmbientRippleSeconds = AMBIENT_RIPPLE_INTERVAL_SECONDS;
        const tickerCallback = (elapsedTime: number) => {
          if (!isVisibleReference.current) {
            return;
          }
          renderState.elapsedSeconds = elapsedTime;
          if (elapsedTime >= nextAmbientRippleSeconds) {
            nextAmbientRippleSeconds =
              elapsedTime +
              AMBIENT_RIPPLE_INTERVAL_SECONDS * gsap.utils.random(0.75, 1.35);
            emitRipple(
              gsap.utils.random(0.08, 0.92),
              gsap.utils.random(0.1, 0.44),
              AMBIENT_RIPPLE_STRENGTH,
            );
          }
          if (elapsedTime * 1000 - lastPaintTimestamp < TARGET_FRAME_INTERVAL) {
            return;
          }
          lastPaintTimestamp = elapsedTime * 1000;
          renderState.rippleList = pruneRippleList(renderState.rippleList, elapsedTime);
          paintFrame();
        };
        gsap.ticker.add(tickerCallback);

        const fadePointerPresence = gsap.quickTo(renderState, 'pointerPresence', {
          duration: 0.55,
          ease: 'power2',
        });
        const readPointerPlacement = (event: PointerEvent): PointerPlacement | null => {
          const canvas = canvasReference.current;
          if (canvas === null) {
            return null;
          }
          const bounds = canvas.getBoundingClientRect();
          if (bounds.width === 0 || bounds.height === 0) {
            return null;
          }
          return {
            normalizedX: (event.clientX - bounds.left) / bounds.width,
            normalizedY: (event.clientY - bounds.top) / bounds.height,
          };
        };
        const handlePointerMove = (event: PointerEvent) => {
          const placement = readPointerPlacement(event);
          if (placement === null || !isInsideField(placement)) {
            fadePointerPresence(0);
            return;
          }
          renderState.pointerX = placement.normalizedX;
          renderState.pointerY = placement.normalizedY;
          fadePointerPresence(1);
        };
        const handlePointerDown = (event: PointerEvent) => {
          const placement = readPointerPlacement(event);
          if (placement === null || !isInsideField(placement)) {
            return;
          }
          emitRipple(
            placement.normalizedX,
            placement.normalizedY,
            POINTER_RIPPLE_STRENGTH,
          );
        };
        window.addEventListener('pointermove', handlePointerMove, { passive: true });
        window.addEventListener('pointerdown', handlePointerDown, { passive: true });

        return () => {
          gsap.ticker.remove(tickerCallback);
          window.removeEventListener('pointermove', handlePointerMove);
          window.removeEventListener('pointerdown', handlePointerDown);
        };
      });
      responsiveMotion.add(REDUCED_MOTION_QUERY, () => {
        renderState.elapsedSeconds = STATIC_FRAME_SECONDS;
        paintFrame();
      });
    },
    { scope: canvasReference },
  );

  useGSAP(
    () => {
      if (wakeSignal === 0 || prefersReducedMotion()) {
        return;
      }
      emitRipple(WAKE_RIPPLE_ORIGIN_X, WAKE_RIPPLE_ORIGIN_Y, WAKE_RIPPLE_STRENGTH);
    },
    { dependencies: [wakeSignal] },
  );

  return <canvas ref={canvasReference} className={className} aria-hidden />;
}
