import { z } from 'zod';

export const FIRMWARE_MANIFEST_OBJECT_KEY = 'firmware/latest.json';

// The device's Ota::ParseVersion runs std::stoi per dot-segment with no
// try/catch: a non-numeric version in the manifest aborts the firmware.
const firmwareVersionPattern = /^\d+(\.\d+)*$/;

export const firmwareManifestSchema = z.object({
  version: z.string().regex(firmwareVersionPattern),
  key: z.string().min(1),
});

export type FirmwareManifest = z.infer<typeof firmwareManifestSchema>;

// A broken upload must degrade to "no update available", never to a malformed
// firmware section the device would try to parse.
export async function readFirmwareManifest(
  mediaBucket: R2Bucket,
): Promise<FirmwareManifest | undefined> {
  try {
    const manifestObject = await mediaBucket.get(FIRMWARE_MANIFEST_OBJECT_KEY);
    if (manifestObject === null) {
      return undefined;
    }
    const parsedManifest = firmwareManifestSchema.safeParse(await manifestObject.json());
    return parsedManifest.success ? parsedManifest.data : undefined;
  } catch {
    return undefined;
  }
}
