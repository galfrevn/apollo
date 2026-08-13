export type LandingFaceEmotionName = 'neutral' | 'curious' | 'focused' | 'talking';

export interface FaceEmotionParameters {
  readonly eyeHeightRatio: number;
  readonly eyeLiftRatio: number;
  readonly eyeWidthRatio: number;
  readonly talkingPulseAmplitude: number;
}

export const FACE_EMOTION_CATALOG = {
  neutral: {
    eyeHeightRatio: 1,
    eyeLiftRatio: 0,
    eyeWidthRatio: 1,
    talkingPulseAmplitude: 0,
  },
  curious: {
    eyeHeightRatio: 1.18,
    eyeLiftRatio: 0.55,
    eyeWidthRatio: 0.96,
    talkingPulseAmplitude: 0,
  },
  focused: {
    eyeHeightRatio: 0.42,
    eyeLiftRatio: -0.15,
    eyeWidthRatio: 1.06,
    talkingPulseAmplitude: 0,
  },
  talking: {
    eyeHeightRatio: 0.88,
    eyeLiftRatio: 0.1,
    eyeWidthRatio: 1,
    talkingPulseAmplitude: 0.4,
  },
} satisfies Record<LandingFaceEmotionName, FaceEmotionParameters>;
