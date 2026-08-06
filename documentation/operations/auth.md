# Auth

ESP32 clients authenticate with a shared device secret presented as a URL `token` query parameter.

## Flow

1. Device opens the agent connection URL including `?token=...`
2. `readDeviceTokenFromRequestUrl` extracts the token (`src/auth/token.ts`)
3. `isDeviceSharedSecretValid` compares it to the configured secret using a timing-safe byte compare
4. Failed auth rejects the connection before the desk session starts

## Operational notes

- Rotate the shared secret in Worker secrets when a device is lost
- Do not log raw tokens
- Protocol `hello.deviceId` identifies the device after auth; it is not a substitute for the shared secret

## Navigation

Prev: [Deploy](deploy.md) · Next: [Testing](testing.md)
