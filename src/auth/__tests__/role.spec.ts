import { describe, expect, it } from 'bun:test';

import { resolveApolloConnectionRole } from '@/auth/role';
import { createFakeApolloEnvironment } from '@/configuration/testing';

function buildConnectionUrl(token?: string): URL {
  const requestUrl = new URL('https://apollo.example/agents/apollo/desk');
  if (token !== undefined) {
    requestUrl.searchParams.set('token', token);
  }
  return requestUrl;
}

describe('apollo connection role', () => {
  const environment = createFakeApolloEnvironment();

  it('resolves the device secret to the device role', async () => {
    await expect(
      resolveApolloConnectionRole(buildConnectionUrl('secret'), environment),
    ).resolves.toBe('device');
  });

  it('resolves the dashboard secret to the dashboard role', async () => {
    await expect(
      resolveApolloConnectionRole(buildConnectionUrl('dashboard-secret'), environment),
    ).resolves.toBe('dashboard');
  });

  it('rejects an unknown or absent token', async () => {
    await expect(
      resolveApolloConnectionRole(buildConnectionUrl('nope'), environment),
    ).resolves.toBeNull();
    await expect(
      resolveApolloConnectionRole(buildConnectionUrl(), environment),
    ).resolves.toBeNull();
    await expect(
      resolveApolloConnectionRole(buildConnectionUrl(''), environment),
    ).resolves.toBeNull();
  });

  it('rejects every token when the matching secret is unset', async () => {
    const environmentWithoutSecrets = createFakeApolloEnvironment({
      DEVICE_SHARED_SECRET: '',
      DASHBOARD_SHARED_SECRET: '',
    });
    await expect(
      resolveApolloConnectionRole(buildConnectionUrl(''), environmentWithoutSecrets),
    ).resolves.toBeNull();
    await expect(
      resolveApolloConnectionRole(
        buildConnectionUrl('dashboard-secret'),
        environmentWithoutSecrets,
      ),
    ).resolves.toBeNull();
  });
});
