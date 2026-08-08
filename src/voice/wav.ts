// The ESP32 streams raw little-endian PCM over the websocket: adding a RIFF
// header on the device would mean buffering the whole utterance before the
// first frame goes out, so the server wraps the concatenated chunks instead.

export const DEVICE_MIC_PCM_SAMPLE_RATE_HZ = 16000;
export const DEVICE_MIC_PCM_CHANNEL_COUNT = 1;
export const DEVICE_MIC_PCM_BITS_PER_SAMPLE = 16;

// TTS is sent as a run of small binary frames instead of one blob so the device
// can start playing on the first frame: `tts_start.bytes` tells it when to stop
// expecting more. Roughly 170 ms of 24 kHz mono audio per frame.
export const TTS_STREAM_CHUNK_BYTE_LENGTH = 8192;

const WAV_HEADER_BYTE_LENGTH = 44;
const WAV_PCM_FORMAT_TAG = 1;

function writeAsciiTag(view: DataView, byteOffset: number, tag: string): void {
  for (let index = 0; index < tag.length; index += 1) {
    view.setUint8(byteOffset + index, tag.charCodeAt(index));
  }
}

export function isWavBuffer(audioBuffer: ArrayBuffer): boolean {
  if (audioBuffer.byteLength < WAV_HEADER_BYTE_LENGTH) {
    return false;
  }
  const headerBytes = new Uint8Array(audioBuffer, 0, 4);
  return (
    headerBytes[0] === 0x52 &&
    headerBytes[1] === 0x49 &&
    headerBytes[2] === 0x46 &&
    headerBytes[3] === 0x46
  );
}

export function wrapPcmAsWavBuffer(input: {
  readonly pcmBuffer: ArrayBuffer;
  readonly sampleRateHz?: number;
  readonly channelCount?: number;
  readonly bitsPerSample?: number;
}): ArrayBuffer {
  if (isWavBuffer(input.pcmBuffer)) {
    return input.pcmBuffer;
  }

  const sampleRateHz = input.sampleRateHz ?? DEVICE_MIC_PCM_SAMPLE_RATE_HZ;
  const channelCount = input.channelCount ?? DEVICE_MIC_PCM_CHANNEL_COUNT;
  const bitsPerSample = input.bitsPerSample ?? DEVICE_MIC_PCM_BITS_PER_SAMPLE;
  const blockAlign = (channelCount * bitsPerSample) / 8;
  const dataByteLength = input.pcmBuffer.byteLength;

  const wavBuffer = new ArrayBuffer(WAV_HEADER_BYTE_LENGTH + dataByteLength);
  const view = new DataView(wavBuffer);

  writeAsciiTag(view, 0, 'RIFF');
  view.setUint32(4, WAV_HEADER_BYTE_LENGTH - 8 + dataByteLength, true);
  writeAsciiTag(view, 8, 'WAVE');
  writeAsciiTag(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, WAV_PCM_FORMAT_TAG, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRateHz, true);
  view.setUint32(28, sampleRateHz * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAsciiTag(view, 36, 'data');
  view.setUint32(40, dataByteLength, true);

  new Uint8Array(wavBuffer).set(new Uint8Array(input.pcmBuffer), WAV_HEADER_BYTE_LENGTH);
  return wavBuffer;
}

export function sliceAudioBufferIntoChunkList(
  audioBuffer: ArrayBuffer,
  chunkByteLength: number = TTS_STREAM_CHUNK_BYTE_LENGTH,
): readonly ArrayBuffer[] {
  if (chunkByteLength <= 0) {
    throw new Error('chunkByteLength debe ser mayor a cero');
  }
  const chunkList: ArrayBuffer[] = [];
  for (let offset = 0; offset < audioBuffer.byteLength; offset += chunkByteLength) {
    chunkList.push(
      audioBuffer.slice(
        offset,
        Math.min(offset + chunkByteLength, audioBuffer.byteLength),
      ),
    );
  }
  return chunkList;
}
