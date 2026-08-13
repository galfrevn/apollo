import { describe, expect, it } from 'bun:test';

import {
  FACE_GLYPH_CHARACTER_SET,
  computeCellGlyph,
  rasterizeFaceFrame,
} from '@/landing/face/geometry';

import type { FaceRenderState } from '@/landing/face/geometry';

const GRID_RESOLUTION = 40;

function buildRenderState(overrides: Partial<FaceRenderState> = {}): FaceRenderState {
  return {
    eyeHeightRatio: 1,
    eyeLiftRatio: 0,
    eyeWidthRatio: 1,
    talkingPulseAmplitude: 0,
    blinkProgress: 0,
    pupilOffsetX: 0,
    pupilOffsetY: 0,
    revealProgress: 1,
    ...overrides,
  };
}

function toCellKeySet(cellList: readonly { columnIndex: number; rowIndex: number }[]) {
  return new Set(cellList.map((cell) => `${cell.columnIndex}:${cell.rowIndex}`));
}

describe('rasterizeFaceFrame', () => {
  it('renders a horizontally symmetric neutral mark', () => {
    const litCellSet = toCellKeySet(
      rasterizeFaceFrame(buildRenderState(), 'mark', GRID_RESOLUTION),
    );
    for (const cellKey of litCellSet) {
      const [columnText, rowText] = cellKey.split(':');
      const mirroredKey = `${GRID_RESOLUTION - 1 - Number(columnText)}:${rowText}`;
      expect(litCellSet.has(mirroredKey)).toBe(true);
    }
  });

  it('fills more of the mark when the eyes blink closed', () => {
    const openCellCount = rasterizeFaceFrame(
      buildRenderState({ blinkProgress: 0 }),
      'mark',
      GRID_RESOLUTION,
    ).length;
    const closedCellCount = rasterizeFaceFrame(
      buildRenderState({ blinkProgress: 1 }),
      'mark',
      GRID_RESOLUTION,
    ).length;
    expect(closedCellCount).toBeGreaterThan(openCellCount);
  });

  it('clamps pupil offsets beyond the unit range', () => {
    const clampedFrame = rasterizeFaceFrame(
      buildRenderState({ pupilOffsetX: 1, pupilOffsetY: 1 }),
      'mark',
      GRID_RESOLUTION,
    );
    const overshootFrame = rasterizeFaceFrame(
      buildRenderState({ pupilOffsetX: 5, pupilOffsetY: 9 }),
      'mark',
      GRID_RESOLUTION,
    );
    expect(toCellKeySet(overshootFrame)).toEqual(toCellKeySet(clampedFrame));
  });

  it('reveals cells monotonically as revealProgress grows', () => {
    const quarterSet = toCellKeySet(
      rasterizeFaceFrame(buildRenderState({ revealProgress: 0.25 }), 'mark'),
    );
    const halfSet = toCellKeySet(
      rasterizeFaceFrame(buildRenderState({ revealProgress: 0.5 }), 'mark'),
    );
    const fullSet = toCellKeySet(
      rasterizeFaceFrame(buildRenderState({ revealProgress: 1 }), 'mark'),
    );
    expect(quarterSet.size).toBeGreaterThan(0);
    expect(halfSet.size).toBeGreaterThan(quarterSet.size);
    expect(fullSet.size).toBeGreaterThan(halfSet.size);
    for (const cellKey of quarterSet) {
      expect(halfSet.has(cellKey)).toBe(true);
    }
    for (const cellKey of halfSet) {
      expect(fullSet.has(cellKey)).toBe(true);
    }
  });

  it('assigns every cell a stable glyph from the character set', () => {
    for (let rowIndex = 0; rowIndex < GRID_RESOLUTION; rowIndex++) {
      for (let columnIndex = 0; columnIndex < GRID_RESOLUTION; columnIndex++) {
        const glyph = computeCellGlyph(columnIndex, rowIndex);
        expect(FACE_GLYPH_CHARACTER_SET).toContain(glyph);
        expect(computeCellGlyph(columnIndex, rowIndex)).toBe(glyph);
      }
    }
  });

  it('crops screen mode so the eyes fill most of the canvas', () => {
    const screenCellList = rasterizeFaceFrame(
      buildRenderState(),
      'screen',
      GRID_RESOLUTION,
    );
    expect(screenCellList.length).toBeGreaterThan(0);
    const columnIndexList = screenCellList.map((cell) => cell.columnIndex);
    const boundingWidth = Math.max(...columnIndexList) - Math.min(...columnIndexList) + 1;
    expect(boundingWidth).toBeGreaterThan(GRID_RESOLUTION * 0.7);
  });
});
