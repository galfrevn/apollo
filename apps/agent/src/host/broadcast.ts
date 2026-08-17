import {
  appendBroadcastUploadChunk,
  assembleBroadcastUploadAudio,
  createBroadcastUploadSession,
  isBroadcastUploadSessionExpired,
  type BroadcastUploadSession,
} from '@/broadcast/logic';

// In-memory on purpose, mirroring the durable object: a host restart
// mid-upload loses the session and the console starts over from chunk zero.
export function createBroadcastUploadRegistry() {
  const uploadSessionMap = new Map<string, BroadcastUploadSession>();

  function evictExpiredSessions(): void {
    const nowMilliseconds = Date.now();
    for (const [uploadId, uploadSession] of uploadSessionMap) {
      if (isBroadcastUploadSessionExpired(uploadSession, nowMilliseconds)) {
        uploadSessionMap.delete(uploadId);
      }
    }
  }

  function requireSession(uploadId: string): BroadcastUploadSession {
    const uploadSession = uploadSessionMap.get(uploadId);
    if (uploadSession === undefined) {
      throw new Error('La subida expiró; volvé a enviar el audio');
    }
    return uploadSession;
  }

  return {
    begin(input: { readonly totalBytes: number; readonly chunkCount: number }): {
      readonly uploadId: string;
    } {
      evictExpiredSessions();
      const uploadId = crypto.randomUUID();
      uploadSessionMap.set(
        uploadId,
        createBroadcastUploadSession({
          totalBytes: input.totalBytes,
          expectedChunkCount: input.chunkCount,
          nowMilliseconds: Date.now(),
        }),
      );
      return { uploadId };
    },
    append(input: {
      readonly uploadId: string;
      readonly chunkIndex: number;
      readonly base64Chunk: string;
    }): { readonly receivedChunkCount: number } {
      const receivedChunkCount = appendBroadcastUploadChunk(
        requireSession(input.uploadId),
        input.chunkIndex,
        input.base64Chunk,
      );
      return { receivedChunkCount };
    },
    commit(uploadId: string): ArrayBuffer {
      const audioBuffer = assembleBroadcastUploadAudio(requireSession(uploadId));
      uploadSessionMap.delete(uploadId);
      return audioBuffer;
    },
  };
}

export type BroadcastUploadRegistry = ReturnType<typeof createBroadcastUploadRegistry>;
