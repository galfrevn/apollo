export interface FieldRipple {
  readonly originX: number;
  readonly originY: number;
  readonly emittedSeconds: number;
  readonly strength: number;
}

export interface FieldRenderState {
  elapsedSeconds: number;
  pointerX: number;
  pointerY: number;
  pointerPresence: number;
  rippleList: FieldRipple[];
}

export interface FieldCell {
  readonly columnIndex: number;
  readonly rowIndex: number;
  readonly glyph: string;
  readonly inkAlpha: number;
}

export const FIELD_GLYPH_RAMP = '.:-=+*#%@';
export const FIELD_CELL_SIZE = 16;
export const RIPPLE_LIFETIME_SECONDS = 5.2;

const RIPPLE_SPEED = 0.3;
const RIPPLE_BAND_WIDTH = 0.075;
const RIPPLE_ONSET_SECONDS = 0.35;

const POINTER_RADIUS = 0.2;
const POINTER_WEIGHT = 0.55;

const AMBIENT_WEIGHT = 0.34;
const AMBIENT_CREST_EXPONENT = 3;

const MASK_TOP_EDGE = 0.03;
const MASK_TOP_PLATEAU = 0.16;
const MASK_FADE_START = 0.28;
const MASK_FADE_END = 0.62;
const MASK_RESIDUAL = 0.16;

const INTENSITY_FLOOR = 0.085;
const MINIMUM_INK_ALPHA = 0.06;
const MAXIMUM_INK_ALPHA = 0.6;

function smoothStep(edgeStart: number, edgeEnd: number, value: number): number {
  if (edgeStart === edgeEnd) {
    return value < edgeStart ? 0 : 1;
  }
  const normalized = Math.max(
    0,
    Math.min(1, (value - edgeStart) / (edgeEnd - edgeStart)),
  );
  return normalized * normalized * (3 - 2 * normalized);
}

// The headline is bottom-anchored in a full-height hero, so the field owns the
// empty upper half and thins to a residue underneath the type rather than
// stopping dead: a hard edge across the viewport reads as a seam.
export function computeVerticalMask(normalizedY: number): number {
  const topEdge = smoothStep(MASK_TOP_EDGE, MASK_TOP_PLATEAU, normalizedY);
  const bodyFade = 1 - smoothStep(MASK_FADE_START, MASK_FADE_END, normalizedY);
  return topEdge * (MASK_RESIDUAL + (1 - MASK_RESIDUAL) * bodyFade);
}

export function computeAmbientValue(
  fieldX: number,
  fieldY: number,
  elapsedSeconds: number,
): number {
  const interference =
    Math.sin(fieldX * 5.3 + elapsedSeconds * 0.32) +
    Math.sin(fieldY * 4.1 - elapsedSeconds * 0.24) +
    Math.sin((fieldX + fieldY) * 3.1 + elapsedSeconds * 0.17);
  return (interference / 3 + 1) / 2;
}

export function computeRippleContribution(
  ripple: FieldRipple,
  elapsedSeconds: number,
  fieldX: number,
  fieldY: number,
  aspectRatio: number,
): number {
  const age = elapsedSeconds - ripple.emittedSeconds;
  if (age < 0 || age > RIPPLE_LIFETIME_SECONDS) {
    return 0;
  }
  const deltaX = fieldX - ripple.originX * aspectRatio;
  const deltaY = fieldY - ripple.originY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const bandOffset = (distance - age * RIPPLE_SPEED) / RIPPLE_BAND_WIDTH;
  const onset = Math.min(1, age / RIPPLE_ONSET_SECONDS);
  const decay = 1 - age / RIPPLE_LIFETIME_SECONDS;
  return Math.exp(-bandOffset * bandOffset) * onset * decay * decay * ripple.strength;
}

export function computePointerContribution(
  state: FieldRenderState,
  fieldX: number,
  fieldY: number,
  aspectRatio: number,
): number {
  if (state.pointerPresence <= 0) {
    return 0;
  }
  const deltaX = fieldX - state.pointerX * aspectRatio;
  const deltaY = fieldY - state.pointerY;
  const falloff = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / POINTER_RADIUS;
  return Math.exp(-falloff * falloff) * state.pointerPresence * POINTER_WEIGHT;
}

export function pruneRippleList(
  rippleList: readonly FieldRipple[],
  elapsedSeconds: number,
): FieldRipple[] {
  return rippleList.filter(
    (ripple) => elapsedSeconds - ripple.emittedSeconds <= RIPPLE_LIFETIME_SECONDS,
  );
}

export function rasterizeFieldFrame(
  state: FieldRenderState,
  columnCount: number,
  rowCount: number,
): readonly FieldCell[] {
  const litCellList: FieldCell[] = [];
  if (columnCount <= 0 || rowCount <= 0) {
    return litCellList;
  }
  const aspectRatio = columnCount / rowCount;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const fieldY = (rowIndex + 0.5) / rowCount;
    const verticalMask = computeVerticalMask(fieldY);
    if (verticalMask <= 0) {
      continue;
    }
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
      const fieldX = ((columnIndex + 0.5) / columnCount) * aspectRatio;
      let energy =
        computeAmbientValue(fieldX, fieldY, state.elapsedSeconds) **
          AMBIENT_CREST_EXPONENT *
        AMBIENT_WEIGHT;
      for (const ripple of state.rippleList) {
        energy += computeRippleContribution(
          ripple,
          state.elapsedSeconds,
          fieldX,
          fieldY,
          aspectRatio,
        );
      }
      energy += computePointerContribution(state, fieldX, fieldY, aspectRatio);
      const intensity = Math.min(1, energy) * verticalMask;
      if (intensity < INTENSITY_FLOOR) {
        continue;
      }
      const glyphIndex = Math.min(
        FIELD_GLYPH_RAMP.length - 1,
        Math.floor(intensity * FIELD_GLYPH_RAMP.length),
      );
      litCellList.push({
        columnIndex,
        rowIndex,
        glyph: FIELD_GLYPH_RAMP.charAt(glyphIndex),
        inkAlpha: MINIMUM_INK_ALPHA + intensity * (MAXIMUM_INK_ALPHA - MINIMUM_INK_ALPHA),
      });
    }
  }
  return litCellList;
}
