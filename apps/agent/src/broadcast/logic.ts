import { z } from 'zod';

// 30 seconds of s16le mono at 24 kHz — the firmware's playback format. The cap
// keeps a full upload at 8 chunks and bounds what a reconnect replay can speak.
export const BROADCAST_MAX_AUDIO_BYTES = 1_440_000;
export const BROADCAST_UPLOAD_CHUNK_RAW_BYTE_LENGTH = 180_000;
// Base64 inflates 3 raw bytes to 4 characters; the encoded chunk plus the
// JSON-RPC envelope must stay well under Cloudflare's ~1 MB WebSocket frame cap.
export const BROADCAST_UPLOAD_CHUNK_MAX_BASE64_LENGTH = 240_000;
export const BROADCAST_UPLOAD_MAX_CHUNK_COUNT = 8;
export const BROADCAST_PENDING_TTL_MILLISECONDS = 86_400_000;
export const BROADCAST_UPLOAD_SESSION_TTL_MILLISECONDS = 120_000;

export type BroadcastDeliveryOutcome = 'delivered' | 'queued';

export type BroadcastUploadSession = {
  readonly totalBytes: number;
  readonly expectedChunkCount: number;
  readonly receivedChunkList: (string | undefined)[];
  readonly createdAtMilliseconds: number;
};

export const broadcastTextPendingPayloadSchema = z.object({
  message: z.string().min(1),
});
export const broadcastAudioPendingPayloadSchema = z.object({
  audioKey: z.string().min(1),
  byteLength: z.number().int().positive(),
});

export type BroadcastTextPendingPayload = z.infer<
  typeof broadcastTextPendingPayloadSchema
>;
export type BroadcastAudioPendingPayload = z.infer<
  typeof broadcastAudioPendingPayloadSchema
>;

export function createBroadcastUploadSession(input: {
  readonly totalBytes: number;
  readonly expectedChunkCount: number;
  readonly nowMilliseconds: number;
}): BroadcastUploadSession {
  if (input.totalBytes <= 0 || input.totalBytes > BROADCAST_MAX_AUDIO_BYTES) {
    throw new Error('El audio supera los 30 segundos permitidos');
  }
  if (input.totalBytes % 2 !== 0) {
    throw new Error('El audio debe tener una cantidad par de bytes (PCM s16le)');
  }
  const requiredChunkCount = Math.ceil(
    input.totalBytes / BROADCAST_UPLOAD_CHUNK_RAW_BYTE_LENGTH,
  );
  if (
    input.expectedChunkCount !== requiredChunkCount ||
    input.expectedChunkCount > BROADCAST_UPLOAD_MAX_CHUNK_COUNT
  ) {
    throw new Error('La cantidad de partes no coincide con el tamaño del audio');
  }
  return {
    totalBytes: input.totalBytes,
    expectedChunkCount: input.expectedChunkCount,
    receivedChunkList: Array.from<string | undefined>({
      length: input.expectedChunkCount,
    }),
    createdAtMilliseconds: input.nowMilliseconds,
  };
}

export function appendBroadcastUploadChunk(
  session: BroadcastUploadSession,
  chunkIndex: number,
  base64Chunk: string,
): number {
  if (
    !Number.isInteger(chunkIndex) ||
    chunkIndex < 0 ||
    chunkIndex >= session.expectedChunkCount
  ) {
    throw new Error('El índice de la parte está fuera de rango');
  }
  if (session.receivedChunkList[chunkIndex] !== undefined) {
    throw new Error('Esa parte del audio ya fue recibida');
  }
  if (base64Chunk.length > BROADCAST_UPLOAD_CHUNK_MAX_BASE64_LENGTH) {
    throw new Error('La parte del audio supera el tamaño permitido');
  }
  session.receivedChunkList[chunkIndex] = base64Chunk;
  return session.receivedChunkList.filter((chunk) => chunk !== undefined).length;
}

export function assembleBroadcastUploadAudio(
  session: BroadcastUploadSession,
): ArrayBuffer {
  const assembledBytes = new Uint8Array(session.totalBytes);
  let writeOffset = 0;
  for (let chunkIndex = 0; chunkIndex < session.expectedChunkCount; chunkIndex += 1) {
    const base64Chunk = session.receivedChunkList[chunkIndex];
    if (base64Chunk === undefined) {
      throw new Error('Faltan partes del audio para armar la difusión');
    }
    const decodedChunk = decodeBase64Chunk(base64Chunk);
    if (writeOffset + decodedChunk.byteLength > session.totalBytes) {
      throw new Error('El audio recibido no coincide con el tamaño anunciado');
    }
    assembledBytes.set(decodedChunk, writeOffset);
    writeOffset += decodedChunk.byteLength;
  }
  if (writeOffset !== session.totalBytes) {
    throw new Error('El audio recibido no coincide con el tamaño anunciado');
  }
  return assembledBytes.buffer;
}

function decodeBase64Chunk(base64Chunk: string): Uint8Array {
  let binaryString: string;
  try {
    binaryString = atob(base64Chunk);
  } catch {
    throw new Error('Una parte del audio no es base64 válido');
  }
  const decodedBytes = new Uint8Array(binaryString.length);
  for (let byteIndex = 0; byteIndex < binaryString.length; byteIndex += 1) {
    decodedBytes[byteIndex] = binaryString.charCodeAt(byteIndex);
  }
  return decodedBytes;
}

export function isBroadcastUploadSessionExpired(
  session: BroadcastUploadSession,
  nowMilliseconds: number,
): boolean {
  return (
    nowMilliseconds - session.createdAtMilliseconds >
    BROADCAST_UPLOAD_SESSION_TTL_MILLISECONDS
  );
}

export function buildBroadcastAudioObjectKey(broadcastId: string): string {
  return `broadcast-audio/${broadcastId}.pcm`;
}

export function isPendingBroadcastExpired(
  createdAtMilliseconds: number,
  nowMilliseconds: number,
): boolean {
  return nowMilliseconds - createdAtMilliseconds > BROADCAST_PENDING_TTL_MILLISECONDS;
}
