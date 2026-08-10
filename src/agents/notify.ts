import type { Connection } from 'agents';
import { z } from 'zod';

import type { DeskAnnounceKind, DeskFocusState } from '@/focus/logic';
import { shouldAnnounceDuringFocus } from '@/focus/logic';
import {
  enqueuePendingDeviceMessage,
  type PendingDeviceMessageType,
} from '@/memory/pending';
import type { MemorySqlExecutor } from '@/memory/store';
import { encodeServerToDeviceMessage } from '@/protocol/schema';
import { TTS_PCM_CHANNEL_COUNT, TTS_PCM_SAMPLE_RATE_HZ } from '@/voice/elevenlabs';
import { sanitizeTextForSpeech } from '@/voice/sanitize';
import { streamAudioChunksAtPlaybackPace } from '@/voice/stream';
import { synthesizeApolloSpeech } from '@/voice/synthesize';

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
  readonly focusState: DeskFocusState;
  readonly environment: Env;
  readonly deviceId: string;
  readonly ttsVoiceId: string;
  readonly isMockVoice: boolean;
  readonly announceKind?: DeskAnnounceKind;
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

  const shouldAnnounce = shouldAnnounceDuringFocus(
    input.focusState,
    input.announceKind ?? 'normal',
  );
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
  const spokenText = sanitizeTextForSpeech(
    extractNotificationSpokenText(input.notification),
  );
  const ttsAudio = input.isMockVoice
    ? (new TextEncoder().encode(spokenText).buffer as ArrayBuffer)
    : await synthesizeApolloSpeech({
        environment: input.environment,
        text: spokenText,
        voiceId: input.ttsVoiceId,
      });

  const ttsStartMessage = encodeServerToDeviceMessage({
    type: 'tts_start',
    format: 'pcm',
    bytes: ttsAudio.byteLength,
    sampleRate: TTS_PCM_SAMPLE_RATE_HZ,
    channels: TTS_PCM_CHANNEL_COUNT,
  });
  for (const connection of input.connectionList) {
    connection.send(ttsStartMessage);
  }

  // Paced once for every listener rather than per connection: the devices play
  // the same announcement at the same time.
  await streamAudioChunksAtPlaybackPace({
    audioBuffer: ttsAudio,
    sampleRateHz: TTS_PCM_SAMPLE_RATE_HZ,
    channelCount: TTS_PCM_CHANNEL_COUNT,
    send: (audioChunk) => {
      for (const connection of input.connectionList) {
        connection.send(audioChunk);
      }
    },
  });
}
