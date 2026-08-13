import { encodePcmToBase64ChunkList } from '@/broadcast/recorder';
import type { ConsoleRpc } from '@/agent/rpc';
import type { BroadcastResult } from '@/agent/schema';

// Chunks go up sequentially on the already-open RPC socket; any failure aborts
// the whole upload and the caller restarts from the first chunk, because the
// server session may have been evicted in between.
export async function uploadBroadcastAudio(
  consoleRpc: ConsoleRpc,
  pcmBytes: Uint8Array,
  onProgress: (sentChunkCount: number, totalChunkCount: number) => void,
): Promise<BroadcastResult['outcome']> {
  const base64ChunkList = encodePcmToBase64ChunkList(pcmBytes);
  onProgress(0, base64ChunkList.length);
  const { uploadId } = await consoleRpc.beginBroadcastAudioUpload(
    pcmBytes.length,
    base64ChunkList.length,
  );
  for (let chunkIndex = 0; chunkIndex < base64ChunkList.length; chunkIndex += 1) {
    const base64Chunk = base64ChunkList[chunkIndex];
    if (base64Chunk === undefined) {
      throw new Error('Missing chunk while uploading');
    }
    await consoleRpc.appendBroadcastAudioChunk(uploadId, chunkIndex, base64Chunk);
    onProgress(chunkIndex + 1, base64ChunkList.length);
  }
  const { outcome } = await consoleRpc.commitBroadcastAudioUpload(uploadId);
  return outcome;
}
