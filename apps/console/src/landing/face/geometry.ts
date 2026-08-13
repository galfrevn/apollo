export type FaceRenderMode = 'mark' | 'screen';

export interface FaceRenderState {
  eyeHeightRatio: number;
  eyeLiftRatio: number;
  eyeWidthRatio: number;
  talkingPulseAmplitude: number;
  blinkProgress: number;
  pupilOffsetX: number;
  pupilOffsetY: number;
  revealProgress: number;
}

export interface FaceCell {
  readonly columnIndex: number;
  readonly rowIndex: number;
}

const MARK_UNIT_EXTENT = 20;
const SQUARE_INSET = 1;
const LEFT_EYE_CENTER_X = 6;
const RIGHT_EYE_CENTER_X = 14;
const EYE_CENTER_Y = 9.2;
const EYE_HALF_WIDTH = 1.6;
const OPEN_EYE_HALF_HEIGHT = 3.1;
const CLOSED_EYE_HALF_HEIGHT = 0.6;
const PUPIL_OFFSET_LIMIT = 0.9;

export const DEFAULT_FACE_GRID_RESOLUTION = 32;

function isInsideCapsule(
  pointX: number,
  pointY: number,
  centerX: number,
  centerY: number,
  halfWidth: number,
  halfHeight: number,
): boolean {
  const cornerRadius = Math.min(halfWidth, halfHeight);
  const deltaX = Math.abs(pointX - centerX);
  const deltaY = Math.abs(pointY - centerY);
  if (deltaX > halfWidth || deltaY > halfHeight) {
    return false;
  }
  const innerX = halfWidth - cornerRadius;
  const innerY = halfHeight - cornerRadius;
  if (deltaX <= innerX || deltaY <= innerY) {
    return true;
  }
  return (deltaX - innerX) ** 2 + (deltaY - innerY) ** 2 <= cornerRadius ** 2;
}

export function computeCellRevealThreshold(
  columnIndex: number,
  rowIndex: number,
): number {
  const seeded = Math.sin(columnIndex * 12.9898 + rowIndex * 78.233) * 43758.5453;
  return seeded - Math.floor(seeded);
}

export const FACE_GLYPH_CHARACTER_SET = '@#8&%*+=~:';

export function computeCellGlyph(columnIndex: number, rowIndex: number): string {
  const seeded = Math.sin(columnIndex * 91.317 + rowIndex * 43.771) * 24634.6345;
  const fraction = seeded - Math.floor(seeded);
  const glyphIndex = Math.floor(fraction * FACE_GLYPH_CHARACTER_SET.length);
  return FACE_GLYPH_CHARACTER_SET.charAt(
    Math.min(glyphIndex, FACE_GLYPH_CHARACTER_SET.length - 1),
  );
}

function clampPupilOffset(offset: number): number {
  return Math.max(-1, Math.min(1, offset)) * PUPIL_OFFSET_LIMIT;
}

const SCREEN_CROP_ORIGIN_X = 3.8;
const SCREEN_CROP_ORIGIN_Y = 3;
const SCREEN_CROP_EXTENT = 12.4;

export function rasterizeFaceFrame(
  state: FaceRenderState,
  mode: FaceRenderMode,
  gridResolution: number = DEFAULT_FACE_GRID_RESOLUTION,
): readonly FaceCell[] {
  const litCellList: FaceCell[] = [];
  const cropOriginX = mode === 'screen' ? SCREEN_CROP_ORIGIN_X : 0;
  const cropOriginY = mode === 'screen' ? SCREEN_CROP_ORIGIN_Y : 0;
  const cropExtent = mode === 'screen' ? SCREEN_CROP_EXTENT : MARK_UNIT_EXTENT;
  const openHalfHeight = OPEN_EYE_HALF_HEIGHT * state.eyeHeightRatio;
  const eyeHalfHeight = Math.max(
    CLOSED_EYE_HALF_HEIGHT,
    openHalfHeight * (1 - state.blinkProgress) +
      CLOSED_EYE_HALF_HEIGHT * state.blinkProgress,
  );
  const eyeHalfWidth = EYE_HALF_WIDTH * state.eyeWidthRatio;
  const pupilShiftX = clampPupilOffset(state.pupilOffsetX);
  const pupilShiftY = clampPupilOffset(state.pupilOffsetY);
  const eyeCenterY = EYE_CENTER_Y - state.eyeLiftRatio + pupilShiftY;
  const leftEyeCenterX = LEFT_EYE_CENTER_X + pupilShiftX;
  const rightEyeCenterX = RIGHT_EYE_CENTER_X + pupilShiftX;

  for (let rowIndex = 0; rowIndex < gridResolution; rowIndex++) {
    for (let columnIndex = 0; columnIndex < gridResolution; columnIndex++) {
      const unitX = cropOriginX + ((columnIndex + 0.5) / gridResolution) * cropExtent;
      const unitY = cropOriginY + ((rowIndex + 0.5) / gridResolution) * cropExtent;
      const isInsideSquare =
        unitX >= SQUARE_INSET &&
        unitX <= MARK_UNIT_EXTENT - SQUARE_INSET &&
        unitY >= SQUARE_INSET &&
        unitY <= MARK_UNIT_EXTENT - SQUARE_INSET;
      const isInsideEye =
        isInsideCapsule(
          unitX,
          unitY,
          leftEyeCenterX,
          eyeCenterY,
          eyeHalfWidth,
          eyeHalfHeight,
        ) ||
        isInsideCapsule(
          unitX,
          unitY,
          rightEyeCenterX,
          eyeCenterY,
          eyeHalfWidth,
          eyeHalfHeight,
        );
      const isLit = mode === 'screen' ? isInsideEye : isInsideSquare && !isInsideEye;
      if (
        isLit &&
        computeCellRevealThreshold(columnIndex, rowIndex) <= state.revealProgress
      ) {
        litCellList.push({ columnIndex, rowIndex });
      }
    }
  }
  return litCellList;
}
