import { announcePcmToConnections, encodeMockSpeechAudio } from '@/agents/notify';
import type { AnnounceableConnection } from '@/agents/notify';
import {
  broadcastAudioPendingPayloadSchema,
  broadcastTextPendingPayloadSchema,
  buildBroadcastAudioObjectKey,
  isPendingBroadcastExpired,
} from '@/broadcast/logic';
import type { BroadcastDeliveryOutcome } from '@/broadcast/logic';
import {
  deletePendingDeviceMessage,
  enqueuePendingDeviceMessage,
} from '@/memory/pending';
import type {
  PendingDeviceMessagePayload,
  PendingDeviceMessageType,
} from '@/memory/pending';
import type { MemorySqlExecutor } from '@/memory/store';
import { encodeServerToDeviceMessage } from '@/protocol/schema';
import { sanitizeTextForSpeech } from '@/voice/sanitize';
import { synthesizeApolloSpeech } from '@/voice/synthesize';

// The subset of R2Bucket the broadcast path touches, kept structural so the
// spec can substitute an in-memory bucket.
export type BroadcastMediaBucket = {
  put(objectKey: string, value: ArrayBuffer): Promise<unknown>;
  get(objectKey: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(objectKey: string): Promise<void>;
};

type StoredPendingMessage = {
  readonly id: string;
  readonly type: PendingDeviceMessageType;
  readonly payload: PendingDeviceMessagePayload;
  readonly createdAtMilliseconds: number;
};

export async function deliverBroadcastText(input: {
  readonly message: string;
  readonly connectionList: readonly AnnounceableConnection[];
  readonly sqlExecutor: MemorySqlExecutor;
  readonly environment: Env;
  readonly ttsVoiceId: string;
  readonly isMockVoice: boolean;
  readonly playChimeEffect: () => void;
  readonly wait?: (milliseconds: number) => Promise<void>;
}): Promise<BroadcastDeliveryOutcome> {
  if (input.connectionList.length === 0) {
    await enqueuePendingDeviceMessage(input.sqlExecutor, {
      type: 'broadcast_text',
      payload: { message: input.message },
    });
    return 'queued';
  }

  input.playChimeEffect();
  const reminderCardMessage = encodeServerToDeviceMessage({
    type: 'reminder',
    message: input.message,
  });
  for (const connection of input.connectionList) {
    connection.send(reminderCardMessage);
  }
  await speakBroadcastText(input);
  return 'delivered';
}

export async function deliverBroadcastAudio(input: {
  readonly audioBuffer: ArrayBuffer;
  readonly broadcastId: string;
  readonly connectionList: readonly AnnounceableConnection[];
  readonly sqlExecutor: MemorySqlExecutor;
  readonly mediaBucket: BroadcastMediaBucket;
  readonly playChimeEffect: () => void;
  readonly wait?: (milliseconds: number) => Promise<void>;
}): Promise<BroadcastDeliveryOutcome> {
  if (input.connectionList.length === 0) {
    const audioObjectKey = buildBroadcastAudioObjectKey(input.broadcastId);
    await input.mediaBucket.put(audioObjectKey, input.audioBuffer);
    await enqueuePendingDeviceMessage(input.sqlExecutor, {
      type: 'broadcast_audio',
      payload: { audioKey: audioObjectKey, byteLength: input.audioBuffer.byteLength },
    });
    return 'queued';
  }

  input.playChimeEffect();
  await announcePcmToConnections({
    audioBuffer: input.audioBuffer,
    connectionList: input.connectionList,
    ...(input.wait === undefined ? {} : { wait: input.wait }),
  });
  return 'delivered';
}

export async function replayPendingBroadcast(input: {
  readonly pendingMessage: Pick<StoredPendingMessage, 'type' | 'payload'>;
  readonly connectionList: readonly AnnounceableConnection[];
  readonly mediaBucket: BroadcastMediaBucket;
  readonly environment: Env;
  readonly ttsVoiceId: string;
  readonly isMockVoice: boolean;
  readonly playChimeEffect: () => void;
  readonly wait?: (milliseconds: number) => Promise<void>;
}): Promise<void> {
  if (input.pendingMessage.type === 'broadcast_text') {
    const textPayload = broadcastTextPendingPayloadSchema.parse(
      input.pendingMessage.payload,
    );
    input.playChimeEffect();
    const reminderCardMessage = encodeServerToDeviceMessage({
      type: 'reminder',
      message: textPayload.message,
    });
    for (const connection of input.connectionList) {
      connection.send(reminderCardMessage);
    }
    await speakBroadcastText({ ...input, message: textPayload.message });
    return;
  }

  const audioPayload = broadcastAudioPendingPayloadSchema.parse(
    input.pendingMessage.payload,
  );
  const storedAudioObject = await input.mediaBucket.get(audioPayload.audioKey);
  if (storedAudioObject === null) {
    return;
  }
  const audioBuffer = await storedAudioObject.arrayBuffer();
  input.playChimeEffect();
  await announcePcmToConnections({
    audioBuffer,
    connectionList: input.connectionList,
    ...(input.wait === undefined ? {} : { wait: input.wait }),
  });
  await input.mediaBucket.delete(audioPayload.audioKey);
}

export async function sweepExpiredBroadcasts(input: {
  readonly pendingMessageList: readonly StoredPendingMessage[];
  readonly sqlExecutor: MemorySqlExecutor;
  readonly mediaBucket: BroadcastMediaBucket;
  readonly nowMilliseconds: number;
}): Promise<readonly StoredPendingMessage[]> {
  const survivingMessageList: StoredPendingMessage[] = [];
  for (const pendingMessage of input.pendingMessageList) {
    const isBroadcast =
      pendingMessage.type === 'broadcast_text' ||
      pendingMessage.type === 'broadcast_audio';
    if (
      !isBroadcast ||
      !isPendingBroadcastExpired(
        pendingMessage.createdAtMilliseconds,
        input.nowMilliseconds,
      )
    ) {
      survivingMessageList.push(pendingMessage);
      continue;
    }
    if (pendingMessage.type === 'broadcast_audio') {
      const audioPayload = broadcastAudioPendingPayloadSchema.safeParse(
        pendingMessage.payload,
      );
      if (audioPayload.success) {
        await input.mediaBucket.delete(audioPayload.data.audioKey);
      }
    }
    await deletePendingDeviceMessage(input.sqlExecutor, pendingMessage.id);
  }
  return survivingMessageList;
}

async function speakBroadcastText(input: {
  readonly message: string;
  readonly connectionList: readonly AnnounceableConnection[];
  readonly environment: Env;
  readonly ttsVoiceId: string;
  readonly isMockVoice: boolean;
  readonly wait?: (milliseconds: number) => Promise<void>;
}): Promise<void> {
  const spokenText = sanitizeTextForSpeech(input.message);
  const speechAudio = input.isMockVoice
    ? encodeMockSpeechAudio(spokenText)
    : await synthesizeApolloSpeech({
        environment: input.environment,
        text: spokenText,
        voiceId: input.ttsVoiceId,
      });
  await announcePcmToConnections({
    audioBuffer: speechAudio,
    connectionList: input.connectionList,
    ...(input.wait === undefined ? {} : { wait: input.wait }),
  });
}
