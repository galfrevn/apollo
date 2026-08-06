import type { DeskFocusState } from '@/focus/logic';
import { recallMemoryRecords, type MemorySqlExecutor } from '@/memory/store';
import { APOLLO_TTS_VOICE, buildApolloSoulPrompt } from '@/persona/soul';
import type { DeskUiEventName } from '@/session/machine';
import { executeToolByName, resolvePendingToolConfirmation } from '@/tools/router';
import type {
  DeskToolEffects,
  PendingToolConfirmation,
  ToolDefinition,
  ToolExecutionResult,
} from '@/tools/types';
import { mapToolNameToThinkingCaption } from '@/turn/caption';
import { buildOpenRouterSystemPrompt, type OpenRouterChatMessage } from '@/voice/llm';

const DEFAULT_MAX_TOOL_ROUND_COUNT = 3;

export type VoiceAdapters = {
  readonly stt: (audioBuffer: ArrayBuffer) => Promise<string>;
  readonly llm: (input: {
    readonly messageList: readonly OpenRouterChatMessage[];
    readonly toolDefinitionList: readonly {
      readonly name: string;
      readonly description: string;
      readonly parameters: Record<string, unknown>;
    }[];
  }) => Promise<{
    readonly text: string;
    readonly toolCallList: readonly {
      readonly id: string;
      readonly name: string;
      readonly args: unknown;
    }[];
  }>;
  readonly tts: (text: string, voiceId: string) => Promise<ArrayBuffer>;
};

export type TurnInput = {
  readonly audioBuffer?: ArrayBuffer;
  readonly text?: string;
  readonly speechMode: string;
  readonly focusState: DeskFocusState;
  readonly sqlExecutor: MemorySqlExecutor;
  readonly environment: Env;
  readonly adapters: VoiceAdapters;
  readonly toolDefinitionMap: ReadonlyMap<string, ToolDefinition>;
  readonly pendingConfirmation?: PendingToolConfirmation;
  readonly confirmOk?: boolean;
  readonly nowMilliseconds: number;
  readonly deviceId?: string;
  readonly systemPromptOverride?: string;
  readonly semanticMemoryContentList?: readonly string[];
  readonly effects?: DeskToolEffects;
  readonly maxToolRoundCount?: number;
  readonly onThinkingCaption?: (caption: string) => void | Promise<void>;
};

export type TurnOutput = {
  readonly uiEventList: readonly DeskUiEventName[];
  readonly spokenText: string;
  readonly ttsAudio?: ArrayBuffer;
  readonly pendingConfirmation?: PendingToolConfirmation;
  readonly speechMode: string;
  readonly focusState: DeskFocusState;
  readonly memoryContentList: readonly string[];
  readonly toolResultList: readonly ToolExecutionResult[];
};

function buildToolDefinitionListFromMap(
  toolDefinitionMap: ReadonlyMap<string, ToolDefinition>,
): readonly {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}[] {
  return [...toolDefinitionMap.values()].map((toolDefinition) => ({
    name: toolDefinition.name,
    description: toolDefinition.description,
    parameters: toolDefinition.parameters,
  }));
}

function buildAssistantToolCallMessage(
  llmText: string,
  toolCallList: readonly {
    readonly id: string;
    readonly name: string;
    readonly args: unknown;
  }[],
): OpenRouterChatMessage {
  return {
    role: 'assistant',
    content: llmText.trim().length > 0 ? llmText : null,
    tool_calls: toolCallList.map((toolCall) => ({
      id: toolCall.id,
      type: 'function' as const,
      function: {
        name: toolCall.name,
        arguments: JSON.stringify(toolCall.args),
      },
    })),
  };
}

function buildToolResultMessage(
  toolCallId: string,
  toolResult: ToolExecutionResult,
): OpenRouterChatMessage {
  return {
    role: 'tool',
    tool_call_id: toolCallId,
    content: JSON.stringify(toolResult),
  };
}

export async function runDeskTurn(input: TurnInput): Promise<TurnOutput> {
  const uiEventList: DeskUiEventName[] = ['START_THINK'];
  const toolResultList: ToolExecutionResult[] = [];
  let pendingConfirmation = input.pendingConfirmation;

  if (pendingConfirmation !== undefined && input.confirmOk !== undefined) {
    const resolved = await resolvePendingToolConfirmation(
      input.toolDefinitionMap,
      pendingConfirmation,
      input.confirmOk,
      {
        environment: input.environment,
        nowMilliseconds: input.nowMilliseconds,
        deviceId: input.deviceId,
        effects: input.effects,
      },
    );
    pendingConfirmation = undefined;
    if ('cancelled' in resolved) {
      uiEventList.push('CANCEL');
      return {
        uiEventList,
        spokenText: 'Cancelado.',
        speechMode: input.speechMode,
        focusState: input.focusState,
        memoryContentList: [],
        toolResultList,
      };
    }
    toolResultList.push(resolved);
  }

  let userText = input.text?.trim() ?? '';
  if (userText.length === 0 && input.audioBuffer !== undefined) {
    userText = await input.adapters.stt(input.audioBuffer);
  }
  if (userText.length === 0) {
    uiEventList.push('CANCEL');
    return {
      uiEventList,
      spokenText: 'No te escuché.',
      speechMode: input.speechMode,
      focusState: input.focusState,
      memoryContentList: [],
      toolResultList,
    };
  }

  await input.onThinkingCaption?.('Pensando…');

  const recalledMemoryList = await recallMemoryRecords(input.sqlExecutor, userText, 8);
  const keywordMemoryContentList = recalledMemoryList.map(
    (memoryRecord) => memoryRecord.content,
  );
  const semanticMemoryContentList = input.semanticMemoryContentList ?? [];
  const memoryContentList = [
    ...new Set([...semanticMemoryContentList, ...keywordMemoryContentList]),
  ];
  const systemPrompt =
    input.systemPromptOverride ??
    buildOpenRouterSystemPrompt({
      soulSystemPrompt: buildApolloSoulPrompt(input.speechMode),
      memoryContentList,
      isFocusActive: input.focusState.active,
    });

  const toolDefinitionList = buildToolDefinitionListFromMap(input.toolDefinitionMap);
  const toolExecutionContext = {
    environment: input.environment,
    nowMilliseconds: input.nowMilliseconds,
    deviceId: input.deviceId,
    effects: input.effects,
  };
  const maxToolRoundCount = input.maxToolRoundCount ?? DEFAULT_MAX_TOOL_ROUND_COUNT;

  const messageList: OpenRouterChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userText },
  ];

  let spokenText = '';

  for (let toolRoundIndex = 0; toolRoundIndex < maxToolRoundCount; toolRoundIndex += 1) {
    const llmResult = await input.adapters.llm({
      messageList,
      toolDefinitionList,
    });

    if (llmResult.toolCallList.length === 0) {
      spokenText = llmResult.text.trim();
      break;
    }

    messageList.push(
      buildAssistantToolCallMessage(llmResult.text, llmResult.toolCallList),
    );

    for (const toolCall of llmResult.toolCallList) {
      await input.onThinkingCaption?.(mapToolNameToThinkingCaption(toolCall.name));
      const outcome = await executeToolByName(
        input.toolDefinitionMap,
        toolCall.name,
        toolCall.args,
        toolExecutionContext,
      );
      if (outcome.status === 'needs_confirm') {
        uiEventList.push('NEED_CONFIRM');
        return {
          uiEventList,
          spokenText: outcome.pending.summary,
          pendingConfirmation: outcome.pending,
          speechMode: input.speechMode,
          focusState: input.focusState,
          memoryContentList,
          toolResultList,
        };
      }
      toolResultList.push(outcome.result);
      messageList.push(buildToolResultMessage(toolCall.id, outcome.result));
    }

    if (toolRoundIndex === maxToolRoundCount - 1) {
      spokenText = llmResult.text.trim();
    }
  }

  if (spokenText.length === 0) {
    spokenText = toolResultList.map((result) => result.summary).join(' ');
  }

  uiEventList.push('START_SPEAK');
  const ttsAudio = await input.adapters.tts(spokenText, APOLLO_TTS_VOICE);
  uiEventList.push('SPEAK_DONE');

  return {
    uiEventList,
    spokenText,
    ttsAudio,
    speechMode: input.speechMode,
    focusState: input.focusState,
    memoryContentList,
    toolResultList,
  };
}
