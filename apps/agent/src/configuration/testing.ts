import type { MemorySqlExecutor } from '@/memory/store';
import type { DeskToolEffects } from '@/tools/types';

type PendingConfirmationRow = {
  readonly id: string;
  readonly tool_name: string;
  readonly args_json: string;
  readonly summary: string;
  readonly expires_at: number;
};

type McpToolSettingRow = {
  readonly namespaced_name: string;
  readonly server_id: string;
  readonly tool_name: string;
  readonly is_enabled: number;
  readonly safety: string;
};

export function createInMemoryPendingConfirmationSqlExecutor(): MemorySqlExecutor {
  let rowList: readonly PendingConfirmationRow[] = [];
  const fakeExecutor = {
    execute(query: string, ...bindValues: unknown[]): readonly PendingConfirmationRow[] {
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
        return rowList.slice(0, 1);
      }
      return [];
    },
  };
  // SAFETY: the fake only ever serves pending_confirmations columns, which is
  // exactly the Row shape every query against this table selects.
  return fakeExecutor as MemorySqlExecutor;
}

export function createInMemoryMcpToolSettingsSqlExecutor(
  initialRowList: readonly McpToolSettingRow[] = [],
): MemorySqlExecutor {
  let rowList: readonly McpToolSettingRow[] = [...initialRowList];
  const fakeExecutor = {
    execute(query: string, ...bindValues: unknown[]): readonly McpToolSettingRow[] {
      if (query.startsWith('DELETE FROM mcp_tool_settings')) {
        const removedServerId = String(bindValues[0]);
        rowList = rowList.filter((row) => row.server_id !== removedServerId);
        return [];
      }
      if (query.startsWith('INSERT INTO mcp_tool_settings')) {
        const insertedRow = {
          namespaced_name: String(bindValues[0]),
          server_id: String(bindValues[1]),
          tool_name: String(bindValues[2]),
          is_enabled: Number(bindValues[3]),
          safety: String(bindValues[4]),
        };
        rowList = [
          ...rowList.filter((row) => row.namespaced_name !== insertedRow.namespaced_name),
          insertedRow,
        ];
        return [];
      }
      if (query.includes('FROM mcp_tool_settings')) {
        return rowList;
      }
      return [];
    },
  };
  // SAFETY: the fake only ever serves mcp_tool_settings columns, which is
  // exactly the Row shape every query against this table selects.
  return fakeExecutor as MemorySqlExecutor;
}

export function createFakeMediaBucket(
  initialObjectMap: Record<string, string | Uint8Array> = {},
): Env['MEDIA'] {
  const storedObjectMap = new Map<string, Uint8Array>(
    Object.entries(initialObjectMap).map(([objectKey, content]) => [
      objectKey,
      content instanceof Uint8Array ? content : new TextEncoder().encode(content),
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
          const parsedJson: unknown = JSON.parse(storedText);
          return parsedJson;
        },
      };
    },
    async put(objectKey: string, content: string | ArrayBuffer | Uint8Array) {
      const contentBytes =
        content instanceof Uint8Array
          ? new Uint8Array(content)
          : content instanceof ArrayBuffer
            ? new Uint8Array(content)
            : new TextEncoder().encode(content);
      storedObjectMap.set(objectKey, contentBytes);
      return null;
    },
  };
  // SAFETY: specs exercise only get and put on the media bucket; no other
  // R2Bucket member is ever read through this fake.
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
  // SAFETY: specs read only the vars, secrets, and owner email above the
  // binding stubs; the empty binding objects exist to satisfy Env's shape and
  // are never invoked unless a test overrides them with a working fake.
  return {
    OPENROUTER_MODEL: 'deepseek/deepseek-v4-flash-0731',
    OPENROUTER_STT_MODEL: 'openai/whisper-large-v3',
    OPENROUTER_RESEARCH_MODEL: 'perplexity/sonar-deep-research',
    OPENROUTER_CODING_MODEL: 'moonshotai/kimi-k3',
    ELEVENLABS_TTS_MODEL: 'eleven_multilingual_v2',
    OPENROUTER_EMBEDDING_MODEL: 'openai/text-embedding-3-small',
    DEVICE_SHARED_SECRET: 'secret',
    DASHBOARD_SHARED_SECRET: 'dashboard-secret',
    OPENROUTER_API_KEY: '',
    ELEVENLABS_API_KEY: '',
    TAVILY_API_KEY: '',
    RESEND_API_KEY: '',
    GITHUB_APP_ID: '',
    GITHUB_APP_PRIVATE_KEY: '',
    APOLLO_OWNER_EMAIL: 'owner@example.com',
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
    searchThreadHistory: async () => [],
    resumeConversationThread: async () => undefined,
    addListItem: async ({ listName, content }) => ({
      id: 'stub-item',
      listName,
      content,
      createdAt: 0,
    }),
    listListItems: async () => [],
    removeListItems: async () => ({ removedCount: 0, removedContentList: [] }),
    callDeviceTool: async () => ({ ok: false, summary: 'stub' }),
    callInstalledMcpTool: async () => ({ ok: false, summary: 'stub' }),
    ...overrides,
  };
}
