export type ConsoleHistoryTurn = {
  readonly id: string;
  readonly role: string;
  readonly text: string;
  readonly createdAtIso: string | null;
  readonly toolNameList: readonly string[];
};

export type ConsoleThreadSummary = {
  readonly id: string;
  readonly title: string;
  readonly kind: 'pending' | 'command' | 'conversation';
  readonly isActive: boolean;
  readonly summary: string | null;
  readonly lastTurnAtIso: string | null;
};

type SessionMessageTimestamp = Date | string;

type SessionMessageLike = {
  readonly id: string;
  readonly role: string;
  readonly parts: readonly {
    readonly type: string;
    readonly text?: string;
    readonly toolName?: string;
  }[];
  readonly createdAt?: SessionMessageTimestamp;
};

type SessionInfoLike = {
  readonly id: string;
  readonly name: string;
};

type ThreadMetaLike = {
  readonly sessionId: string;
  readonly kind: 'pending' | 'command' | 'conversation';
  readonly summary: string | null;
  readonly lastTurnAtMilliseconds: number;
};

function normalizeMessageCreatedAt(
  createdAtValue: SessionMessageTimestamp | undefined,
): string | null {
  if (createdAtValue instanceof Date) {
    return createdAtValue.toISOString();
  }
  if (createdAtValue !== undefined && createdAtValue.length > 0) {
    return createdAtValue;
  }
  return null;
}

export function mapSessionMessagesToConsoleHistory(
  messageList: readonly SessionMessageLike[],
): readonly ConsoleHistoryTurn[] {
  const turnList: ConsoleHistoryTurn[] = [];
  for (const message of messageList) {
    const text = message.parts
      .filter((part) => part.type === 'text' && part.text !== undefined)
      .map((part) => part.text)
      .join('\n')
      .trim();
    const toolNameList = message.parts
      .filter((part) => part.type === 'tool-call' && part.toolName !== undefined)
      .map((part) => part.toolName)
      .filter((toolName): toolName is string => toolName !== undefined);
    if (text.length === 0 && toolNameList.length === 0) {
      continue;
    }
    turnList.push({
      id: message.id,
      role: message.role,
      text,
      createdAtIso: normalizeMessageCreatedAt(message.createdAt),
      toolNameList,
    });
  }
  return turnList;
}

export function mapThreadCatalogToConsoleThreadList(input: {
  readonly sessionInfoList: readonly SessionInfoLike[];
  readonly threadMetaList: readonly ThreadMetaLike[];
  readonly activeThreadSessionId: string | null;
  readonly hasLegacyHistory: boolean;
  readonly legacySessionId: string;
}): readonly ConsoleThreadSummary[] {
  const metaBySessionId = new Map(
    input.threadMetaList.map((meta) => [meta.sessionId, meta]),
  );
  const summaryList: ConsoleThreadSummary[] = input.sessionInfoList.map((sessionInfo) => {
    const meta = metaBySessionId.get(sessionInfo.id);
    return {
      id: sessionInfo.id,
      title: sessionInfo.name,
      kind: meta?.kind ?? 'pending',
      isActive: sessionInfo.id === input.activeThreadSessionId,
      summary: meta?.summary ?? null,
      lastTurnAtIso:
        meta === undefined || meta.lastTurnAtMilliseconds === 0
          ? null
          : new Date(meta.lastTurnAtMilliseconds).toISOString(),
    };
  });
  if (input.hasLegacyHistory) {
    summaryList.push({
      id: input.legacySessionId,
      title: 'Historial previo a los hilos',
      kind: 'conversation',
      isActive: false,
      summary: null,
      lastTurnAtIso: null,
    });
  }
  return summaryList.toSorted((left, right) => {
    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }
    return (right.lastTurnAtIso ?? '').localeCompare(left.lastTurnAtIso ?? '');
  });
}
