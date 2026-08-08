import type { Connection } from 'agents';
import type { Session } from 'agents/experimental/memory/session';

import type { ApolloState } from '@/agents/apollo';
import { createInactiveDeskFocusState, tickDeskFocus } from '@/focus/logic';
import { buildTtsObjectKey } from '@/media/bucket';
import { buildSessionSystemPrompt } from '@/memory/session';
import type { MemorySqlExecutor } from '@/memory/store';
import { recallSemanticMemoryContent } from '@/memory/vector';
import { resolveDeskSpeechMode } from '@/persona/catalog';
import { resolveDeskFaceEmotion } from '@/persona/face';
import { encodeServerToDeviceMessage } from '@/protocol/schema';
import { cacheTtsInMediaBucket } from '@/queues/consume';
import type { DeskUiMachine } from '@/session/machine';
import { createBuiltinToolDefinitionMap } from '@/tools/catalog';
import type { DeskToolEffects, PendingToolConfirmation } from '@/tools/types';
import { runDeskTurn } from '@/turn/run';
import { chatWithOpenRouter } from '@/voice/llm';
import {
  OPENROUTER_TTS_PCM_CHANNEL_COUNT,
  OPENROUTER_TTS_PCM_SAMPLE_RATE_HZ,
  synthesizeSpeechWithOpenRouter,
} from '@/voice/speech';
import { transcribeAudioWithOpenRouter } from '@/voice/stt';
import { sliceAudioBufferIntoChunkList, wrapPcmAsWavBuffer } from '@/voice/wav';

export type ApolloTurnRuntimeDependencies = {
  readonly environment: Env;
  readonly sqlExecutor: MemorySqlExecutor;
  readonly uiMachine: DeskUiMachine;
  readonly currentState: ApolloState;
  readonly getCurrentState: () => ApolloState;
  readonly setAgentState: (nextState: ApolloState) => void;
  readonly scheduleConfirmExpiry: () => Promise<void>;
  readonly session: Session;
  readonly deviceId: string;
  readonly effects: DeskToolEffects;
};

export async function executeApolloTurn(
  connection: Connection,
  dependencies: ApolloTurnRuntimeDependencies,
  turnPart: {
    readonly text?: string;
    readonly audioBuffer?: ArrayBuffer;
    readonly confirmOk?: boolean;
    readonly pendingConfirmation?: PendingToolConfirmation;
  },
): Promise<PendingToolConfirmation | undefined> {
  const nowMilliseconds = Date.now();
  const focusState = tickDeskFocus(
    dependencies.currentState.focusEndsAt === null
      ? createInactiveDeskFocusState()
      : {
          active: true,
          endsAt: dependencies.currentState.focusEndsAt,
        },
    nowMilliseconds,
  );

  const isMockVoice = dependencies.environment.MOCK_VOICE === '1';
  const sessionSystemPrompt = await buildSessionSystemPrompt(dependencies.session);
  const semanticMemoryContentList = isMockVoice
    ? []
    : await recallSemanticMemoryContent({
        vectorizeIndex: dependencies.environment.VECTORIZE,
        openRouterApiKey: dependencies.environment.OPENROUTER_API_KEY,
        embeddingModelId: dependencies.environment.OPENROUTER_EMBEDDING_MODEL,
        queryText: turnPart.text ?? '',
        deviceId: dependencies.deviceId,
      });

  const focusNote = focusState.active
    ? '\n\nFocus activo: evitá announces ruidosos; sé breve.'
    : '\n\nFocus inactivo.';
  const semanticNote =
    semanticMemoryContentList.length === 0
      ? ''
      : `\n\nRecall semántico (Vectorize):\n${semanticMemoryContentList
          .map((content) => `- ${content}`)
          .join('\n')}`;

  const turnOutput = await runDeskTurn({
    text: turnPart.text,
    audioBuffer: turnPart.audioBuffer,
    speechMode: dependencies.currentState.speechMode,
    focusState,
    sqlExecutor: dependencies.sqlExecutor,
    environment: dependencies.environment,
    toolDefinitionMap: createBuiltinToolDefinitionMap(),
    pendingConfirmation: turnPart.pendingConfirmation,
    confirmOk: turnPart.confirmOk,
    nowMilliseconds,
    deviceId: dependencies.deviceId,
    systemPromptOverride: `${sessionSystemPrompt}${semanticNote}${focusNote}`,
    semanticMemoryContentList,
    effects: dependencies.effects,
    onThinkingCaption: async (caption) => {
      const liveState = dependencies.getCurrentState();
      dependencies.setAgentState({
        ...liveState,
        uiState: 'thinking',
        caption,
      });
      connection.send(
        encodeServerToDeviceMessage({
          type: 'ui_state',
          state: 'thinking',
          speechMode: liveState.speechMode,
          caption,
          emotion: resolveDeskFaceEmotion('thinking'),
          accentColor: resolveDeskSpeechMode(liveState.speechMode).accentColor,
          ...(liveState.focusEndsAt !== null
            ? {
                focusRemainingSec: Math.max(
                  0,
                  Math.ceil((liveState.focusEndsAt - Date.now()) / 1000),
                ),
              }
            : {}),
        }),
      );
    },
    adapters: isMockVoice
      ? {
          stt: async () => turnPart.text ?? 'hola',
          llm: async ({ messageList }) => {
            const userMessage = messageList.find((message) => message.role === 'user');
            const userText = userMessage?.role === 'user' ? userMessage.content : '';
            return {
              text: `Mock: ${userText}`,
              toolCallList: [],
            };
          },
          tts: async (text) => new TextEncoder().encode(text).buffer,
        }
      : {
          stt: async (audioBuffer) =>
            transcribeAudioWithOpenRouter({
              audioBuffer: wrapPcmAsWavBuffer({ pcmBuffer: audioBuffer }),
              openRouterApiKey: dependencies.environment.OPENROUTER_API_KEY,
              modelId: dependencies.environment.OPENROUTER_STT_MODEL,
            }),
          llm: async ({ messageList, toolDefinitionList }) =>
            chatWithOpenRouter({
              openRouterApiKey: dependencies.environment.OPENROUTER_API_KEY,
              modelId: dependencies.environment.OPENROUTER_MODEL,
              messageList,
              toolDefinitionList,
            }),
          tts: async (text, voiceId) =>
            synthesizeSpeechWithOpenRouter({
              text,
              voiceId,
              openRouterApiKey: dependencies.environment.OPENROUTER_API_KEY,
              modelId: dependencies.environment.OPENROUTER_TTS_MODEL,
              responseFormat: 'pcm',
            }),
        },
  });

  for (const uiEventName of turnOutput.uiEventList) {
    dependencies.uiMachine.transition(uiEventName);
  }

  if (turnOutput.pendingConfirmation !== undefined) {
    await dependencies.scheduleConfirmExpiry();
  }

  // `set_focus`/`clear_focus` tool effects (see @/agents/effects) may have
  // updated focusEndsAt on the live agent state mid-turn, ahead of the
  // uiEventList replay above. Reconcile against that live value instead of
  // the pre-turn snapshot so the tool's change isn't clobbered below, while
  // still honoring the tick-based expiry computed into turnOutput.focusState
  // when no focus tool ran this turn.
  const liveState = dependencies.getCurrentState();
  const focusChangedDuringTurn =
    liveState.focusEndsAt !== dependencies.currentState.focusEndsAt;
  const finalFocusEndsAt = focusChangedDuringTurn
    ? liveState.focusEndsAt
    : turnOutput.focusState.endsAt;
  const isFocusActiveNow =
    finalFocusEndsAt !== null && finalFocusEndsAt > nowMilliseconds;

  if (isFocusActiveNow && dependencies.uiMachine.state !== 'focus') {
    dependencies.uiMachine.transition('ENTER_FOCUS');
  } else if (!isFocusActiveNow && dependencies.uiMachine.state === 'focus') {
    dependencies.uiMachine.transition('EXIT_FOCUS');
  }

  dependencies.setAgentState({
    ...liveState,
    uiState: dependencies.uiMachine.state,
    caption: turnOutput.spokenText,
    pendingConfirmId: turnOutput.pendingConfirmation?.id ?? null,
    pendingConfirmSummary: turnOutput.pendingConfirmation?.summary ?? null,
    focusEndsAt: finalFocusEndsAt,
  });

  if (turnOutput.pendingConfirmation !== undefined) {
    connection.send(
      encodeServerToDeviceMessage({
        type: 'confirm_request',
        id: turnOutput.pendingConfirmation.id,
        summary: turnOutput.pendingConfirmation.summary,
        expiresAt: turnOutput.pendingConfirmation.expiresAt,
      }),
    );
  }

  if (turnOutput.ttsAudio !== undefined) {
    const turnIdentifier = crypto.randomUUID();
    const objectKey = buildTtsObjectKey(dependencies.deviceId, turnIdentifier);
    if (!isMockVoice) {
      await cacheTtsInMediaBucket(dependencies.environment, {
        objectKey,
        audioBuffer: turnOutput.ttsAudio,
      });
    }
    connection.send(
      encodeServerToDeviceMessage({
        type: 'tts_start',
        format: 'pcm',
        bytes: turnOutput.ttsAudio.byteLength,
        sampleRate: OPENROUTER_TTS_PCM_SAMPLE_RATE_HZ,
        channels: OPENROUTER_TTS_PCM_CHANNEL_COUNT,
      }),
    );
    for (const audioChunk of sliceAudioBufferIntoChunkList(turnOutput.ttsAudio)) {
      connection.send(audioChunk);
    }
  }

  if (turnPart.text !== undefined && turnPart.text.length > 0) {
    await dependencies.session.appendMessage({
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: turnPart.text }],
    });
    await dependencies.session.appendMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      parts: [{ type: 'text', text: turnOutput.spokenText }],
    });
  }

  return turnOutput.pendingConfirmation;
}

export function concatenateArrayBufferList(
  arrayBufferList: readonly ArrayBuffer[],
): ArrayBuffer {
  const totalByteLength = arrayBufferList.reduce(
    (sum, buffer) => sum + buffer.byteLength,
    0,
  );
  const mergedBytes = new Uint8Array(totalByteLength);
  let offset = 0;
  for (const buffer of arrayBufferList) {
    mergedBytes.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }
  return mergedBytes.buffer;
}
