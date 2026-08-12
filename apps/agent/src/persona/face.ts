import type { DeskFaceEmotionName } from '@/protocol/schema';
import type { DeskUiStateName } from '@/protocol/schema';

const deskUiStateToFaceEmotionMap: Record<DeskUiStateName, DeskFaceEmotionName> = {
  idle: 'neutral',
  listening: 'curious',
  thinking: 'focused',
  confirm: 'questioning',
  speaking: 'talking',
  focus: 'calm',
  dashboard: 'neutral',
};

export function resolveDeskFaceEmotion(uiState: DeskUiStateName): DeskFaceEmotionName {
  return deskUiStateToFaceEmotionMap[uiState];
}
