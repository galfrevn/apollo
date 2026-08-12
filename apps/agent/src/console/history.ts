export type ConsoleHistoryTurn = {
  readonly id: string;
  readonly role: string;
  readonly text: string;
};

type SessionMessageLike = {
  readonly id: string;
  readonly role: string;
  readonly parts: readonly { readonly type: string; readonly text?: string }[];
};

export function mapSessionMessagesToConsoleHistory(
  messageList: readonly SessionMessageLike[],
): readonly ConsoleHistoryTurn[] {
  const turnList: ConsoleHistoryTurn[] = [];
  for (const message of messageList) {
    const text = message.parts
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n')
      .trim();
    if (text.length === 0) {
      continue;
    }
    turnList.push({ id: message.id, role: message.role, text });
  }
  return turnList;
}
