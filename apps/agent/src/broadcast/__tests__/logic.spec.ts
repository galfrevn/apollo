import { describe, expect, it } from 'bun:test';

import {
  appendBroadcastUploadChunk,
  assembleBroadcastUploadAudio,
  BROADCAST_MAX_AUDIO_BYTES,
  BROADCAST_PENDING_TTL_MILLISECONDS,
  BROADCAST_UPLOAD_CHUNK_RAW_BYTE_LENGTH,
  BROADCAST_UPLOAD_SESSION_TTL_MILLISECONDS,
  broadcastAudioPendingPayloadSchema,
  broadcastTextPendingPayloadSchema,
  buildBroadcastAudioObjectKey,
  createBroadcastUploadSession,
  isBroadcastUploadSessionExpired,
  isPendingBroadcastExpired,
} from '@/broadcast/logic';

function encodeBytesToBase64(bytes: Uint8Array): string {
  let binaryString = '';
  for (const byteValue of bytes) {
    binaryString += String.fromCharCode(byteValue);
  }
  return btoa(binaryString);
}

function buildSequentialBytes(byteLength: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(byteLength);
  for (let byteIndex = 0; byteIndex < byteLength; byteIndex += 1) {
    bytes[byteIndex] = byteIndex % 251;
  }
  return bytes;
}

describe('broadcast upload session', () => {
  it('assembles a multi-chunk upload back into the original bytes', () => {
    const totalBytes = BROADCAST_UPLOAD_CHUNK_RAW_BYTE_LENGTH + 2_000;
    const sourceBytes = buildSequentialBytes(totalBytes);
    const session = createBroadcastUploadSession({
      totalBytes,
      expectedChunkCount: 2,
      nowMilliseconds: 0,
    });
    appendBroadcastUploadChunk(
      session,
      0,
      encodeBytesToBase64(sourceBytes.slice(0, BROADCAST_UPLOAD_CHUNK_RAW_BYTE_LENGTH)),
    );
    const receivedChunkCount = appendBroadcastUploadChunk(
      session,
      1,
      encodeBytesToBase64(sourceBytes.slice(BROADCAST_UPLOAD_CHUNK_RAW_BYTE_LENGTH)),
    );
    expect(receivedChunkCount).toBe(2);
    const assembledBytes = new Uint8Array(assembleBroadcastUploadAudio(session));
    expect(assembledBytes).toEqual(sourceBytes);
  });

  it('rejects a total size above the thirty second cap', () => {
    expect(() =>
      createBroadcastUploadSession({
        totalBytes: BROADCAST_MAX_AUDIO_BYTES + 2,
        expectedChunkCount: 8,
        nowMilliseconds: 0,
      }),
    ).toThrow();
  });

  it('rejects an odd byte count because s16le samples are two bytes', () => {
    expect(() =>
      createBroadcastUploadSession({
        totalBytes: 48_001,
        expectedChunkCount: 1,
        nowMilliseconds: 0,
      }),
    ).toThrow();
  });

  it('rejects a chunk count that does not match the total size', () => {
    expect(() =>
      createBroadcastUploadSession({
        totalBytes: 48_000,
        expectedChunkCount: 2,
        nowMilliseconds: 0,
      }),
    ).toThrow();
  });

  it('rejects out-of-range and duplicate chunk indexes', () => {
    const session = createBroadcastUploadSession({
      totalBytes: 48_000,
      expectedChunkCount: 1,
      nowMilliseconds: 0,
    });
    expect(() => appendBroadcastUploadChunk(session, 1, 'aaaa')).toThrow();
    expect(() => appendBroadcastUploadChunk(session, -1, 'aaaa')).toThrow();
    appendBroadcastUploadChunk(
      session,
      0,
      encodeBytesToBase64(buildSequentialBytes(48_000)),
    );
    expect(() => appendBroadcastUploadChunk(session, 0, 'aaaa')).toThrow();
  });

  it('rejects assembly when a chunk is missing', () => {
    const session = createBroadcastUploadSession({
      totalBytes: BROADCAST_UPLOAD_CHUNK_RAW_BYTE_LENGTH * 2,
      expectedChunkCount: 2,
      nowMilliseconds: 0,
    });
    appendBroadcastUploadChunk(
      session,
      0,
      encodeBytesToBase64(buildSequentialBytes(BROADCAST_UPLOAD_CHUNK_RAW_BYTE_LENGTH)),
    );
    expect(() => assembleBroadcastUploadAudio(session)).toThrow();
  });

  it('rejects assembly when the decoded bytes do not match the announced total', () => {
    const session = createBroadcastUploadSession({
      totalBytes: 48_000,
      expectedChunkCount: 1,
      nowMilliseconds: 0,
    });
    appendBroadcastUploadChunk(
      session,
      0,
      encodeBytesToBase64(buildSequentialBytes(46_000)),
    );
    expect(() => assembleBroadcastUploadAudio(session)).toThrow();
  });

  it('rejects a chunk that is not valid base64', () => {
    const session = createBroadcastUploadSession({
      totalBytes: 48_000,
      expectedChunkCount: 1,
      nowMilliseconds: 0,
    });
    appendBroadcastUploadChunk(session, 0, '@@@not-base64@@@');
    expect(() => assembleBroadcastUploadAudio(session)).toThrow();
  });

  it('expires an upload session past its ttl', () => {
    const session = createBroadcastUploadSession({
      totalBytes: 48_000,
      expectedChunkCount: 1,
      nowMilliseconds: 1_000,
    });
    expect(isBroadcastUploadSessionExpired(session, 1_000)).toBe(false);
    expect(
      isBroadcastUploadSessionExpired(
        session,
        1_000 + BROADCAST_UPLOAD_SESSION_TTL_MILLISECONDS,
      ),
    ).toBe(false);
    expect(
      isBroadcastUploadSessionExpired(
        session,
        1_001 + BROADCAST_UPLOAD_SESSION_TTL_MILLISECONDS,
      ),
    ).toBe(true);
  });
});

describe('broadcast pending helpers', () => {
  it('builds the r2 object key from the broadcast id', () => {
    expect(buildBroadcastAudioObjectKey('abc-123')).toBe('broadcast-audio/abc-123.pcm');
  });

  it('expires a pending broadcast strictly after the ttl', () => {
    expect(isPendingBroadcastExpired(0, BROADCAST_PENDING_TTL_MILLISECONDS)).toBe(false);
    expect(isPendingBroadcastExpired(0, BROADCAST_PENDING_TTL_MILLISECONDS + 1)).toBe(
      true,
    );
  });

  it('parses pending payloads and rejects malformed ones', () => {
    expect(
      broadcastTextPendingPayloadSchema.parse({ message: 'vuelvo a las ocho' }),
    ).toEqual({ message: 'vuelvo a las ocho' });
    expect(() => broadcastTextPendingPayloadSchema.parse({ message: '' })).toThrow();
    expect(
      broadcastAudioPendingPayloadSchema.parse({
        audioKey: 'broadcast-audio/x.pcm',
        byteLength: 2,
      }),
    ).toEqual({ audioKey: 'broadcast-audio/x.pcm', byteLength: 2 });
    expect(() =>
      broadcastAudioPendingPayloadSchema.parse({ audioKey: '', byteLength: 0 }),
    ).toThrow();
  });
});
