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
  // The generated Env type claims the Worker secret is always a string, but an
  // unset secret arrives as undefined at runtime: accept that honestly and
  // reject the connection instead of throwing a 500.
  expectedSecret: string | undefined,
): Promise<boolean> {
  if (expectedSecret === undefined || expectedSecret.length === 0) {
    return false;
  }
  if (presentedSecret === null) {
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
