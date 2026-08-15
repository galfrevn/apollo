import type { Connection } from 'agents';
import { z } from 'zod';

import type { DeskAnnounceKind, DeskFocusState } from '@/focus/logic';
import { shouldAnnounceDuringFocus } from '@/focus/logic';
import { enqueuePendingDeviceMessage } from '@/memory/pending';
import type { listPendingDeviceMessages } from '@/memory/pending';
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

type ReminderPendingPayload = z.infer<typeof reminderPendingPayloadSchema>;
type BackgroundResultPendingPayload = z.infer<
  typeof backgroundResultPendingPayloadSchema
>;

type StoredPendingDeviceMessage = Awaited<
  ReturnType<typeof listPendingDeviceMessages>
>[number];

export function parsePendingDeviceMessageAsNotification(
  pendingMessage: Pick<StoredPendingDeviceMessage, 'type' | 'payload'>,
): DeskDeviceNotification {
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
): ReminderPendingPayload | BackgroundResultPendingPayload {
  if (notification.type === 'reminder') {
    return { message: notification.message };
  }
  const backgroundResultPayload: BackgroundResultPendingPayload = {
    summary: notification.summary,
    prompt: notification.prompt,
  };
  if (notification.documentKey !== undefined) {
    backgroundResultPayload.documentKey = notification.documentKey;
  }
  return backgroundResultPayload;
}

export function buildNotificationSpokenText(
  notification: DeskDeviceNotification,
): string {
  if (notification.type === 'reminder') {
    return notification.message;
  }
  return `Terminé ${notification.prompt}: ${notification.summary}`;
}

export function encodeMockSpeechAudio(spokenText: string): ArrayBuffer {
  const encodedSpokenTextBytes = new TextEncoder().encode(spokenText);
  const mockSpeechAudioBuffer = new ArrayBuffer(encodedSpokenTextBytes.byteLength);
  new Uint8Array(mockSpeechAudioBuffer).set(encodedSpokenTextBytes);
  return mockSpeechAudioBuffer;
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
    buildNotificationSpokenText(input.notification),
  );
  const ttsAudio = input.isMockVoice
    ? encodeMockSpeechAudio(spokenText)
    : await synthesizeApolloSpeech({
        environment: input.environment,
        text: spokenText,
        voiceId: input.ttsVoiceId,
      });

  await announcePcmToConnections({
    audioBuffer: ttsAudio,
    connectionList: input.connectionList,
  });
}

// Structurally just `send` so broadcast tests can stand in a plain recorder
// object for a live WebSocket connection.
export type AnnounceableConnection = Pick<Connection, 'send'>;

export async function announcePcmToConnections(input: {
  readonly audioBuffer: ArrayBuffer;
  readonly connectionList: readonly AnnounceableConnection[];
  readonly wait?: (milliseconds: number) => Promise<void>;
}): Promise<void> {
  const ttsStartMessage = encodeServerToDeviceMessage({
    type: 'tts_start',
    format: 'pcm',
    bytes: input.audioBuffer.byteLength,
    sampleRate: TTS_PCM_SAMPLE_RATE_HZ,
    channels: TTS_PCM_CHANNEL_COUNT,
  });
  for (const connection of input.connectionList) {
    connection.send(ttsStartMessage);
  }

  // Paced once for every listener rather than per connection: the devices play
  // the same announcement at the same time. Open-loop on purpose — a broadcast
  // has no single device whose acks could steer it.
  await streamAudioChunksAtPlaybackPace({
    audioBuffer: input.audioBuffer,
    sampleRateHz: TTS_PCM_SAMPLE_RATE_HZ,
    channelCount: TTS_PCM_CHANNEL_COUNT,
    wait: input.wait,
    send: (audioChunk) => {
      for (const connection of input.connectionList) {
        connection.send(audioChunk);
      }
    },
  });

  const ttsEndMessage = encodeServerToDeviceMessage({ type: 'tts_end' });
  for (const connection of input.connectionList) {
    connection.send(ttsEndMessage);
  }

  // Announcements are one-way: without this the device would reopen the mic
  // after speaking, as if the reminder had asked a question.
  const turnEndMessage = encodeServerToDeviceMessage({
    type: 'turn_end',
    expectsReply: false,
  });
  for (const connection of input.connectionList) {
    connection.send(turnEndMessage);
  }
}
