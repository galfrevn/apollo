import type { DeskFocusState } from '@/focus/logic';
import { recallMemoryRecords, type MemorySqlExecutor } from '@/memory/store';
import { buildCurrentTimePromptNote } from '@/persona/clock';
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
import {
  buildOpenRouterSystemPrompt,
  buildSemanticMemoryPromptNote,
  type OpenRouterChatMessage,
  type OpenRouterToolCall,
} from '@/voice/llm';
import { sanitizeTextForSpeech } from '@/voice/sanitize';
import {
  SPEECH_SEGMENT_MAX_CHARACTER_COUNT,
  splitTextIntoSpeechSegmentList,
} from '@/voice/segment';

const DEFAULT_MAX_TOOL_ROUND_COUNT = 3;

export type LanguageModelToolDescriptor = {
  readonly name: string;
  readonly description: string;
  readonly parameters: ToolDefinition['parameters'];
};

export type VoiceAdapters = {
  readonly stt: (audioBuffer: ArrayBuffer) => Promise<string>;
  readonly llm: (input: {
    readonly messageList: readonly OpenRouterChatMessage[];
    readonly toolDefinitionList: readonly LanguageModelToolDescriptor[];
    // Optional streaming hook: adapters that support it push content deltas
    // as they arrive so the turn can start synthesizing speech early.
    readonly onTextDelta?: (deltaText: string) => void;
  }) => Promise<{
    readonly text: string;
    readonly toolCallList: readonly OpenRouterToolCall[];
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
  readonly recentHistoryMessageList?: readonly OpenRouterChatMessage[];
  readonly recallSemanticMemoryContentList?: (
    queryText: string,
  ) => Promise<readonly string[]>;
  readonly effects?: DeskToolEffects;
  readonly maxToolRoundCount?: number;
  readonly onThinkingCaption?: (caption: string) => void | Promise<void>;
};

export type TurnOutput = {
  readonly uiEventList: readonly DeskUiEventName[];
  readonly transcript: string;
  readonly spokenText: string;
  readonly ttsAudio?: ArrayBuffer;
  // Segments after the first, still as text: the caller synthesizes them while
  // the device is already playing ttsAudio, hiding synthesis latency.
  readonly ttsFollowUpSegmentTextList?: readonly string[];
  readonly pendingConfirmation?: PendingToolConfirmation;
  readonly speechMode: string;
  readonly focusState: DeskFocusState;
  readonly memoryContentList: readonly string[];
  readonly toolResultList: readonly ToolExecutionResult[];
  readonly executedToolCallList: readonly {
    readonly name: string;
    readonly summary: string;
  }[];
  // Whether the reply asks the user for something, so the device should
  // reopen the mic after speaking instead of returning to idle.
  readonly expectsReply: boolean;
};

function buildToolDefinitionListFromMap(
  toolDefinitionMap: ReadonlyMap<string, ToolDefinition>,
): readonly LanguageModelToolDescriptor[] {
  return [...toolDefinitionMap.values()].map((toolDefinition) => ({
    name: toolDefinition.name,
    description: toolDefinition.description,
    parameters: toolDefinition.parameters,
  }));
}

function buildAssistantToolCallMessage(
  llmText: string,
  toolCallList: readonly OpenRouterToolCall[],
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
  const executedToolCallList: { name: string; summary: string }[] = [];
  let pendingConfirmation = input.pendingConfirmation;
  let resolvedConfirmation: PendingToolConfirmation | undefined;
  let resolvedConfirmationResult: ToolExecutionResult | undefined;

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
    if (!('cancelled' in resolved)) {
      resolvedConfirmation = pendingConfirmation;
      resolvedConfirmationResult = resolved;
      executedToolCallList.push({
        name: pendingConfirmation.toolName,
        summary: resolved.summary,
      });
    }
    pendingConfirmation = undefined;
    if ('cancelled' in resolved) {
      uiEventList.push('CANCEL');
      return {
        uiEventList,
        transcript: input.text?.trim() ?? '',
        spokenText: 'Cancelado.',
        speechMode: input.speechMode,
        focusState: input.focusState,
        memoryContentList: [],
        toolResultList,
        executedToolCallList,
        expectsReply: false,
      };
    }
    toolResultList.push(resolved);
  }

  let userText = input.text?.trim() ?? '';
  if (userText.length === 0 && input.audioBuffer !== undefined) {
    userText = (await input.adapters.stt(input.audioBuffer)).trim();
  }
  if (userText.length === 0) {
    uiEventList.push('CANCEL');
    return {
      uiEventList,
      transcript: '',
      spokenText: 'No te escuché.',
      speechMode: input.speechMode,
      focusState: input.focusState,
      memoryContentList: [],
      toolResultList,
      executedToolCallList,
      expectsReply: false,
    };
  }

  await input.onThinkingCaption?.('Pensando…');

  const recalledMemoryList = await recallMemoryRecords(input.sqlExecutor, userText, 8);
  const keywordMemoryContentList = recalledMemoryList.map(
    (memoryRecord) => memoryRecord.content,
  );
  const semanticMemoryContentList =
    (await input.recallSemanticMemoryContentList?.(userText)) ?? [];
  const memoryContentList = [
    ...new Set([...semanticMemoryContentList, ...keywordMemoryContentList]),
  ];
  const systemPromptBase =
    input.systemPromptOverride === undefined
      ? buildOpenRouterSystemPrompt({
          soulSystemPrompt: buildApolloSoulPrompt(input.speechMode),
          memoryContentList,
          isFocusActive: input.focusState.active,
        })
      : input.systemPromptOverride +
        buildSemanticMemoryPromptNote(semanticMemoryContentList);
  const systemPrompt =
    systemPromptBase + buildCurrentTimePromptNote(input.nowMilliseconds);

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
    ...(input.recentHistoryMessageList ?? []),
    { role: 'user', content: userText },
  ];
  if (resolvedConfirmation !== undefined && resolvedConfirmationResult !== undefined) {
    messageList.push(
      buildAssistantToolCallMessage('', [
        {
          id: resolvedConfirmation.id,
          name: resolvedConfirmation.toolName,
          args: resolvedConfirmation.args ?? null,
        },
      ]),
      buildToolResultMessage(resolvedConfirmation.id, resolvedConfirmationResult),
    );
  }

  let spokenText = '';

  // While the reply streams in, the first sentence-sized segment is closed as
  // soon as more text follows it — synthesis starts right then, overlapping
  // the rest of the generation. If the round turns out to be a tool call, the
  // speculation is discarded (its text was never going to be spoken).
  let speculativeSegment:
    | {
        readonly text: string;
        readonly audioPromise: Promise<ArrayBuffer | undefined>;
      }
    | undefined;
  let streamedRoundText = '';

  for (let toolRoundIndex = 0; toolRoundIndex < maxToolRoundCount; toolRoundIndex += 1) {
    streamedRoundText = '';
    const llmResult = await input.adapters.llm({
      messageList,
      toolDefinitionList,
      onTextDelta: (deltaText) => {
        if (speculativeSegment !== undefined) {
          return;
        }
        streamedRoundText += deltaText;
        if (streamedRoundText.length <= SPEECH_SEGMENT_MAX_CHARACTER_COUNT) {
          return;
        }
        const partialSegmentList = splitTextIntoSpeechSegmentList(
          sanitizeTextForSpeech(streamedRoundText),
        );
        if (partialSegmentList.length < 2) {
          return;
        }
        const firstClosedSegmentText = partialSegmentList[0];
        speculativeSegment = {
          text: firstClosedSegmentText,
          audioPromise: input.adapters
            .tts(firstClosedSegmentText, APOLLO_TTS_VOICE)
            .catch(() => undefined),
        };
      },
    });

    if (llmResult.toolCallList.length === 0) {
      spokenText = llmResult.text.trim();
      break;
    }

    speculativeSegment = undefined;

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
          transcript: userText,
          spokenText: outcome.pending.summary,
          pendingConfirmation: outcome.pending,
          speechMode: input.speechMode,
          focusState: input.focusState,
          memoryContentList,
          toolResultList,
          executedToolCallList,
          expectsReply: false,
        };
      }
      toolResultList.push(outcome.result);
      executedToolCallList.push({
        name: toolCall.name,
        summary: outcome.result.summary,
      });
      messageList.push(buildToolResultMessage(toolCall.id, outcome.result));
    }

    if (toolRoundIndex === maxToolRoundCount - 1) {
      spokenText = llmResult.text.trim();
    }
  }

  if (spokenText.length === 0) {
    spokenText = toolResultList.map((result) => result.summary).join(' ');
  }
  // The model appends [[escucho]] when its reply asks the user for something;
  // a reply that ends in a question counts even if the model forgot the mark.
  const hasListenMark = /\[\[escucho\]\]/i.test(spokenText);
  spokenText = spokenText.replace(/\s*\[\[escucho\]\]\s*/gi, ' ').trim();
  const expectsReply = hasListenMark || /\?\s*$/.test(spokenText);
  spokenText = sanitizeTextForSpeech(spokenText);

  const [firstSegmentText, ...ttsFollowUpSegmentTextList] =
    splitTextIntoSpeechSegmentList(spokenText);
  const targetFirstSegmentText = firstSegmentText ?? spokenText;

  uiEventList.push('START_SPEAK');
  const speculativeAudio =
    speculativeSegment !== undefined && speculativeSegment.text === targetFirstSegmentText
      ? await speculativeSegment.audioPromise
      : undefined;
  const ttsAudio =
    speculativeAudio ??
    (await input.adapters.tts(targetFirstSegmentText, APOLLO_TTS_VOICE));
  uiEventList.push('SPEAK_DONE');

  return {
    uiEventList,
    transcript: userText,
    spokenText,
    ttsAudio,
    ttsFollowUpSegmentTextList,
    speechMode: input.speechMode,
    focusState: input.focusState,
    memoryContentList,
    toolResultList,
    executedToolCallList,
    expectsReply,
  };
}
