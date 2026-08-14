import { describe, expect, it } from 'bun:test';

import {
  FIELD_GLYPH_RAMP,
  RIPPLE_LIFETIME_SECONDS,
  computeRippleContribution,
  computeVerticalMask,
  pruneRippleList,
  rasterizeFieldFrame,
} from '@/landing/field/geometry';

import type { FieldRenderState, FieldRipple } from '@/landing/field/geometry';

const COLUMN_COUNT = 60;
const ROW_COUNT = 34;

function buildRenderState(overrides: Partial<FieldRenderState> = {}): FieldRenderState {
  return {
    elapsedSeconds: 0,
    pointerX: 0.5,
    pointerY: 0.5,
    pointerPresence: 0,
    rippleList: [],
    ...overrides,
  };
}

function buildRipple(overrides: Partial<FieldRipple> = {}): FieldRipple {
  return { originX: 0.5, originY: 0.25, emittedSeconds: 0, strength: 1, ...overrides };
}

describe('computeVerticalMask', () => {
  it('keeps the top edge clear of the navigation row', () => {
    expect(computeVerticalMask(0)).toBe(0);
    expect(computeVerticalMask(0.16)).toBeGreaterThan(0.9);
  });

  it('thins to a residue under the headline without cutting off', () => {
    const residualMask = computeVerticalMask(0.95);
    expect(residualMask).toBeGreaterThan(0);
    expect(residualMask).toBeLessThan(0.25);
  });

  it('never brightens again once it starts fading', () => {
    let previousMask = computeVerticalMask(0.28);
    for (let step = 29; step <= 100; step++) {
      const currentMask = computeVerticalMask(step / 100);
      expect(currentMask).toBeLessThanOrEqual(previousMask + Number.EPSILON);
      previousMask = currentMask;
    }
  });
});

describe('computeRippleContribution', () => {
  it('contributes nothing before emission or after its lifetime', () => {
    const ripple = buildRipple({ emittedSeconds: 2 });
    expect(computeRippleContribution(ripple, 1.9, 0.5, 0.25, 1)).toBe(0);
    expect(
      computeRippleContribution(ripple, 2 + RIPPLE_LIFETIME_SECONDS + 0.1, 0.5, 0.25, 1),
    ).toBe(0);
  });

  it('peaks on the wavefront rather than at the origin', () => {
    const ripple = buildRipple();
    const originEnergy = computeRippleContribution(ripple, 2, 0.5, 0.25, 1);
    const wavefrontEnergy = computeRippleContribution(ripple, 2, 0.5, 0.25 + 0.6, 1);
    expect(wavefrontEnergy).toBeGreaterThan(originEnergy);
  });

  it('scales the origin into field space so the front stays circular', () => {
    const ripple = buildRipple({ originX: 0.5, originY: 0.5 });
    const aspectRatio = 2;
    const horizontalEnergy = computeRippleContribution(
      ripple,
      2,
      1 + 0.6,
      0.5,
      aspectRatio,
    );
    const verticalEnergy = computeRippleContribution(
      ripple,
      2,
      1,
      0.5 + 0.6,
      aspectRatio,
    );
    expect(horizontalEnergy).toBeCloseTo(verticalEnergy, 10);
  });
});

describe('pruneRippleList', () => {
  it('drops only the ripples past their lifetime', () => {
    const liveRipple = buildRipple({ emittedSeconds: 8 });
    const staleRipple = buildRipple({ emittedSeconds: 1 });
    expect(pruneRippleList([liveRipple, staleRipple], 9)).toEqual([liveRipple]);
  });
});

describe('rasterizeFieldFrame', () => {
  it('emits only glyphs from the ramp inside the grid bounds', () => {
    const litCellList = rasterizeFieldFrame(
      buildRenderState({ rippleList: [buildRipple()], elapsedSeconds: 2 }),
      COLUMN_COUNT,
      ROW_COUNT,
    );
    expect(litCellList.length).toBeGreaterThan(0);
    for (const cell of litCellList) {
      expect(FIELD_GLYPH_RAMP).toContain(cell.glyph);
      expect(cell.columnIndex).toBeLessThan(COLUMN_COUNT);
      expect(cell.rowIndex).toBeLessThan(ROW_COUNT);
      expect(cell.inkAlpha).toBeGreaterThan(0);
      expect(cell.inkAlpha).toBeLessThanOrEqual(0.6);
    }
  });

  it('lights more cells with a ripple crossing than with the ambient wash alone', () => {
    const ambientCellCount = rasterizeFieldFrame(
      buildRenderState({ elapsedSeconds: 2 }),
      COLUMN_COUNT,
      ROW_COUNT,
    ).length;
    const rippledCellCount = rasterizeFieldFrame(
      buildRenderState({ elapsedSeconds: 2, rippleList: [buildRipple()] }),
      COLUMN_COUNT,
      ROW_COUNT,
    ).length;
    expect(rippledCellCount).toBeGreaterThan(ambientCellCount);
  });

  it('brightens around the pointer when it is present', () => {
    const restingCellCount = rasterizeFieldFrame(
      buildRenderState({ elapsedSeconds: 2, pointerY: 0.2 }),
      COLUMN_COUNT,
      ROW_COUNT,
    ).length;
    const trackedCellCount = rasterizeFieldFrame(
      buildRenderState({ elapsedSeconds: 2, pointerY: 0.2, pointerPresence: 1 }),
      COLUMN_COUNT,
      ROW_COUNT,
    ).length;
    expect(trackedCellCount).toBeGreaterThan(restingCellCount);
  });

  it('returns nothing for a degenerate grid', () => {
    expect(rasterizeFieldFrame(buildRenderState(), 0, 0)).toEqual([]);
  });
});
