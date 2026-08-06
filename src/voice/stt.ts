import { z } from 'zod';

const openRouterTranscriptionResponseSchema = z.object({
  text: z.string().optional(),
});

function encodeArrayBufferAsBase64(arrayBuffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(arrayBuffer);
  let binaryString = '';
  for (const byteValue of byteArray) {
    binaryString += String.fromCharCode(byteValue);
  }
  return btoa(binaryString);
}

export async function transcribeAudioWithOpenRouter(input: {
  readonly audioBuffer: ArrayBuffer;
  readonly openRouterApiKey: string;
  readonly modelId: string;
  readonly languageCode?: string;
  readonly audioFormat?: string;
}): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.openRouterApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.modelId,
      language: input.languageCode ?? 'es',
      input_audio: {
        data: encodeArrayBufferAsBase64(input.audioBuffer),
        format: input.audioFormat ?? 'wav',
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`STT falló con status ${response.status}`);
  }

  const payload = openRouterTranscriptionResponseSchema.parse(await response.json());
  const transcript = payload.text?.trim() ?? '';
  if (transcript.length === 0) {
    throw new Error('STT devolvió texto vacío');
  }
  return transcript;
}
