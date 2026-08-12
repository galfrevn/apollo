import { describe, expect, it } from 'bun:test';

import { consoleConnectionSchema } from '@/connection/schema';

describe('console connection schema', () => {
  it('accepts a worker url with device name and secret, trimming trailing slashes', () => {
    const parsedConnection = consoleConnectionSchema.parse({
      workerUrl: 'https://apollo.example.workers.dev/',
      deviceName: 'desk',
      secret: 'dashboard-secret',
    });
    expect(parsedConnection.workerUrl).toBe('https://apollo.example.workers.dev');
  });

  it('rejects a non-url worker origin and empty fields', () => {
    expect(
      consoleConnectionSchema.safeParse({
        workerUrl: 'not-a-url',
        deviceName: 'desk',
        secret: 's',
      }).success,
    ).toBe(false);
    expect(
      consoleConnectionSchema.safeParse({
        workerUrl: 'https://apollo.example.workers.dev',
        deviceName: '',
        secret: 's',
      }).success,
    ).toBe(false);
    expect(
      consoleConnectionSchema.safeParse({
        workerUrl: 'https://apollo.example.workers.dev',
        deviceName: 'desk',
        secret: '',
      }).success,
    ).toBe(false);
  });
});
