import type { Connection } from 'agents';
import { z } from 'zod';

import type { DeskFocusState } from '@/focus/logic';
import { shouldAnnounceDuringFocus } from '@/focus/logic';
import { buildTtsObjectKey } from '@/media/bucket';
import {
  enqueuePendingDeviceMessage,
  type PendingDeviceMessageType,
} from '@/memory/pending';
import type { MemorySqlExecutor } from '@/memory/store';
import { encodeServerToDeviceMessage } from '@/protocol/schema';
import { cacheTtsInMediaBucket } from '@/queues/consume';
import {
  OPENROUTER_TTS_PCM_CHANNEL_COUNT,
  OPENROUTER_TTS_PCM_SAMPLE_RATE_HZ,
  synthesizeSpeechWithOpenRouter,
} from '@/voice/speech';
import { streamAudioChunksAtPlaybackPace } from '@/voice/stream';

export type DeskDeviceNotification =
  | { readonly type: 'reminder'; readonly message: string }
  | {
      readonly type: 'background_result';
      readonly summary: string;
      readonly prompt: string;
      readonly documentKey?: string;
    };

const reminderPendingPayloadSchema = z.object({
  message: z.string().min(1),
});
const backgroundResultPendingPayloadSchema = z.object({
  summary: z.string().min(1),
  prompt: z.string().min(1),
  documentKey: z.string().min(1).optional(),
});

export function parsePendingDeviceMessageAsNotification(pendingMessage: {
  readonly type: PendingDeviceMessageType;
  readonly payload: Record<string, unknown>;
}): DeskDeviceNotification {
  if (pendingMessage.type === 'reminder') {
    return {
      type: 'reminder',
      ...reminderPendingPayloadSchema.parse(pendingMessage.payload),
    };
  }
  return {
    type: 'background_result',
    ...backgroundResultPendingPayloadSchema.parse(pendingMessage.payload),
  };
}

function extractNotificationPendingPayload(
  notification: DeskDeviceNotification,
): Record<string, unknown> {
  if (notification.type === 'reminder') {
    return { message: notification.message };
  }
  return {
    summary: notification.summary,
    prompt: notification.prompt,
    ...(notification.documentKey !== undefined
      ? { documentKey: notification.documentKey }
      : {}),
  };
}

function extractNotificationSpokenText(notification: DeskDeviceNotification): string {
  return notification.type === 'reminder' ? notification.message : notification.summary;
}

export async function deliverDeskDeviceNotification(input: {
  readonly notification: DeskDeviceNotification;
  readonly connectionList: readonly Connection[];
  readonly sqlExecutor: MemorySqlExecutor;
  readonly isMuted: boolean;
  readonly focusState: DeskFocusState;
  readonly environment: Env;
  readonly deviceId: string;
  readonly ttsVoiceId: string;
  readonly isMockVoice: boolean;
}): Promise<void> {
  if (input.connectionList.length === 0) {
    await enqueuePendingDeviceMessage(input.sqlExecutor, {
      type: input.notification.type,
      payload: extractNotificationPendingPayload(input.notification),
    });
    return;
  }

  const encodedMessage = encodeServerToDeviceMessage(input.notification);
  for (const connection of input.connectionList) {
    connection.send(encodedMessage);
  }

  const shouldAnnounce =
    !input.isMuted && shouldAnnounceDuringFocus(input.focusState, 'normal');
  if (!shouldAnnounce) {
    return;
  }

  await announceNotificationWithTts(input);
}

async function announceNotificationWithTts(input: {
  readonly notification: DeskDeviceNotification;
  readonly connectionList: readonly Connection[];
  readonly environment: Env;
  readonly deviceId: string;
  readonly ttsVoiceId: string;
  readonly isMockVoice: boolean;
}): Promise<void> {
  const spokenText = extractNotificationSpokenText(input.notification);
  const ttsAudio = input.isMockVoice
    ? new TextEncoder().encode(spokenText).buffer
    : await synthesizeSpeechWithOpenRouter({
        text: spokenText,
        voiceId: input.ttsVoiceId,
        openRouterApiKey: input.environment.OPENROUTER_API_KEY,
        modelId: input.environment.OPENROUTER_TTS_MODEL,
        responseFormat: 'pcm',
      });

  if (!input.isMockVoice) {
    await cacheTtsInMediaBucket(input.environment, {
      objectKey: buildTtsObjectKey(input.deviceId, crypto.randomUUID()),
      audioBuffer: ttsAudio,
    });
  }

  const ttsStartMessage = encodeServerToDeviceMessage({
    type: 'tts_start',
    format: 'pcm',
    bytes: ttsAudio.byteLength,
    sampleRate: OPENROUTER_TTS_PCM_SAMPLE_RATE_HZ,
    channels: OPENROUTER_TTS_PCM_CHANNEL_COUNT,
  });
  for (const connection of input.connectionList) {
    connection.send(ttsStartMessage);
  }

  // Paced once for every listener rather than per connection: the devices play
  // the same announcement at the same time.
  await streamAudioChunksAtPlaybackPace({
    audioBuffer: ttsAudio,
    sampleRateHz: OPENROUTER_TTS_PCM_SAMPLE_RATE_HZ,
    channelCount: OPENROUTER_TTS_PCM_CHANNEL_COUNT,
    send: (audioChunk) => {
      for (const connection of input.connectionList) {
        connection.send(audioChunk);
      }
    },
  });
}
