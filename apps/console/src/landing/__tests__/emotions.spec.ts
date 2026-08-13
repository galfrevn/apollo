import { describe, expect, it } from 'bun:test';

import { FACE_EMOTION_CATALOG } from '@/landing/face/emotions';

const AGENT_FACE_EMOTION_NAME_LIST = [
  'neutral',
  'curious',
  'focused',
  'questioning',
  'talking',
  'calm',
];

describe('FACE_EMOTION_CATALOG', () => {
  it('only uses emotion names the agent protocol defines', () => {
    for (const emotionName of Object.keys(FACE_EMOTION_CATALOG)) {
      expect(AGENT_FACE_EMOTION_NAME_LIST).toContain(emotionName);
    }
  });

  it('keeps every parameter within renderable bounds', () => {
    for (const parameters of Object.values(FACE_EMOTION_CATALOG)) {
      expect(parameters.eyeHeightRatio).toBeGreaterThan(0.2);
      expect(parameters.eyeHeightRatio).toBeLessThanOrEqual(1.5);
      expect(Math.abs(parameters.eyeLiftRatio)).toBeLessThanOrEqual(1);
      expect(parameters.eyeWidthRatio).toBeGreaterThan(0.5);
      expect(parameters.eyeWidthRatio).toBeLessThanOrEqual(1.5);
      expect(parameters.talkingPulseAmplitude).toBeGreaterThanOrEqual(0);
      expect(parameters.talkingPulseAmplitude).toBeLessThan(1);
    }
  });

  it('reserves the speech pulse for the talking emotion', () => {
    for (const [emotionName, parameters] of Object.entries(FACE_EMOTION_CATALOG)) {
      if (emotionName === 'talking') {
        expect(parameters.talkingPulseAmplitude).toBeGreaterThan(0);
      } else {
        expect(parameters.talkingPulseAmplitude).toBe(0);
      }
    }
  });
});
