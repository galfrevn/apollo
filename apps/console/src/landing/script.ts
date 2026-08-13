export interface ConversationTurn {
  readonly speakerLabel: string;
  readonly spokenText: string;
  readonly isReply: boolean;
}

export const CONVERSATION_TURN_LIST: readonly ConversationTurn[] = [
  {
    speakerLabel: 'Wake word',
    spokenText: '“Hey, Apollo.”',
    isReply: false,
  },
  {
    speakerLabel: 'You',
    spokenText: '“What’s left on my list for today?”',
    isReply: false,
  },
  {
    speakerLabel: 'Apollo',
    spokenText: '“Two things: the design review, and watering the plant behind you.”',
    isReply: true,
  },
];
