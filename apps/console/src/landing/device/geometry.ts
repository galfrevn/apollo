import { isInsideCapsule } from '@/landing/face/geometry';

export interface DeviceRenderState {
  spinAngle: number;
  tiltAngle: number;
  bobOffset: number;
  eyeHeightRatio: number;
  eyeLiftRatio: number;
  eyeWidthRatio: number;
  blinkProgress: number;
}

export const DEFAULT_DEVICE_GRID_RESOLUTION = 40;
export const DEVICE_GLYPH_RAMP = ' .:-=+*#%@';

const CAMERA_DISTANCE = 4;
const FOCAL_LENGTH = 2.7;
const MAX_MARCH_STEPS = 48;
const MAX_MARCH_DISTANCE = 9;
const SURFACE_EPSILON = 0.002;
const NORMAL_STEP = 0.002;

const BODY_HALF_WIDTH = 0.58;
const BODY_HALF_HEIGHT = 0.44;
const BODY_HALF_DEPTH = 0.32;
const BODY_CORNER_RADIUS = 0.52;

const SCREEN_HALF_WIDTH = 0.46;
const SCREEN_HALF_HEIGHT = 0.34;
const SCREEN_FACING_THRESHOLD = 0.7;
const SCREEN_GLYPH = '.';

const EYE_CENTER_X = 0.21;
const EYE_HALF_WIDTH = 0.085;
const OPEN_EYE_HALF_HEIGHT = 0.2;
const CLOSED_EYE_HALF_HEIGHT = 0.035;
const EYE_LIFT_SCALE = 0.1;

const LIGHT_X = 0.46;
const LIGHT_Y = 0.74;
const LIGHT_Z = 0.49;

const DITHER_MATRIX = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const DITHER_STRENGTH = 0.07;
const DITHER_FLOOR = 0.14;

function roundedBoxDistance(pointX: number, pointY: number, pointZ: number): number {
  const offsetX = Math.abs(pointX) - BODY_HALF_WIDTH;
  const offsetY = Math.abs(pointY) - BODY_HALF_HEIGHT;
  const offsetZ = Math.abs(pointZ) - BODY_HALF_DEPTH;
  const outsideX = Math.max(offsetX, 0);
  const outsideY = Math.max(offsetY, 0);
  const outsideZ = Math.max(offsetZ, 0);
  const outsideLength = Math.sqrt(
    outsideX * outsideX + outsideY * outsideY + outsideZ * outsideZ,
  );
  const insideDistance = Math.min(Math.max(offsetX, offsetY, offsetZ), 0);
  return outsideLength + insideDistance - BODY_CORNER_RADIUS;
}

function computeDitherOffset(columnIndex: number, rowIndex: number): number {
  return DITHER_MATRIX[(rowIndex % 4) * 4 + (columnIndex % 4)] / 16 - 0.5;
}

function resolveEyeHalfHeight(state: DeviceRenderState): number {
  const openHalfHeight = OPEN_EYE_HALF_HEIGHT * state.eyeHeightRatio;
  return Math.max(
    CLOSED_EYE_HALF_HEIGHT,
    openHalfHeight * (1 - state.blinkProgress) +
      CLOSED_EYE_HALF_HEIGHT * state.blinkProgress,
  );
}

// A corner radius larger than the inner half-extents keeps every face curved,
// which is what gives the glyph ramp something to gradate across; a hard-edged
// box would shade as flat blocks of a single glyph.
export function renderDeviceFrame(
  state: DeviceRenderState,
  gridResolution: number = DEFAULT_DEVICE_GRID_RESOLUTION,
): readonly string[] {
  const spinCos = Math.cos(state.spinAngle);
  const spinSin = Math.sin(state.spinAngle);
  const tiltCos = Math.cos(state.tiltAngle);
  const tiltSin = Math.sin(state.tiltAngle);
  const eyeHalfHeight = resolveEyeHalfHeight(state);
  const eyeHalfWidth = EYE_HALF_WIDTH * state.eyeWidthRatio;
  const eyeCenterY = state.eyeLiftRatio * EYE_LIFT_SCALE;
  const rowTextList: string[] = [];

  for (let rowIndex = 0; rowIndex < gridResolution; rowIndex++) {
    const glyphList: string[] = [];
    for (let columnIndex = 0; columnIndex < gridResolution; columnIndex++) {
      const screenX = ((columnIndex + 0.5) / gridResolution) * 2 - 1;
      const screenY = -(((rowIndex + 0.5) / gridResolution) * 2 - 1);
      const directionLength = Math.sqrt(
        screenX * screenX + screenY * screenY + FOCAL_LENGTH * FOCAL_LENGTH,
      );
      const rayX = screenX / directionLength;
      const rayY = screenY / directionLength;
      const rayZ = -FOCAL_LENGTH / directionLength;

      let travelled = 0;
      let hitX = 0;
      let hitY = 0;
      let hitZ = 0;
      let didHit = false;

      for (let stepIndex = 0; stepIndex < MAX_MARCH_STEPS; stepIndex++) {
        const worldX = rayX * travelled;
        const worldY = rayY * travelled - state.bobOffset;
        const worldZ = CAMERA_DISTANCE + rayZ * travelled;
        const tiltedY = worldY * tiltCos - worldZ * tiltSin;
        const tiltedZ = worldY * tiltSin + worldZ * tiltCos;
        const objectX = worldX * spinCos - tiltedZ * spinSin;
        const objectZ = worldX * spinSin + tiltedZ * spinCos;
        const distance = roundedBoxDistance(objectX, tiltedY, objectZ);
        if (distance < SURFACE_EPSILON) {
          hitX = objectX;
          hitY = tiltedY;
          hitZ = objectZ;
          didHit = true;
          break;
        }
        travelled += distance;
        if (travelled > MAX_MARCH_DISTANCE) {
          break;
        }
      }

      if (!didHit) {
        glyphList.push(' ');
        continue;
      }

      let normalX =
        roundedBoxDistance(hitX + NORMAL_STEP, hitY, hitZ) -
        roundedBoxDistance(hitX - NORMAL_STEP, hitY, hitZ);
      let normalY =
        roundedBoxDistance(hitX, hitY + NORMAL_STEP, hitZ) -
        roundedBoxDistance(hitX, hitY - NORMAL_STEP, hitZ);
      let normalZ =
        roundedBoxDistance(hitX, hitY, hitZ + NORMAL_STEP) -
        roundedBoxDistance(hitX, hitY, hitZ - NORMAL_STEP);
      const normalLength =
        Math.sqrt(normalX * normalX + normalY * normalY + normalZ * normalZ) || 1;
      normalX /= normalLength;
      normalY /= normalLength;
      normalZ /= normalLength;

      const isFacingViewer = normalZ > SCREEN_FACING_THRESHOLD;
      const isOnScreenPanel =
        Math.abs(hitX) < SCREEN_HALF_WIDTH && Math.abs(hitY) < SCREEN_HALF_HEIGHT;
      if (isFacingViewer && isOnScreenPanel) {
        const isOnEye =
          isInsideCapsule(
            hitX,
            hitY,
            -EYE_CENTER_X,
            eyeCenterY,
            eyeHalfWidth,
            eyeHalfHeight,
          ) ||
          isInsideCapsule(
            hitX,
            hitY,
            EYE_CENTER_X,
            eyeCenterY,
            eyeHalfWidth,
            eyeHalfHeight,
          );
        glyphList.push(
          isOnEye ? DEVICE_GLYPH_RAMP.charAt(DEVICE_GLYPH_RAMP.length - 1) : SCREEN_GLYPH,
        );
        continue;
      }

      const lambert = Math.max(
        0,
        normalX * LIGHT_X + normalY * LIGHT_Y + normalZ * LIGHT_Z,
      );
      const viewX = -rayX;
      const viewY = -rayY;
      const viewZ = -rayZ;
      const halfwayX = LIGHT_X + viewX;
      const halfwayY = LIGHT_Y + viewY;
      const halfwayZ = LIGHT_Z + viewZ;
      const halfwayLength =
        Math.sqrt(halfwayX * halfwayX + halfwayY * halfwayY + halfwayZ * halfwayZ) || 1;
      const specularAngle = Math.max(
        0,
        (normalX * halfwayX + normalY * halfwayY + normalZ * halfwayZ) / halfwayLength,
      );
      const facingCamera = Math.max(
        0,
        normalX * viewX + normalY * viewY + normalZ * viewZ,
      );
      const shadedIntensity =
        0.04 +
        Math.pow(lambert, 0.85) * 0.86 +
        Math.pow(specularAngle, 28) * 0.7 +
        Math.pow(1 - facingCamera, 3) * 0.4;
      // Dithering the near-black underside would scatter lone glyphs that read
      // as dirt rather than shading, so it only breaks up banding once the
      // surface is genuinely lit.
      const intensity =
        shadedIntensity > DITHER_FLOOR
          ? shadedIntensity + computeDitherOffset(columnIndex, rowIndex) * DITHER_STRENGTH
          : shadedIntensity;
      const glyphIndex = Math.round(
        Math.max(0, Math.min(1, intensity)) * (DEVICE_GLYPH_RAMP.length - 1),
      );
      glyphList.push(DEVICE_GLYPH_RAMP.charAt(glyphIndex));
    }
    rowTextList.push(glyphList.join(''));
  }
  return rowTextList;
}
