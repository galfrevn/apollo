import { useCallback, useEffect, useRef } from 'react';

import {
  DEFAULT_DEVICE_GRID_RESOLUTION,
  renderDeviceFrame,
} from '@/landing/device/geometry';
import { FACE_EMOTION_CATALOG } from '@/landing/face/emotions';
import {
  REDUCED_MOTION_QUERY,
  REDUCED_MOTION_SAFE_QUERY,
  gsap,
  prefersReducedMotion,
  useGSAP,
} from '@/landing/motion';

import type { DeviceRenderState } from '@/landing/device/geometry';
import type { LandingFaceEmotionName } from '@/landing/face/emotions';

interface DeviceCanvasProps {
  readonly emotion?: LandingFaceEmotionName;
  readonly gridResolution?: number;
  readonly shouldTrackPointer?: boolean;
  readonly wakeSignal?: number;
  readonly className?: string;
  readonly label?: string;
}

const DEVICE_INK_COLOR = '#fafafa';
const GLYPH_SIZE_RATIO = 1.05;
const RESTING_TILT_ANGLE = -0.14;
const POINTER_SPIN_LIMIT = 0.62;
const POINTER_TILT_RANGE = 0.22;
const IDLE_SPIN_SPEED = 0.42;
const IDLE_SPIN_AMPLITUDE = 0.34;
const BOB_SPEED = 0.0009;
const BOB_AMPLITUDE = 0.045;
const TARGET_FRAME_INTERVAL = 1000 / 30;

export function DeviceCanvas({
  emotion = 'neutral',
  gridResolution = DEFAULT_DEVICE_GRID_RESOLUTION,
  shouldTrackPointer = false,
  wakeSignal = 0,
  className,
  label,
}: DeviceCanvasProps) {
  const canvasReference = useRef<HTMLCanvasElement | null>(null);
  const renderStateReference = useRef<DeviceRenderState>({
    spinAngle: 0,
    tiltAngle: RESTING_TILT_ANGLE,
    bobOffset: 0,
    ...FACE_EMOTION_CATALOG.neutral,
    blinkProgress: 0,
  });
  const bobPhaseReference = useRef(0);

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
    const rowTextList = renderDeviceFrame(renderStateReference.current, gridResolution);
    const extent = Math.min(width, height);
    const cellSize = extent / gridResolution;
    const offsetX = (width - extent) / 2;
    const offsetY = (height - extent) / 2;
    context.clearRect(0, 0, width, height);
    context.fillStyle = DEVICE_INK_COLOR;
    context.font = `${Math.ceil(cellSize * GLYPH_SIZE_RATIO)}px 'JetBrains Mono', monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (let rowIndex = 0; rowIndex < rowTextList.length; rowIndex++) {
      const rowText = rowTextList[rowIndex];
      for (let columnIndex = 0; columnIndex < rowText.length; columnIndex++) {
        const glyph = rowText.charAt(columnIndex);
        if (glyph === ' ') {
          continue;
        }
        context.fillText(
          glyph,
          offsetX + (columnIndex + 0.5) * cellSize,
          offsetY + (rowIndex + 0.5) * cellSize,
        );
      }
    }
  }, [gridResolution]);

  useEffect(() => {
    const canvas = canvasReference.current;
    if (canvas === null) {
      return;
    }
    const resizeObserver = new ResizeObserver(() => paintFrame());
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [paintFrame]);

  useGSAP(
    () => {
      const renderState = renderStateReference.current;
      const responsiveMotion = gsap.matchMedia();
      responsiveMotion.add(REDUCED_MOTION_SAFE_QUERY, () => {
        let lastPaintTimestamp = 0;
        // Raymarching every cell is far heavier than the face rasteriser, so the
        // repaint runs at half refresh rate; the motion is slow enough that the
        // drop is invisible while the saved frames matter on a scrolling page.
        const tickerCallback = (elapsedTime: number, deltaTime: number) => {
          bobPhaseReference.current += deltaTime * BOB_SPEED;
          renderState.bobOffset = Math.sin(bobPhaseReference.current) * BOB_AMPLITUDE;
          if (!shouldTrackPointer) {
            renderState.spinAngle =
              Math.sin(elapsedTime * IDLE_SPIN_SPEED) * IDLE_SPIN_AMPLITUDE;
          }
          if (elapsedTime * 1000 - lastPaintTimestamp < TARGET_FRAME_INTERVAL) {
            return;
          }
          lastPaintTimestamp = elapsedTime * 1000;
          paintFrame();
        };
        gsap.ticker.add(tickerCallback);

        let removePointerListener: (() => void) | null = null;
        if (shouldTrackPointer) {
          const aimSpin = gsap.quickTo(renderState, 'spinAngle', {
            duration: 0.6,
            ease: 'power3',
          });
          const aimTilt = gsap.quickTo(renderState, 'tiltAngle', {
            duration: 0.6,
            ease: 'power3',
          });
          const handlePointerMove = (event: PointerEvent) => {
            const canvas = canvasReference.current;
            if (canvas === null) {
              return;
            }
            const bounds = canvas.getBoundingClientRect();
            const centerX = bounds.left + bounds.width / 2;
            const centerY = bounds.top + bounds.height / 2;
            aimSpin(
              gsap.utils.clamp(
                -POINTER_SPIN_LIMIT,
                POINTER_SPIN_LIMIT,
                ((event.clientX - centerX) / (window.innerWidth / 2)) *
                  POINTER_SPIN_LIMIT,
              ),
            );
            // The march rotates the sample point rather than the body, so the
            // vertical term is negated to tilt the screen toward the pointer.
            aimTilt(
              RESTING_TILT_ANGLE -
                gsap.utils.clamp(
                  -POINTER_TILT_RANGE,
                  POINTER_TILT_RANGE,
                  ((event.clientY - centerY) / (window.innerHeight / 2)) *
                    POINTER_TILT_RANGE,
                ),
            );
          };
          window.addEventListener('pointermove', handlePointerMove, { passive: true });
          removePointerListener = () =>
            window.removeEventListener('pointermove', handlePointerMove);
        }

        return () => {
          gsap.ticker.remove(tickerCallback);
          removePointerListener?.();
        };
      });
      responsiveMotion.add(REDUCED_MOTION_QUERY, () => {
        paintFrame();
      });
    },
    { scope: canvasReference, dependencies: [shouldTrackPointer, paintFrame] },
  );

  useGSAP(
    () => {
      if (wakeSignal === 0 || prefersReducedMotion()) {
        return;
      }
      const renderState = renderStateReference.current;
      gsap
        .timeline()
        .to(renderState, { blinkProgress: 1, duration: 0.07, ease: 'power2.in' })
        .to(renderState, { blinkProgress: 0, duration: 0.09, ease: 'power2.out' })
        .to(renderState, { blinkProgress: 1, duration: 0.07, ease: 'power2.in' })
        .to(renderState, { blinkProgress: 0, duration: 0.11, ease: 'power2.out' });
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
        eyeHeightRatio: emotionParameters.eyeHeightRatio,
        eyeLiftRatio: emotionParameters.eyeLiftRatio,
        eyeWidthRatio: emotionParameters.eyeWidthRatio,
        duration: 0.5,
        ease: 'power2.inOut',
        overwrite: 'auto',
      });
    },
    { dependencies: [emotion, paintFrame] },
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
