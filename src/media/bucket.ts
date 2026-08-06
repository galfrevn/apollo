export async function putMediaObject(
  mediaBucket: R2Bucket,
  objectKey: string,
  body: ArrayBuffer | string,
  httpMetadata?: R2HTTPMetadata,
): Promise<string> {
  await mediaBucket.put(objectKey, body, { httpMetadata });
  return objectKey;
}

export async function getMediaObjectBytes(
  mediaBucket: R2Bucket,
  objectKey: string,
): Promise<ArrayBuffer | null> {
  const object = await mediaBucket.get(objectKey);
  if (object === null) {
    return null;
  }
  return object.arrayBuffer();
}

export function buildTtsObjectKey(deviceId: string, turnIdentifier: string): string {
  return `tts/${deviceId}/${turnIdentifier}.mp3`;
}
