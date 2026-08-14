The body is the half you can hold: firmware for a small always-on device that captures your voice, renders a face, and plays Apollo's replies. The reference implementation lives at [github.com/galfrevn/apollo-firmware](https://github.com/galfrevn/apollo-firmware).

The doctrine comes first: **the firmware adapts to Apollo, never the reverse.** The brain's wire contract is fixed, and any hardware that speaks the subset in [Protocol](/docs/protocol) is a legitimate body, screen or no screen.

![Exploded view of the round device: glass, display, circuit board, speaker mesh, shell](/handbook/firmware.jpg)

## The reference body

The reference board is the Waveshare ESP32-S3-Touch-LCD-1.85C V2: a round 360×360 touch display the size of a coaster, with microphone, speaker, and battery support.

The firmware is a C++ ESP-IDF project — FreeRTOS underneath, Opus for capture, raw PCM playback — forked from the xiaozhi-esp32 project and trimmed to this one board. It renders the face, detects the wake word on-device, streams audio both ways, and reports telemetry.

It also carries its own handbook inside the repository, covering the toolchain, the audio path, touch, sounds, and provisioning in the same chapter style as this one. What follows is the short version.

## Building

The toolchain is ESP-IDF v6 with Python 3.10 or newer. With the IDF environment exported, the build is one script — the manufacturer prefix is required:

```sh
python scripts/build.py waveshare/esp32-s3-touch-lcd-1.85c
```

The output lands in `build/`: the app image `xiaozhi.bin`, the expression assets, bootloader, partition table, and a `merged-binary.bin` combining them all.

> The build script exits 0 even when the build fails. Check the output for `[ERROR]` or `FAILED:` lines before flashing, or you will flash the previous binary and debug a ghost.

## Flashing

Connect the board over USB — it enumerates as `/dev/cu.usbmodem*` on macOS — and flash from the `build/` directory:

```sh
python -m esptool --chip esp32s3 -b 460800 --before default-reset \
  --after hard-reset write-flash "@flash_args"
```

> Never toggle the DTR/RTS serial lines manually. It lands the chip silently in ROM download mode, where it looks dead but is simply waiting. When capturing serial logs, disable both lines before opening the port.

## Pointing it at your brain

A body needs three values: where the brain lives, the credential, and its name. There are two ways to supply them.

**At build time** — the friendly path. Set these in the firmware configuration before building:

| Setting | Value |
| --- | --- |
| `CONFIG_APOLLO_URL` | Your worker, `wss://apollo.<you>.workers.dev` |
| `CONFIG_APOLLO_TOKEN` | The `DEVICE_SHARED_SECRET` from your `.dev.vars` |
| `CONFIG_APOLLO_DEVICE_ID` | The instance name, `desk`; empty falls back to the MAC address |

**Per device** — the NVS namespace `apollo`, with keys `url`, `token`, and `device_id`, overrides the build-time values. One binary can serve several desks, and a device can be repointed without a rebuild.

WiFi needs no build-time secret. On first boot, or whenever its credentials stop working, the device opens its own access point and serves a configuration page where you pick the network. Once online it connects to the worker, and the same instant its `hello` reaches the brain, the console's status panel and a `bun run bootstrap verify` will both see it.

## Staying current

Updates flow through the brain. Publish a release by uploading the app image and then the manifest — binary first, so no device ever reads a manifest pointing at a missing file:

```sh
bunx wrangler r2 object put apollo-media/firmware/apollo-2.5.0.bin \
  --file build/xiaozhi.bin --content-type application/octet-stream --remote
bunx wrangler r2 object put apollo-media/firmware/latest.json \
  --file latest.json --content-type application/json --remote
```

The manifest names the version and the object key, with an optional changelog. Upload `xiaozhi.bin`, never `merged-binary.bin` — OTA replaces the app partition only.

Devices check once at boot, and the brain also pushes the upgrade over the MCP bridge when telemetry shows a device idle, powered, and behind. The `apollo-operate` skill automates the whole sequence.
