import type { DeskFaceEmotionName } from '@/protocol/schema';
import type { DeskUiStateName } from '@/protocol/schema';

const deskUiStateToFaceEmotionMap = {
  idle: 'neutral',
  listening: 'curious',
  thinking: 'focused',
  confirm: 'questioning',
  speaking: 'talking',
  focus: 'calm',
  dashboard: 'neutral',
} satisfies Record<DeskUiStateName, DeskFaceEmotionName>;

export function resolveDeskFaceEmotion(uiState: DeskUiStateName): DeskFaceEmotionName {
  return deskUiStateToFaceEmotionMap[uiState];
}
