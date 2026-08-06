function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function areByteArraysEqualTimingSafe(
  leftBytes: Uint8Array,
  rightBytes: Uint8Array,
): boolean {
  if (leftBytes.byteLength !== rightBytes.byteLength) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < leftBytes.byteLength; index += 1) {
    const leftByte = leftBytes[index] ?? 0;
    const rightByte = rightBytes[index] ?? 0;
    difference |= leftByte ^ rightByte;
  }
  return difference === 0;
}

export async function isDeviceSharedSecretValid(
  presentedSecret: string | null,
  expectedSecret: string,
): Promise<boolean> {
  if (presentedSecret === null || expectedSecret.length === 0) {
    return false;
  }
  return areByteArraysEqualTimingSafe(
    encodeUtf8(presentedSecret),
    encodeUtf8(expectedSecret),
  );
}

export function readDeviceTokenFromRequestUrl(requestUrl: URL): string | null {
  return requestUrl.searchParams.get('token');
}
