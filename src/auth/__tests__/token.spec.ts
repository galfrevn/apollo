import { describe, expect, it } from 'bun:test';

import { isDeviceSharedSecretValid, readDeviceTokenFromRequestUrl } from '@/auth/token';

describe('device token', () => {
  it('reads token query param', () => {
    const requestUrl = new URL('https://example.com/agents/apollo?token=abc');
    expect(readDeviceTokenFromRequestUrl(requestUrl)).toBe('abc');
  });

  it('accepts matching secret with timing-safe compare', async () => {
    await expect(isDeviceSharedSecretValid('secret', 'secret')).resolves.toBe(true);
    await expect(isDeviceSharedSecretValid('nope', 'secret')).resolves.toBe(false);
    await expect(isDeviceSharedSecretValid(null, 'secret')).resolves.toBe(false);
  });

  it('rejects instead of throwing when the worker secret is unset', async () => {
    await expect(isDeviceSharedSecretValid('abc', '')).resolves.toBe(false);
    await expect(
      isDeviceSharedSecretValid('abc', undefined as unknown as string),
    ).resolves.toBe(false);
  });
});
