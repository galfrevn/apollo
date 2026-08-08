export async function putMediaObject(
  mediaBucket: R2Bucket,
  objectKey: string,
  body: ArrayBuffer | string,
  httpMetadata?: R2HTTPMetadata,
): Promise<string> {
  await mediaBucket.put(objectKey, body, { httpMetadata });
  return objectKey;
}

export function buildTtsObjectKey(deviceId: string, turnIdentifier: string): string {
  return `tts/${deviceId}/${turnIdentifier}.wav`;
}
