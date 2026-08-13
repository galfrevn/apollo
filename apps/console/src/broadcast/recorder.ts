// The ESP32 has no audio decoder, so the browser must produce the exact wire
// format: raw s16le mono PCM at 24 kHz. Capture happens at the hardware rate
// through an AudioWorklet and is resampled offline before upload.
export const BROADCAST_TARGET_SAMPLE_RATE_HZ = 24_000;
export const BROADCAST_MAX_RECORDING_SECONDS = 30;
export const BROADCAST_UPLOAD_CHUNK_RAW_BYTE_LENGTH = 180_000;

const CAPTURE_WORKLET_SOURCE = `
class BroadcastCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channelSamples = inputs[0]?.[0];
    if (channelSamples !== undefined) {
      this.port.postMessage(channelSamples.slice(0));
    }
    return true;
  }
}
registerProcessor('broadcastcapture', BroadcastCaptureProcessor);
`;

export type BroadcastRecorderHandle = {
  readonly stop: () => Promise<{
    readonly sampleList: Float32Array<ArrayBuffer>;
    readonly sourceSampleRateHz: number;
  }>;
};

export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices?.getUserMedia !== undefined &&
    typeof AudioWorkletNode !== 'undefined'
  );
}

export async function startBroadcastRecording(): Promise<BroadcastRecorderHandle> {
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
  let audioContext: AudioContext | null = null;
  try {
    audioContext = new AudioContext();
    return await wireCaptureGraph(mediaStream, audioContext);
  } catch (setupError) {
    // The stream is live the moment getUserMedia resolves; a failure while
    // wiring the graph must not leave the microphone capturing.
    for (const track of mediaStream.getTracks()) {
      track.stop();
    }
    await audioContext?.close();
    throw setupError;
  }
}

async function wireCaptureGraph(
  mediaStream: MediaStream,
  audioContext: AudioContext,
): Promise<BroadcastRecorderHandle> {
  const workletUrl = URL.createObjectURL(
    new Blob([CAPTURE_WORKLET_SOURCE], { type: 'application/javascript' }),
  );
  try {
    await audioContext.audioWorklet.addModule(workletUrl);
  } finally {
    URL.revokeObjectURL(workletUrl);
  }

  const capturedChunkList: Float32Array<ArrayBuffer>[] = [];
  const maxSampleCount = BROADCAST_MAX_RECORDING_SECONDS * audioContext.sampleRate;
  let capturedSampleCount = 0;

  const captureNode = new AudioWorkletNode(audioContext, 'broadcastcapture', {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    channelCount: 1,
  });
  const handleCapturedChunk = (messageEvent: MessageEvent<Float32Array<ArrayBuffer>>) => {
    if (capturedSampleCount >= maxSampleCount) {
      return;
    }
    capturedChunkList.push(messageEvent.data);
    capturedSampleCount += messageEvent.data.length;
  };
  captureNode.port.addEventListener('message', handleCapturedChunk);
  captureNode.port.start();
  audioContext.createMediaStreamSource(mediaStream).connect(captureNode);

  return {
    stop: async () => {
      captureNode.port.removeEventListener('message', handleCapturedChunk);
      captureNode.disconnect();
      for (const track of mediaStream.getTracks()) {
        track.stop();
      }
      const sourceSampleRateHz = audioContext.sampleRate;
      await audioContext.close();
      return {
        sampleList: concatenateSampleChunks(capturedChunkList, maxSampleCount),
        sourceSampleRateHz,
      };
    },
  };
}

function concatenateSampleChunks(
  chunkList: readonly Float32Array<ArrayBuffer>[],
  maxSampleCount: number,
): Float32Array<ArrayBuffer> {
  const totalSampleCount = Math.min(
    chunkList.reduce((total, chunk) => total + chunk.length, 0),
    maxSampleCount,
  );
  const concatenated = new Float32Array(totalSampleCount);
  let writeOffset = 0;
  for (const chunk of chunkList) {
    const remainingSampleCount = totalSampleCount - writeOffset;
    if (remainingSampleCount <= 0) {
      break;
    }
    const boundedChunk =
      chunk.length > remainingSampleCount
        ? chunk.subarray(0, remainingSampleCount)
        : chunk;
    concatenated.set(boundedChunk, writeOffset);
    writeOffset += boundedChunk.length;
  }
  return concatenated;
}

export async function resampleToTargetRate(
  sampleList: Float32Array<ArrayBuffer>,
  sourceSampleRateHz: number,
): Promise<Float32Array<ArrayBuffer>> {
  if (sampleList.length === 0) {
    return new Float32Array(0);
  }
  if (sourceSampleRateHz === BROADCAST_TARGET_SAMPLE_RATE_HZ) {
    return sampleList;
  }
  const targetSampleCount = Math.ceil(
    (sampleList.length / sourceSampleRateHz) * BROADCAST_TARGET_SAMPLE_RATE_HZ,
  );
  const offlineContext = new OfflineAudioContext(
    1,
    targetSampleCount,
    BROADCAST_TARGET_SAMPLE_RATE_HZ,
  );
  const sourceBuffer = offlineContext.createBuffer(
    1,
    sampleList.length,
    sourceSampleRateHz,
  );
  sourceBuffer.copyToChannel(sampleList, 0);
  const bufferSource = offlineContext.createBufferSource();
  bufferSource.buffer = sourceBuffer;
  bufferSource.connect(offlineContext.destination);
  bufferSource.start();
  const renderedBuffer = await offlineContext.startRendering();
  return renderedBuffer.getChannelData(0);
}

export function convertFloat32ToInt16Pcm(sampleList: Float32Array): Int16Array {
  const pcmSampleList = new Int16Array(sampleList.length);
  for (let sampleIndex = 0; sampleIndex < sampleList.length; sampleIndex += 1) {
    const clampedSample = Math.max(-1, Math.min(1, sampleList[sampleIndex] ?? 0));
    pcmSampleList[sampleIndex] = Math.round(clampedSample * 32_767);
  }
  return pcmSampleList;
}

export function encodePcmToBase64ChunkList(
  pcmBytes: Uint8Array,
  chunkByteLength: number = BROADCAST_UPLOAD_CHUNK_RAW_BYTE_LENGTH,
): string[] {
  const base64ChunkList: string[] = [];
  for (let readOffset = 0; readOffset < pcmBytes.length; readOffset += chunkByteLength) {
    const chunkBytes = pcmBytes.subarray(readOffset, readOffset + chunkByteLength);
    let binaryString = '';
    for (const byteValue of chunkBytes) {
      binaryString += String.fromCharCode(byteValue);
    }
    base64ChunkList.push(btoa(binaryString));
  }
  return base64ChunkList;
}

export function computeRecordingDurationSeconds(pcmByteLength: number): number {
  return pcmByteLength / (BROADCAST_TARGET_SAMPLE_RATE_HZ * 2);
}

// A 44-byte canonical RIFF header so the recording can be previewed through a
// plain <audio> element before it is sent.
export function wrapPcmInWavHeader(pcmBytes: Uint8Array): Blob {
  const headerBytes = new ArrayBuffer(44);
  const headerView = new DataView(headerBytes);
  const bytesPerSecond = BROADCAST_TARGET_SAMPLE_RATE_HZ * 2;
  writeAsciiTag(headerView, 0, 'RIFF');
  headerView.setUint32(4, 36 + pcmBytes.length, true);
  writeAsciiTag(headerView, 8, 'WAVE');
  writeAsciiTag(headerView, 12, 'fmt ');
  headerView.setUint32(16, 16, true);
  headerView.setUint16(20, 1, true);
  headerView.setUint16(22, 1, true);
  headerView.setUint32(24, BROADCAST_TARGET_SAMPLE_RATE_HZ, true);
  headerView.setUint32(28, bytesPerSecond, true);
  headerView.setUint16(32, 2, true);
  headerView.setUint16(34, 16, true);
  writeAsciiTag(headerView, 36, 'data');
  headerView.setUint32(40, pcmBytes.length, true);
  return new Blob([headerBytes, pcmBytes.slice().buffer], { type: 'audio/wav' });
}

function writeAsciiTag(view: DataView, byteOffset: number, tag: string): void {
  for (let characterIndex = 0; characterIndex < tag.length; characterIndex += 1) {
    view.setUint8(byteOffset + characterIndex, tag.charCodeAt(characterIndex));
  }
}
