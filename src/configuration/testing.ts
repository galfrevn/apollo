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
    Apollo: {} as Env['Apollo'],
    MEDIA: {} as Env['MEDIA'],
    VECTORIZE: {} as Env['VECTORIZE'],
    APOLLO_QUEUE: {} as Env['APOLLO_QUEUE'],
    BACKGROUND: {} as Env['BACKGROUND'],
    Sandbox: {} as Env['Sandbox'],
    ...overrides,
  };
}
