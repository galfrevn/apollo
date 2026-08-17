import { isDeviceSharedSecretValid, readDeviceTokenFromRequestUrl } from '@/auth/token';
import { readFirmwareManifest } from '@/ota/manifest';
import type { BlobStore } from '@/platform/blob';

export async function handleOtaRequest(
  request: Request,
  requestUrl: URL,
  environment: Env,
  mediaBlobStore: BlobStore,
): Promise<Response> {
  const presentedToken = readDeviceTokenFromRequestUrl(requestUrl);
  const isAuthorized = await isDeviceSharedSecretValid(
    presentedToken,
    environment.DEVICE_SHARED_SECRET,
  );
  if (!isAuthorized || presentedToken === null) {
    return new Response('Unauthorized', { status: 401 });
  }

  // The device POSTs its system-info JSON on the check; the body is irrelevant
  // to the answer, so both methods are accepted and the body is ignored.
  if (requestUrl.pathname === '/ota/check') {
    return respondWithVersionCheck(requestUrl, presentedToken, mediaBlobStore);
  }
  if (requestUrl.pathname === '/ota/firmware.bin' && request.method === 'GET') {
    return respondWithFirmwareBinary(mediaBlobStore);
  }
  return new Response('Not found', { status: 404 });
}

async function respondWithVersionCheck(
  requestUrl: URL,
  presentedToken: string,
  mediaBlobStore: BlobStore,
): Promise<Response> {
  const firmwareManifest = await readFirmwareManifest(mediaBlobStore);
  if (firmwareManifest === undefined) {
    return Response.json({});
  }
  // The device fetches this URL verbatim with a bare HTTP client (no auth
  // seam), so the token rides in the query like the websocket URL does.
  const firmwareBinaryUrl = new URL('/ota/firmware.bin', requestUrl.origin);
  firmwareBinaryUrl.searchParams.set('token', presentedToken);
  return Response.json({
    firmware: {
      version: firmwareManifest.version,
      url: firmwareBinaryUrl.toString(),
      force: 0,
    },
  });
}

async function respondWithFirmwareBinary(mediaBlobStore: BlobStore): Promise<Response> {
  const firmwareManifest = await readFirmwareManifest(mediaBlobStore);
  if (firmwareManifest === undefined) {
    return new Response('No firmware published', { status: 404 });
  }
  const firmwareObject = await mediaBlobStore.get(firmwareManifest.key);
  if (firmwareObject === null) {
    return new Response('Firmware binary missing', { status: 404 });
  }
  // The device's Ota::Upgrade aborts on a missing Content-Length and uses it
  // for download progress, so the size header is mandatory.
  return new Response(firmwareObject.body, {
    headers: {
      'Content-Length': String(firmwareObject.size),
      'Content-Type': 'application/octet-stream',
    },
  });
}
