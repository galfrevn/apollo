import { useCallback, useEffect, useRef } from 'react';

import { FACE_EMOTION_CATALOG } from '@/landing/face/emotions';
import {
  DEFAULT_FACE_GRID_RESOLUTION,
  computeCellGlyph,
  rasterizeFaceFrame,
} from '@/landing/face/geometry';
import {
  REDUCED_MOTION_QUERY,
  REDUCED_MOTION_SAFE_QUERY,
  gsap,
  prefersReducedMotion,
  useGSAP,
} from '@/landing/motion';

import type { LandingFaceEmotionName } from '@/landing/face/emotions';
import type { FaceRenderMode, FaceRenderState } from '@/landing/face/geometry';

interface FaceCanvasProps {
  readonly mode: FaceRenderMode;
  readonly emotion?: LandingFaceEmotionName;
  readonly gridResolution?: number;
  readonly shouldTrackPointer?: boolean;
  readonly shouldBlink?: boolean;
  readonly wakeSignal?: number;
  readonly className?: string;
  readonly label?: string;
}

const FACE_INK_COLOR = '#fafafa';
const GLYPH_SIZE_RATIO = 1.05;
const TALKING_PULSE_SPEED = 0.014;

export function FaceCanvas({
  mode,
  emotion = 'neutral',
  gridResolution = DEFAULT_FACE_GRID_RESOLUTION,
  shouldTrackPointer = false,
  shouldBlink = true,
  wakeSignal = 0,
  className,
  label,
}: FaceCanvasProps) {
  const canvasReference = useRef<HTMLCanvasElement | null>(null);
  const renderStateReference = useRef<FaceRenderState>({
    ...FACE_EMOTION_CATALOG.neutral,
    blinkProgress: 0,
    pupilOffsetX: 0,
    pupilOffsetY: 0,
    revealProgress: 0,
  });
  const pulsePhaseReference = useRef(0);
  const needsPaintReference = useRef(true);

  const markNeedsPaint = () => {
    needsPaintReference.current = true;
  };

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
    const renderState = renderStateReference.current;
    const talkingPulse =
      1 +
      renderState.talkingPulseAmplitude * Math.sin(pulsePhaseReference.current) * 0.65;
    const frameState: FaceRenderState = {
      ...renderState,
      eyeHeightRatio: renderState.eyeHeightRatio * talkingPulse,
    };
    const litCellList = rasterizeFaceFrame(frameState, mode, gridResolution);
    const extent = Math.min(width, height);
    const cellSize = extent / gridResolution;
    const offsetX = (width - extent) / 2;
    const offsetY = (height - extent) / 2;
    context.clearRect(0, 0, width, height);
    context.fillStyle = FACE_INK_COLOR;
    context.font = `${Math.ceil(cellSize * GLYPH_SIZE_RATIO)}px 'JetBrains Mono', monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const cell of litCellList) {
      context.fillText(
        computeCellGlyph(cell.columnIndex, cell.rowIndex),
        offsetX + (cell.columnIndex + 0.5) * cellSize,
        offsetY + (cell.rowIndex + 0.5) * cellSize,
      );
    }
  }, [mode, gridResolution]);

  useEffect(() => {
    const canvas = canvasReference.current;
    if (canvas === null) {
      return;
    }
    const resizeObserver = new ResizeObserver(() => {
      markNeedsPaint();
      paintFrame();
    });
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [paintFrame]);

  useGSAP(
    () => {
      const renderState = renderStateReference.current;
      const responsiveMotion = gsap.matchMedia();
      responsiveMotion.add(REDUCED_MOTION_SAFE_QUERY, () => {
        gsap.to(renderState, {
          revealProgress: 1,
          duration: 0.9,
          ease: 'power1.inOut',
          onUpdate: markNeedsPaint,
        });
        let blinkTimeline: gsap.core.Timeline | null = null;
        if (shouldBlink) {
          blinkTimeline = gsap
            .timeline({
              repeat: -1,
              repeatDelay: gsap.utils.random(4, 6.5),
              delay: gsap.utils.random(0.5, 2.5),
            })
            .to(renderState, {
              blinkProgress: 1,
              duration: 0.09,
              ease: 'power2.in',
              onUpdate: markNeedsPaint,
            })
            .to(
              renderState,
              {
                blinkProgress: 0,
                duration: 0.14,
                ease: 'power2.out',
                onUpdate: markNeedsPaint,
              },
              '+=0.06',
            );
        }
        const tickerCallback = (_elapsedTime: number, deltaTime: number) => {
          if (renderState.talkingPulseAmplitude > 0.001) {
            pulsePhaseReference.current += deltaTime * TALKING_PULSE_SPEED;
            needsPaintReference.current = true;
          }
          if (needsPaintReference.current) {
            needsPaintReference.current = false;
            paintFrame();
          }
        };
        gsap.ticker.add(tickerCallback);
        let removePointerListener: (() => void) | null = null;
        if (shouldTrackPointer) {
          const aimPupilHorizontal = gsap.quickTo(renderState, 'pupilOffsetX', {
            duration: 0.35,
            ease: 'power3',
            onUpdate: markNeedsPaint,
          });
          const aimPupilVertical = gsap.quickTo(renderState, 'pupilOffsetY', {
            duration: 0.35,
            ease: 'power3',
            onUpdate: markNeedsPaint,
          });
          const handlePointerMove = (event: PointerEvent) => {
            const canvas = canvasReference.current;
            if (canvas === null) {
              return;
            }
            const bounds = canvas.getBoundingClientRect();
            const centerX = bounds.left + bounds.width / 2;
            const centerY = bounds.top + bounds.height / 2;
            aimPupilHorizontal(
              gsap.utils.clamp(
                -1,
                1,
                (event.clientX - centerX) / (window.innerWidth / 2),
              ),
            );
            aimPupilVertical(
              gsap.utils.clamp(
                -1,
                1,
                (event.clientY - centerY) / (window.innerHeight / 2),
              ),
            );
          };
          window.addEventListener('pointermove', handlePointerMove, {
            passive: true,
          });
          removePointerListener = () =>
            window.removeEventListener('pointermove', handlePointerMove);
        }
        return () => {
          gsap.ticker.remove(tickerCallback);
          blinkTimeline?.kill();
          removePointerListener?.();
        };
      });
      responsiveMotion.add(REDUCED_MOTION_QUERY, () => {
        renderStateReference.current.revealProgress = 1;
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
      const renderState = renderStateReference.current;
      gsap
        .timeline()
        .to(renderState, {
          blinkProgress: 1,
          duration: 0.07,
          ease: 'power2.in',
          onUpdate: markNeedsPaint,
        })
        .to(renderState, {
          blinkProgress: 0,
          duration: 0.09,
          ease: 'power2.out',
          onUpdate: markNeedsPaint,
        })
        .to(renderState, {
          blinkProgress: 1,
          duration: 0.07,
          ease: 'power2.in',
          onUpdate: markNeedsPaint,
        })
        .to(renderState, {
          blinkProgress: 0,
          duration: 0.11,
          ease: 'power2.out',
          onUpdate: markNeedsPaint,
        });
    },
    { dependencies: [wakeSignal] },
  );

  useGSAP(
    () => {
      const emotionParameters = FACE_EMOTION_CATALOG[emotion];
      const renderState = renderStateReference.current;
      if (prefersReducedMotion()) {
        Object.assign(renderState, emotionParameters);
        paintFrame();
        return;
      }
      gsap.to(renderState, {
        ...emotionParameters,
        duration: 0.5,
        ease: 'power2.inOut',
        overwrite: 'auto',
        onUpdate: markNeedsPaint,
      });
    },
    { dependencies: [emotion] },
  );

  return (
    <canvas
      ref={canvasReference}
      className={className}
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
    />
  );
}
