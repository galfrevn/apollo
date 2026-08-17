import { describe, expect, it } from 'bun:test';

import {
  createFakeApolloEnvironment,
  createFakeMediaBlobStore,
} from '@/configuration/testing';
import { FIRMWARE_MANIFEST_OBJECT_KEY } from '@/ota/manifest';
import type { BlobStore } from '@/platform/blob';
import { handleOtaRequest } from '@/ota/routes';

const FIRMWARE_BINARY_CONTENT = 'pretend-firmware-bytes';

function createMediaBlobStoreWithFirmware(): BlobStore {
  return createFakeMediaBlobStore({
    [FIRMWARE_MANIFEST_OBJECT_KEY]: JSON.stringify({
      version: '2.5.0',
      key: 'firmware/apollo-2.5.0.bin',
    }),
    'firmware/apollo-2.5.0.bin': FIRMWARE_BINARY_CONTENT,
  });
}

async function performOtaRequest(
  mediaBlobStore: BlobStore,
  path: string,
  method = 'GET',
): Promise<Response> {
  const requestUrl = new URL(`https://apollo.example${path}`);
  return handleOtaRequest(
    new Request(requestUrl, { method }),
    requestUrl,
    createFakeApolloEnvironment(),
    mediaBlobStore,
  );
}

describe('ota routes', () => {
  it('rejects a missing or wrong token on both paths', async () => {
    const mediaBlobStore = createMediaBlobStoreWithFirmware();
    expect((await performOtaRequest(mediaBlobStore, '/ota/check')).status).toBe(401);
    expect(
      (await performOtaRequest(mediaBlobStore, '/ota/check?token=wrong')).status,
    ).toBe(401);
    expect(
      (await performOtaRequest(mediaBlobStore, '/ota/firmware.bin?token=wrong')).status,
    ).toBe(401);
  });

  it('answers the check with the manifest version and a tokenized binary url', async () => {
    const checkResponse = await performOtaRequest(
      createMediaBlobStoreWithFirmware(),
      '/ota/check?token=secret',
      'POST',
    );
    expect(checkResponse.status).toBe(200);
    await expect(checkResponse.json()).resolves.toEqual({
      firmware: {
        version: '2.5.0',
        url: 'https://apollo.example/ota/firmware.bin?token=secret',
        force: 0,
      },
    });
  });

  it('answers the check with an empty object when no manifest is published', async () => {
    const checkResponse = await performOtaRequest(
      createFakeMediaBlobStore(),
      '/ota/check?token=secret',
    );
    expect(checkResponse.status).toBe(200);
    await expect(checkResponse.json()).resolves.toEqual({});
  });

  it('serves the firmware binary with an explicit content length', async () => {
    const binaryResponse = await performOtaRequest(
      createMediaBlobStoreWithFirmware(),
      '/ota/firmware.bin?token=secret',
    );
    expect(binaryResponse.status).toBe(200);
    expect(binaryResponse.headers.get('Content-Length')).toBe(
      String(FIRMWARE_BINARY_CONTENT.length),
    );
    expect(binaryResponse.headers.get('Content-Type')).toBe('application/octet-stream');
    await expect(binaryResponse.text()).resolves.toBe(FIRMWARE_BINARY_CONTENT);
  });

  it('returns 404 when the manifest points at a missing binary', async () => {
    const mediaBlobStore = createFakeMediaBlobStore({
      [FIRMWARE_MANIFEST_OBJECT_KEY]: JSON.stringify({
        version: '2.5.0',
        key: 'firmware/not-uploaded.bin',
      }),
    });
    expect(
      (await performOtaRequest(mediaBlobStore, '/ota/firmware.bin?token=secret')).status,
    ).toBe(404);
  });

  it('returns 404 for unknown ota paths', async () => {
    expect(
      (
        await performOtaRequest(
          createMediaBlobStoreWithFirmware(),
          '/ota/nope?token=secret',
        )
      ).status,
    ).toBe(404);
  });
});
