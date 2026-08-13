import { afterEach, describe, expect, it } from 'bun:test';

import {
  buildTestRsaPrivateKeyPem,
  createFakeApolloEnvironment,
  createStubDeskToolEffects,
} from '@/configuration/testing';
import { createBuiltinToolDefinitionMap } from '@/tools/catalog';
import { listCodingRepositoriesTool, startCodingTaskTool } from '@/tools/coding';
import { executeToolByName } from '@/tools/router';

const fakeEnvironment = createFakeApolloEnvironment();

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubGithubFetch(installedFullNameList: readonly string[]): void {
  const fetchHandler = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    if (url.includes('/access_tokens')) {
      return new Response(
        JSON.stringify({ token: 'ghs_token', expires_at: '2026-08-10T13:00:00Z' }),
        { status: 201 },
      );
    }
    if (url.includes('/app/installations')) {
      return new Response(JSON.stringify([{ id: 7 }]), { status: 200 });
    }
    if (url.includes('/installation/repositories')) {
      return new Response(
        JSON.stringify({
          repositories: installedFullNameList.map((fullName) => ({
            full_name: fullName,
          })),
        }),
        { status: 200 },
      );
    }
    return new Response('{}', { status: 500 });
  };
  globalThis.fetch = Object.assign(fetchHandler, {
    preconnect: () => {},
  });
}

async function buildConfiguredEnvironment(): Promise<Env> {
  return createFakeApolloEnvironment({
    GITHUB_APP_ID: '123456',
    GITHUB_APP_PRIVATE_KEY: await buildTestRsaPrivateKeyPem(),
  });
}

describe('listCodingRepositoriesTool', () => {
  it('speaks the installation list', async () => {
    stubGithubFetch(['galfrevn/apollo', 'galfrevn/dotfiles']);

    const result = await listCodingRepositoriesTool.handler(
      {},
      {
        environment: await buildConfiguredEnvironment(),
        nowMilliseconds: 1_700_000_000_000,
      },
    );

    expect(result.ok).toBe(true);
    expect(result.summary).toContain('galfrevn/apollo');
    expect(result.summary).toContain('galfrevn/dotfiles');
  });

  it('reports the configuration gap when the app is missing', async () => {
    const result = await listCodingRepositoriesTool.handler(
      {},
      { environment: fakeEnvironment, nowMilliseconds: 0 },
    );

    expect(result.ok).toBe(false);
    expect(result.summary).toContain('GITHUB_APP_ID');
  });
});

describe('startCodingTaskTool', () => {
  it('requires confirmation before anything is enqueued', async () => {
    const enqueuedList: { repository: string; task: string }[] = [];
    const outcome = await executeToolByName(
      createBuiltinToolDefinitionMap(),
      'start_coding_task',
      { repository: 'galfrevn/apollo', task: 'arreglar el typo del readme' },
      {
        environment: fakeEnvironment,
        nowMilliseconds: 0,
        deviceId: 'desk-01',
        effects: createStubDeskToolEffects({
          enqueueCodingTask: async (input) => {
            enqueuedList.push(input);
          },
        }),
      },
      () => 'confirm-1',
    );

    expect(outcome.status).toBe('needs_confirm');
    expect(enqueuedList).toHaveLength(0);
    if (outcome.status === 'needs_confirm') {
      expect(outcome.pending.summary).toContain('galfrevn/apollo');
      expect(outcome.pending.summary).toContain('arreglar el typo');
    }
  });

  it('enqueues a normalized repository once the handler runs', async () => {
    const enqueuedList: { repository: string; task: string }[] = [];

    const result = await startCodingTaskTool.handler(
      {
        repository: 'https://github.com/galfrevn/apollo.git',
        task: 'agregar un test',
      },
      {
        environment: fakeEnvironment,
        nowMilliseconds: 0,
        deviceId: 'desk-01',
        effects: createStubDeskToolEffects({
          enqueueCodingTask: async (input) => {
            enqueuedList.push(input);
          },
        }),
      },
    );

    expect(result.ok).toBe(true);
    expect(enqueuedList).toEqual([
      { repository: 'galfrevn/apollo', task: 'agregar un test' },
    ]);
  });

  it('refuses an unparseable repository without enqueueing anything', async () => {
    const enqueuedList: { repository: string; task: string }[] = [];

    const result = await startCodingTaskTool.handler(
      { repository: 'no es un repo', task: 'hacer algo' },
      {
        environment: fakeEnvironment,
        nowMilliseconds: 0,
        deviceId: 'desk-01',
        effects: createStubDeskToolEffects({
          enqueueCodingTask: async (input) => {
            enqueuedList.push(input);
          },
        }),
      },
    );

    expect(result.ok).toBe(false);
    expect(enqueuedList).toHaveLength(0);
  });

  it('resolves a spoken name against the installed repositories', async () => {
    stubGithubFetch(['galfrevn/apollo', 'galfrevn/apollo-firmware']);
    const enqueuedList: { repository: string; task: string }[] = [];

    const result = await startCodingTaskTool.handler(
      { repository: 'el repo apollo firmware', task: 'agregar un test' },
      {
        environment: await buildConfiguredEnvironment(),
        nowMilliseconds: 1_700_000_000_000,
        deviceId: 'desk-01',
        effects: createStubDeskToolEffects({
          enqueueCodingTask: async (input) => {
            enqueuedList.push(input);
          },
        }),
      },
    );

    expect(result.ok).toBe(true);
    expect(enqueuedList).toEqual([
      { repository: 'galfrevn/apollo-firmware', task: 'agregar un test' },
    ]);
  });

  it('asks which candidate instead of guessing an ambiguous name', async () => {
    stubGithubFetch(['galfrevn/apollo', 'galfrevn/apollo-firmware']);
    const enqueuedList: { repository: string; task: string }[] = [];

    const result = await startCodingTaskTool.handler(
      { repository: 'apol', task: 'hacer algo' },
      {
        environment: await buildConfiguredEnvironment(),
        nowMilliseconds: 1_700_000_000_000,
        deviceId: 'desk-01',
        effects: createStubDeskToolEffects({
          enqueueCodingTask: async (input) => {
            enqueuedList.push(input);
          },
        }),
      },
    );

    expect(result.ok).toBe(false);
    expect(result.summary).toContain('galfrevn/apollo');
    expect(result.summary).toContain('galfrevn/apollo-firmware');
    expect(enqueuedList).toHaveLength(0);
  });

  it('answers with the available repositories for an unknown name', async () => {
    stubGithubFetch(['galfrevn/apollo']);
    const enqueuedList: { repository: string; task: string }[] = [];

    const result = await startCodingTaskTool.handler(
      { repository: 'inexistente', task: 'hacer algo' },
      {
        environment: await buildConfiguredEnvironment(),
        nowMilliseconds: 1_700_000_000_000,
        deviceId: 'desk-01',
        effects: createStubDeskToolEffects({
          enqueueCodingTask: async (input) => {
            enqueuedList.push(input);
          },
        }),
      },
    );

    expect(result.ok).toBe(false);
    expect(result.summary).toContain('galfrevn/apollo');
    expect(enqueuedList).toHaveLength(0);
  });
});
