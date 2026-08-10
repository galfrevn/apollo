import { describe, expect, it } from 'bun:test';

import { createFakeMediaBucket } from '@/configuration/testing';
import { FIRMWARE_MANIFEST_OBJECT_KEY, readFirmwareManifest } from '@/ota/manifest';

describe('firmware manifest', () => {
  it('parses a valid manifest', async () => {
    const mediaBucket = createFakeMediaBucket({
      [FIRMWARE_MANIFEST_OBJECT_KEY]: JSON.stringify({
        version: '2.5.0',
        key: 'firmware/apollo-2.5.0.bin',
      }),
    });
    await expect(readFirmwareManifest(mediaBucket)).resolves.toEqual({
      version: '2.5.0',
      key: 'firmware/apollo-2.5.0.bin',
    });
  });

  it('returns undefined when the manifest object is missing', async () => {
    await expect(readFirmwareManifest(createFakeMediaBucket())).resolves.toBeUndefined();
  });

  it('returns undefined on unparseable JSON', async () => {
    const mediaBucket = createFakeMediaBucket({
      [FIRMWARE_MANIFEST_OBJECT_KEY]: 'not json at all',
    });
    await expect(readFirmwareManifest(mediaBucket)).resolves.toBeUndefined();
  });

  it('rejects versions the device version parser would abort on', async () => {
    for (const dangerousVersion of ['2.5.0-beta', 'latest', 'v2.5.0', '2..0', '']) {
      const mediaBucket = createFakeMediaBucket({
        [FIRMWARE_MANIFEST_OBJECT_KEY]: JSON.stringify({
          version: dangerousVersion,
          key: 'firmware/apollo.bin',
        }),
      });
      await expect(readFirmwareManifest(mediaBucket)).resolves.toBeUndefined();
    }
  });

  it('rejects a manifest without a key', async () => {
    const mediaBucket = createFakeMediaBucket({
      [FIRMWARE_MANIFEST_OBJECT_KEY]: JSON.stringify({ version: '2.5.0', key: '' }),
    });
    await expect(readFirmwareManifest(mediaBucket)).resolves.toBeUndefined();
  });
});
