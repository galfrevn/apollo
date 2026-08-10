import type { DeskToolEffects } from '@/tools/types';

export function createFakeApolloEnvironment(overrides: Partial<Env> = {}): Env {
  return {
    OPENROUTER_MODEL: 'deepseek/deepseek-v4-flash-0731',
    OPENROUTER_STT_MODEL: 'openai/whisper-large-v3',
    OPENROUTER_RESEARCH_MODEL: 'perplexity/sonar-deep-research',
    ELEVENLABS_TTS_MODEL: 'eleven_multilingual_v2',
    OPENROUTER_EMBEDDING_MODEL: 'openai/text-embedding-3-small',
    DEVICE_SHARED_SECRET: 'secret',
    OPENROUTER_API_KEY: '',
    ELEVENLABS_API_KEY: '',
    TAVILY_API_KEY: '',
    RESEND_API_KEY: '',
    APOLLO_OWNER_EMAIL: 'galfre.vn@gmail.com',
    Apollo: {} as Env['Apollo'],
    MEDIA: {} as Env['MEDIA'],
    VECTORIZE: {} as Env['VECTORIZE'],
    APOLLO_QUEUE: {} as Env['APOLLO_QUEUE'],
    BACKGROUND: {} as Env['BACKGROUND'],
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
    scheduleReminder: async () => {},
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
    ...overrides,
  };
}
