import type { MemorySqlExecutor } from '@/memory/store';
import type { DeskToolEffects } from '@/tools/types';

export function createInMemoryPendingConfirmationSqlExecutor(): MemorySqlExecutor {
  let rowList: readonly Record<string, unknown>[] = [];
  return {
    execute<Row extends Record<string, unknown>>(
      query: string,
      ...bindValues: unknown[]
    ): readonly Row[] {
      if (query.startsWith('DELETE FROM pending_confirmations')) {
        rowList = [];
        return [];
      }
      if (query.startsWith('INSERT INTO pending_confirmations')) {
        rowList = [
          ...rowList,
          {
            id: String(bindValues[0]),
            tool_name: String(bindValues[1]),
            args_json: String(bindValues[2]),
            summary: String(bindValues[3]),
            expires_at: Number(bindValues[4]),
          },
        ];
        return [];
      }
      if (query.includes('FROM pending_confirmations')) {
        return rowList.slice(0, 1) as readonly Row[];
      }
      return [];
    },
  };
}

export function createFakeMediaBucket(
  initialObjectMap: Record<string, string | Uint8Array> = {},
): Env['MEDIA'] {
  const storedObjectMap = new Map<string, Uint8Array>(
    Object.entries(initialObjectMap).map(([objectKey, content]) => [
      objectKey,
      typeof content === 'string' ? new TextEncoder().encode(content) : content,
    ]),
  );
  const partialBucket = {
    async get(objectKey: string) {
      const storedBytes = storedObjectMap.get(objectKey);
      if (storedBytes === undefined) {
        return null;
      }
      const storedText = new TextDecoder().decode(storedBytes);
      return {
        size: storedBytes.byteLength,
        body: new Response(storedBytes).body,
        async arrayBuffer() {
          return storedBytes.buffer.slice(
            storedBytes.byteOffset,
            storedBytes.byteOffset + storedBytes.byteLength,
          );
        },
        async text() {
          return storedText;
        },
        async json() {
          return JSON.parse(storedText) as unknown;
        },
      };
    },
    async put(objectKey: string, content: string | ArrayBuffer | Uint8Array) {
      const contentBytes =
        typeof content === 'string'
          ? new TextEncoder().encode(content)
          : new Uint8Array(content instanceof ArrayBuffer ? content : content);
      storedObjectMap.set(objectKey, contentBytes);
      return null;
    },
  };
  return partialBucket as Env['MEDIA'];
}

export async function buildTestRsaPrivateKeyPem(): Promise<string> {
  const generatedKey = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  if (!('privateKey' in generatedKey)) {
    throw new Error('generateKey did not return a key pair');
  }
  const exportedKey = await crypto.subtle.exportKey('pkcs8', generatedKey.privateKey);
  if (!(exportedKey instanceof ArrayBuffer)) {
    throw new Error('exportKey did not return pkcs8 bytes');
  }
  const pkcs8Bytes = new Uint8Array(exportedKey);
  let binaryText = '';
  for (const byte of pkcs8Bytes) {
    binaryText += String.fromCharCode(byte);
  }
  const base64Body = btoa(binaryText).replaceAll(/(.{64})/g, '$1\n');
  return `-----BEGIN PRIVATE KEY-----\n${base64Body}\n-----END PRIVATE KEY-----`;
}

export function createFakeApolloEnvironment(overrides: Partial<Env> = {}): Env {
  return {
    OPENROUTER_MODEL: 'deepseek/deepseek-v4-flash-0731',
    OPENROUTER_STT_MODEL: 'openai/whisper-large-v3',
    OPENROUTER_RESEARCH_MODEL: 'perplexity/sonar-deep-research',
    OPENROUTER_CODING_MODEL: 'moonshotai/kimi-k3',
    ELEVENLABS_TTS_MODEL: 'eleven_multilingual_v2',
    OPENROUTER_EMBEDDING_MODEL: 'openai/text-embedding-3-small',
    DEVICE_SHARED_SECRET: 'secret',
    OPENROUTER_API_KEY: '',
    ELEVENLABS_API_KEY: '',
    TAVILY_API_KEY: '',
    RESEND_API_KEY: '',
    GITHUB_APP_ID: '',
    GITHUB_APP_PRIVATE_KEY: '',
    APOLLO_OWNER_EMAIL: 'galfre.vn@gmail.com',
    Apollo: {} as Env['Apollo'],
    MEDIA: {} as Env['MEDIA'],
    VECTORIZE: {} as Env['VECTORIZE'],
    APOLLO_QUEUE: {} as Env['APOLLO_QUEUE'],
    BACKGROUND: {} as Env['BACKGROUND'],
    CODING: {} as Env['CODING'],
    Sandbox: {} as Env['Sandbox'],
    ...overrides,
  };
}

// A complete no-op DeskToolEffects so a test can override just the handful of
// effects it exercises, instead of casting a partial object into the type.
export function createStubDeskToolEffects(
  overrides: Partial<DeskToolEffects> = {},
): DeskToolEffects {
  return {
    persistMemory: async (content) => ({ memoryId: 'stub-memory', content }),
    applyFocusMinutes: async () => {},
    clearFocus: async () => {},
    enqueueResearch: async () => {},
    enqueueCodingTask: async () => {},
    scheduleReminder: async () => {},
    broadcastTimerProgress: async () => {},
    listReminders: async () => [],
    cancelReminders: async () => ({ cancelledCount: 0, cancelledMessageList: [] }),
    resolveWeatherLocation: async () => ({
      latitude: -34.6,
      longitude: -58.38,
      locationLabel: 'Buenos Aires',
      timezone: 'America/Argentina/Buenos_Aires',
    }),
    persistWeatherLocation: async () => {},
    addListItem: async ({ listName, content }) => ({
      id: 'stub-item',
      listName,
      content,
      createdAt: 0,
    }),
    listListItems: async () => [],
    removeListItems: async () => ({ removedCount: 0, removedContentList: [] }),
    callDeviceTool: async () => ({ ok: false, summary: 'stub' }),
    ...overrides,
  };
}
