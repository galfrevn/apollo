import type { Connection } from 'agents';
import type { Session } from 'agents/experimental/memory/session';

import type { ApolloState } from '@/agents/apollo';
import { resolveApolloConfiguration } from '@/configuration/resolve';
import { createInactiveDeskFocusState, tickDeskFocus } from '@/focus/logic';
import { buildSessionSystemPrompt } from '@/memory/session';
import type { MemorySqlExecutor } from '@/memory/store';
import { recallSemanticMemoryContent } from '@/memory/vector';
import { resolveDeskSpeechMode } from '@/persona/catalog';
import { resolveDeskFaceEmotion } from '@/persona/face';
import { APOLLO_TTS_VOICE } from '@/persona/soul';
import { encodeServerToDeviceMessage } from '@/protocol/schema';
import type { DeskUiMachine } from '@/session/machine';
import { buildTelemetryPromptNote, type DeskTelemetrySnapshot } from '@/telemetry/logic';
import { createBuiltinToolDefinitionMap } from '@/tools/catalog';
import type { DeskToolEffects, PendingToolConfirmation } from '@/tools/types';
import { runDeskTurn, type VoiceAdapters } from '@/turn/run';
import { TTS_PCM_CHANNEL_COUNT, TTS_PCM_SAMPLE_RATE_HZ } from '@/voice/elevenlabs';
import { chatWithOpenRouter } from '@/voice/llm';
import { transcribeAudioWithOpenRouter } from '@/voice/stt';
import { streamAudioChunksAtPlaybackPace } from '@/voice/stream';
import { synthesizeApolloSpeech } from '@/voice/synthesize';
import { wrapPcmAsWavBuffer } from '@/voice/wav';

export type ApolloTurnRuntimeDependencies = {
  readonly environment: Env;
  readonly sqlExecutor: MemorySqlExecutor;
  readonly uiMachine: DeskUiMachine;
  readonly currentState: ApolloState;
  readonly getCurrentState: () => ApolloState;
  readonly setAgentState: (nextState: ApolloState) => void;
  readonly scheduleConfirmExpiry: (confirmationId: string) => Promise<void>;
  readonly persistPendingConfirmation: (
    confirmation: PendingToolConfirmation,
  ) => Promise<void>;
  readonly session: Session;
  readonly deviceId: string;
  readonly effects: DeskToolEffects;
  readonly isSpeechAborted?: () => boolean;
  readonly telemetrySnapshot?: DeskTelemetrySnapshot;
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
): Promise<void> {
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
  const { models } = resolveApolloConfiguration(dependencies.environment);
  const sessionSystemPrompt = await buildSessionSystemPrompt(dependencies.session);
  const recallSemanticMemoryContentList = async (
    queryText: string,
  ): Promise<readonly string[]> =>
    recallSemanticMemoryContent({
      vectorizeIndex: dependencies.environment.VECTORIZE,
      openRouterApiKey: dependencies.environment.OPENROUTER_API_KEY,
      embeddingModelId: models.embedding,
      queryText,
      deviceId: dependencies.deviceId,
    });

  const focusNote = focusState.active
    ? '\n\nFocus activo: evitá announces ruidosos; sé breve.'
    : '\n\nFocus inactivo.';
  const telemetryNote = buildTelemetryPromptNote(
    dependencies.telemetrySnapshot,
    nowMilliseconds,
  );

  const voiceAdapters: VoiceAdapters = isMockVoice
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
        tts: async (text) => new TextEncoder().encode(text).buffer as ArrayBuffer,
      }
    : {
        stt: async (audioBuffer) =>
          transcribeAudioWithOpenRouter({
            audioBuffer: wrapPcmAsWavBuffer({ pcmBuffer: audioBuffer }),
            openRouterApiKey: dependencies.environment.OPENROUTER_API_KEY,
            modelId: models.transcription,
          }),
        llm: async ({ messageList, toolDefinitionList, onTextDelta }) =>
          chatWithOpenRouter({
            openRouterApiKey: dependencies.environment.OPENROUTER_API_KEY,
            modelId: models.conversation,
            messageList,
            toolDefinitionList,
            ...(onTextDelta !== undefined ? { onTextDelta } : {}),
          }),
        tts: async (text, voiceId) =>
          synthesizeApolloSpeech({
            environment: dependencies.environment,
            text,
            voiceId,
          }),
      };

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
    systemPromptOverride: `${sessionSystemPrompt}${focusNote}${telemetryNote}`,
    ...(isMockVoice ? {} : { recallSemanticMemoryContentList }),
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
    adapters: voiceAdapters,
  });

  for (const uiEventName of turnOutput.uiEventList) {
    dependencies.uiMachine.transition(uiEventName);
  }

  if (turnOutput.pendingConfirmation !== undefined) {
    // Persisted before confirm_request goes out below: the device can answer
    // the moment the screen appears, while the TTS at the bottom of this
    // function is still streaming, and #resolveConfirm must find it by then.
    await dependencies.persistPendingConfirmation(turnOutput.pendingConfirmation);
    await dependencies.scheduleConfirmExpiry(turnOutput.pendingConfirmation.id);
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
    connection.send(encodeServerToDeviceMessage({ type: 'play_effect', name: 'chime' }));
    connection.send(
      encodeServerToDeviceMessage({
        type: 'confirm_request',
        id: turnOutput.pendingConfirmation.id,
        summary: turnOutput.pendingConfirmation.summary,
        expiresAt: turnOutput.pendingConfirmation.expiresAt,
      }),
    );
  }

  let speechWasAborted = false;
  if (turnOutput.ttsAudio !== undefined) {
    const followUpSegmentTextList = turnOutput.ttsFollowUpSegmentTextList ?? [];
    let currentAudioBuffer: ArrayBuffer | undefined = turnOutput.ttsAudio;
    let followUpIndex = 0;
    let wasAborted = false;

    while (currentAudioBuffer !== undefined) {
      // The next segment renders while this one plays, so synthesis latency
      // hides behind the paced stream instead of gapping the speech. A failed
      // follow-up just ends the reply early — the turn already committed.
      const nextAudioBufferPromise: Promise<ArrayBuffer | undefined> | undefined =
        followUpIndex < followUpSegmentTextList.length
          ? voiceAdapters
              .tts(followUpSegmentTextList[followUpIndex], APOLLO_TTS_VOICE)
              .catch((error: unknown): undefined => {
                console.error(
                  JSON.stringify({
                    level: 'error',
                    message: 'apollo_tts_follow_up_segment_failed',
                    error: error instanceof Error ? error.message : String(error),
                  }),
                );
                return undefined;
              })
          : undefined;
      const isFirstSegment = followUpIndex === 0;
      followUpIndex += 1;

      connection.send(
        encodeServerToDeviceMessage({
          type: 'tts_start',
          format: 'pcm',
          bytes: currentAudioBuffer.byteLength,
          sampleRate: TTS_PCM_SAMPLE_RATE_HZ,
          channels: TTS_PCM_CHANNEL_COUNT,
        }),
      );
      await streamAudioChunksAtPlaybackPace({
        audioBuffer: currentAudioBuffer,
        sampleRateHz: TTS_PCM_SAMPLE_RATE_HZ,
        channelCount: TTS_PCM_CHANNEL_COUNT,
        send: (audioChunk) => {
          connection.send(audioChunk);
        },
        // Follow-up segments land on a device that is still draining the
        // previous one, so the full 2 s burst would risk the same queue
        // overflow the pacing exists to avoid; a small allowance only
        // covers network jitter.
        ...(isFirstSegment ? {} : { prebufferMilliseconds: 500 }),
        ...(dependencies.isSpeechAborted !== undefined
          ? { shouldStop: dependencies.isSpeechAborted }
          : {}),
      });

      if (dependencies.isSpeechAborted?.() === true) {
        wasAborted = true;
        break;
      }
      currentAudioBuffer = await nextAudioBufferPromise;
    }

    if (wasAborted) {
      // The device counts bytes against what tts_start promised to know when
      // speech ends, and that total will never arrive now.
      connection.send(encodeServerToDeviceMessage({ type: 'tts_aborted' }));
    }
    speechWasAborted = wasAborted;
  }

  // An aborted reply never reopens the mic: the user already cut it off.
  connection.send(
    encodeServerToDeviceMessage({
      type: 'turn_end',
      expectsReply: turnOutput.expectsReply && !speechWasAborted,
    }),
  );

  if (turnOutput.transcript.length > 0) {
    await dependencies.session.appendMessage({
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: turnOutput.transcript }],
    });
    await dependencies.session.appendMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      parts: [{ type: 'text', text: turnOutput.spokenText }],
    });
  }
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
