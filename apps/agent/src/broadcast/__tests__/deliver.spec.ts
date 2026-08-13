import { describe, expect, it } from 'bun:test';

import {
  deliverBroadcastAudio,
  deliverBroadcastText,
  replayPendingBroadcast,
  sweepExpiredBroadcasts,
} from '@/broadcast/deliver';
import type { BroadcastMediaBucket } from '@/broadcast/deliver';
import { BROADCAST_PENDING_TTL_MILLISECONDS } from '@/broadcast/logic';
import { createFakeApolloEnvironment } from '@/configuration/testing';
import { listPendingDeviceMessages } from '@/memory/pending';
import type {
  PendingDeviceMessagePayload,
  PendingDeviceMessageType,
} from '@/memory/pending';
import type { MemorySqlExecutor, MemorySqlRow } from '@/memory/store';

type RecordedFrame = string | ArrayBuffer;

function createFrameRecordingConnection(): {
  connection: { send: (frame: RecordedFrame) => void };
  frameList: RecordedFrame[];
} {
  const frameList: RecordedFrame[] = [];
  return {
    connection: { send: (frame: RecordedFrame) => frameList.push(frame) },
    frameList,
  };
}

function createInMemorySqlExecutor(): MemorySqlExecutor {
  const pendingRowList: Array<{
    id: string;
    type: string;
    payload_json: string;
    created_at: number;
  }> = [];

  function executeFakeQuery(
    query: string,
    ...bindValues: unknown[]
  ): readonly MemorySqlRow[] {
    if (query.startsWith('INSERT INTO pending_device_messages')) {
      pendingRowList.push({
        id: String(bindValues[0]),
        type: String(bindValues[1]),
        payload_json: String(bindValues[2]),
        created_at: Number(bindValues[3]),
      });
      return [];
    }
    if (
      query.startsWith(
        'SELECT id, type, payload_json, created_at FROM pending_device_messages',
      )
    ) {
      return pendingRowList.map((row) => ({ ...row }));
    }
    if (query.startsWith('DELETE FROM pending_device_messages WHERE id = ?')) {
      const identifierToDelete = String(bindValues[0]);
      const rowIndex = pendingRowList.findIndex((row) => row.id === identifierToDelete);
      if (rowIndex >= 0) {
        pendingRowList.splice(rowIndex, 1);
      }
      return [];
    }
    throw new Error(`Unsupported query in fake: ${query}`);
  }

  // SAFETY: every branch of the fake returns rows carrying exactly the columns
  // the matched production query selects, so the caller's Row type argument
  // always matches the rows handed back.
  return { execute: executeFakeQuery as MemorySqlExecutor['execute'] };
}

function createInMemoryMediaBucket(): BroadcastMediaBucket & {
  storedObjectMap: Map<string, ArrayBuffer>;
} {
  const storedObjectMap = new Map<string, ArrayBuffer>();
  return {
    storedObjectMap,
    put: async (objectKey, value) => {
      storedObjectMap.set(objectKey, value);
    },
    get: async (objectKey) => {
      const storedBuffer = storedObjectMap.get(objectKey);
      if (storedBuffer === undefined) {
        return null;
      }
      return { arrayBuffer: async () => storedBuffer };
    },
    delete: async (objectKey) => {
      storedObjectMap.delete(objectKey);
    },
  };
}

function parseJsonFrameList(frameList: readonly RecordedFrame[]): unknown[] {
  return frameList
    .filter((frame): frame is string => typeof frame === 'string')
    .map((frame) => JSON.parse(frame));
}

const fakeEnvironment = createFakeApolloEnvironment();
const immediateWait = async () => {};

function buildTestPcmBuffer(byteLength: number): ArrayBuffer {
  return new Uint8Array(byteLength).fill(7).buffer;
}

describe('deliverBroadcastText', () => {
  it('queues a pending row when no device is connected', async () => {
    const sqlExecutor = createInMemorySqlExecutor();
    const outcome = await deliverBroadcastText({
      message: 'vuelvo a las ocho',
      connectionList: [],
      sqlExecutor,
      environment: fakeEnvironment,
      ttsVoiceId: 'voice',
      isMockVoice: true,
      playChimeEffect: () => {},
      wait: immediateWait,
    });
    expect(outcome).toBe('queued');
    const pendingList = await listPendingDeviceMessages(sqlExecutor);
    expect(pendingList).toHaveLength(1);
    expect(pendingList[0]?.type).toBe('broadcast_text');
    expect(pendingList[0]?.payload).toEqual({ message: 'vuelvo a las ocho' });
  });

  it('plays chime, sends the card, and streams the full speech run when connected', async () => {
    const { connection, frameList } = createFrameRecordingConnection();
    let chimeCount = 0;
    const outcome = await deliverBroadcastText({
      message: 'vuelvo a las ocho',
      connectionList: [connection],
      sqlExecutor: createInMemorySqlExecutor(),
      environment: fakeEnvironment,
      ttsVoiceId: 'voice',
      isMockVoice: true,
      playChimeEffect: () => {
        chimeCount += 1;
      },
      wait: immediateWait,
    });
    expect(outcome).toBe('delivered');
    expect(chimeCount).toBe(1);
    const jsonFrameList = parseJsonFrameList(frameList) as Array<{
      type: string;
      [fieldName: string]: unknown;
    }>;
    expect(jsonFrameList.map((frame) => frame.type)).toEqual([
      'reminder',
      'tts_start',
      'tts_end',
      'turn_end',
    ]);
    const ttsStartFrame = jsonFrameList[1];
    expect(ttsStartFrame?.format).toBe('pcm');
    expect(ttsStartFrame?.sampleRate).toBe(24_000);
    expect(ttsStartFrame?.channels).toBe(1);
    const binaryByteCount = frameList
      .filter((frame): frame is ArrayBuffer => typeof frame !== 'string')
      .reduce((total, frame) => total + frame.byteLength, 0);
    expect(binaryByteCount).toBe(Number(ttsStartFrame?.bytes));
    const turnEndFrame = jsonFrameList[3];
    expect(turnEndFrame?.expectsReply).toBe(false);
  });
});

describe('deliverBroadcastAudio', () => {
  it('stores the audio in r2 and queues a row when no device is connected', async () => {
    const sqlExecutor = createInMemorySqlExecutor();
    const mediaBucket = createInMemoryMediaBucket();
    const outcome = await deliverBroadcastAudio({
      audioBuffer: buildTestPcmBuffer(9_000),
      broadcastId: 'abc',
      connectionList: [],
      sqlExecutor,
      mediaBucket,
      playChimeEffect: () => {},
      wait: immediateWait,
    });
    expect(outcome).toBe('queued');
    expect(mediaBucket.storedObjectMap.has('broadcast-audio/abc.pcm')).toBe(true);
    const pendingList = await listPendingDeviceMessages(sqlExecutor);
    expect(pendingList[0]?.type).toBe('broadcast_audio');
    expect(pendingList[0]?.payload).toEqual({
      audioKey: 'broadcast-audio/abc.pcm',
      byteLength: 9_000,
    });
  });

  it('streams the uploaded pcm directly when connected', async () => {
    const { connection, frameList } = createFrameRecordingConnection();
    const outcome = await deliverBroadcastAudio({
      audioBuffer: buildTestPcmBuffer(20_000),
      broadcastId: 'abc',
      connectionList: [connection],
      sqlExecutor: createInMemorySqlExecutor(),
      mediaBucket: createInMemoryMediaBucket(),
      playChimeEffect: () => {},
      wait: immediateWait,
    });
    expect(outcome).toBe('delivered');
    const jsonFrameList = parseJsonFrameList(frameList) as Array<{
      type: string;
      bytes?: number;
    }>;
    expect(jsonFrameList.map((frame) => frame.type)).toEqual([
      'tts_start',
      'tts_end',
      'turn_end',
    ]);
    expect(jsonFrameList[0]?.bytes).toBe(20_000);
    const binaryByteCount = frameList
      .filter((frame): frame is ArrayBuffer => typeof frame !== 'string')
      .reduce((total, frame) => total + frame.byteLength, 0);
    expect(binaryByteCount).toBe(20_000);
  });
});

describe('replayPendingBroadcast', () => {
  it('speaks a queued audio broadcast and deletes its r2 object', async () => {
    const { connection, frameList } = createFrameRecordingConnection();
    const mediaBucket = createInMemoryMediaBucket();
    await mediaBucket.put('broadcast-audio/abc.pcm', buildTestPcmBuffer(10_000));
    await replayPendingBroadcast({
      pendingMessage: {
        type: 'broadcast_audio',
        payload: { audioKey: 'broadcast-audio/abc.pcm', byteLength: 10_000 },
      },
      connectionList: [connection],
      mediaBucket,
      environment: fakeEnvironment,
      ttsVoiceId: 'voice',
      isMockVoice: true,
      playChimeEffect: () => {},
      wait: immediateWait,
    });
    const jsonFrameList = parseJsonFrameList(frameList) as Array<{ type: string }>;
    expect(jsonFrameList.map((frame) => frame.type)).toEqual([
      'tts_start',
      'tts_end',
      'turn_end',
    ]);
    expect(mediaBucket.storedObjectMap.has('broadcast-audio/abc.pcm')).toBe(false);
  });

  it('skips silently when the r2 object is gone', async () => {
    const { connection, frameList } = createFrameRecordingConnection();
    await replayPendingBroadcast({
      pendingMessage: {
        type: 'broadcast_audio',
        payload: { audioKey: 'broadcast-audio/missing.pcm', byteLength: 10_000 },
      },
      connectionList: [connection],
      mediaBucket: createInMemoryMediaBucket(),
      environment: fakeEnvironment,
      ttsVoiceId: 'voice',
      isMockVoice: true,
      playChimeEffect: () => {},
      wait: immediateWait,
    });
    expect(frameList).toHaveLength(0);
  });

  it('speaks a queued text broadcast with its card', async () => {
    const { connection, frameList } = createFrameRecordingConnection();
    await replayPendingBroadcast({
      pendingMessage: {
        type: 'broadcast_text',
        payload: { message: 'ya llegué' },
      },
      connectionList: [connection],
      mediaBucket: createInMemoryMediaBucket(),
      environment: fakeEnvironment,
      ttsVoiceId: 'voice',
      isMockVoice: true,
      playChimeEffect: () => {},
      wait: immediateWait,
    });
    const jsonFrameList = parseJsonFrameList(frameList) as Array<{ type: string }>;
    expect(jsonFrameList.map((frame) => frame.type)).toEqual([
      'reminder',
      'tts_start',
      'tts_end',
      'turn_end',
    ]);
  });
});

describe('sweepExpiredBroadcasts', () => {
  it('deletes expired broadcast rows and their audio objects, keeping everything else', async () => {
    const sqlExecutor = createInMemorySqlExecutor();
    const mediaBucket = createInMemoryMediaBucket();
    await mediaBucket.put('broadcast-audio/old.pcm', buildTestPcmBuffer(2));
    const pendingMessageList: Array<{
      id: string;
      type: PendingDeviceMessageType;
      payload: PendingDeviceMessagePayload;
      createdAtMilliseconds: number;
    }> = [
      {
        id: 'old-audio',
        type: 'broadcast_audio' as const,
        payload: { audioKey: 'broadcast-audio/old.pcm', byteLength: 2 },
        createdAtMilliseconds: 0,
      },
      {
        id: 'old-text',
        type: 'broadcast_text' as const,
        payload: { message: 'viejo' },
        createdAtMilliseconds: 0,
      },
      {
        id: 'old-reminder',
        type: 'reminder' as const,
        payload: { message: 'los reminders no vencen' },
        createdAtMilliseconds: 0,
      },
      {
        id: 'fresh-text',
        type: 'broadcast_text' as const,
        payload: { message: 'nuevo' },
        createdAtMilliseconds: BROADCAST_PENDING_TTL_MILLISECONDS,
      },
    ];
    const survivingMessageList = await sweepExpiredBroadcasts({
      pendingMessageList,
      sqlExecutor,
      mediaBucket,
      nowMilliseconds: BROADCAST_PENDING_TTL_MILLISECONDS + 1,
    });
    expect(survivingMessageList.map((message) => message.id)).toEqual([
      'old-reminder',
      'fresh-text',
    ]);
    expect(mediaBucket.storedObjectMap.has('broadcast-audio/old.pcm')).toBe(false);
  });
});
