import { z } from 'zod';

const hostConfigurationSchema = z.object({
  APOLLO_HOST_PORT: z.coerce.number().int().min(0).max(65_535).default(8799),
  APOLLO_DATA_DIRECTORY: z.string().min(1).default('./data'),
  APOLLO_DEVICE_NAME: z.string().min(1).default('desk'),
  DEVICE_SHARED_SECRET: z.string().min(1),
  DASHBOARD_SHARED_SECRET: z.string().min(1),
  OPENROUTER_API_KEY: z.string().default(''),
  ELEVENLABS_API_KEY: z.string().default(''),
  TAVILY_API_KEY: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
  GITHUB_APP_ID: z.string().default(''),
  GITHUB_APP_PRIVATE_KEY: z.string().default(''),
  APOLLO_OWNER_EMAIL: z.string().optional(),
  MOCK_VOICE: z.string().optional(),
  CODING_PROXY_ORIGIN: z.string().optional(),
  CODING_ENGINE: z.string().optional(),
  FIRMWARE_PUSH_DISABLED: z.string().optional(),
  OPENROUTER_MODEL: z.string().default('deepseek/deepseek-v4-flash-0731'),
  OPENROUTER_STT_MODEL: z.string().default('openai/whisper-large-v3'),
  OPENROUTER_RESEARCH_MODEL: z.string().default('perplexity/sonar-deep-research'),
  OPENROUTER_CODING_MODEL: z.string().default('moonshotai/kimi-k3'),
  ELEVENLABS_TTS_MODEL: z.string().default('eleven_multilingual_v2'),
  OPENROUTER_EMBEDDING_MODEL: z.string().default('openai/text-embedding-3-small'),
});

export type HostConfiguration = {
  readonly port: number;
  readonly dataDirectory: string;
  readonly deviceName: string;
  readonly environment: Env;
};

export function parseHostConfiguration(
  processEnvironment: Record<string, string | undefined>,
): HostConfiguration {
  const parsedConfiguration = hostConfigurationSchema.parse(processEnvironment);
  const {
    APOLLO_HOST_PORT: port,
    APOLLO_DATA_DIRECTORY: dataDirectory,
    APOLLO_DEVICE_NAME: deviceName,
    ...environmentValueMap
  } = parsedConfiguration;
  // SAFETY: wrangler generates the model vars as literal types, but at runtime
  // they are plain strings on both hosts; the empty binding stubs mirror
  // createFakeApolloEnvironment and are never read, because host code reaches
  // storage exclusively through the platform ports.
  const environment: Env = {
    ...environmentValueMap,
    OPENROUTER_MODEL: environmentValueMap.OPENROUTER_MODEL as Env['OPENROUTER_MODEL'],
    OPENROUTER_STT_MODEL:
      environmentValueMap.OPENROUTER_STT_MODEL as Env['OPENROUTER_STT_MODEL'],
    OPENROUTER_RESEARCH_MODEL:
      environmentValueMap.OPENROUTER_RESEARCH_MODEL as Env['OPENROUTER_RESEARCH_MODEL'],
    OPENROUTER_CODING_MODEL:
      environmentValueMap.OPENROUTER_CODING_MODEL as Env['OPENROUTER_CODING_MODEL'],
    ELEVENLABS_TTS_MODEL:
      environmentValueMap.ELEVENLABS_TTS_MODEL as Env['ELEVENLABS_TTS_MODEL'],
    OPENROUTER_EMBEDDING_MODEL:
      environmentValueMap.OPENROUTER_EMBEDDING_MODEL as Env['OPENROUTER_EMBEDDING_MODEL'],
    Apollo: {} as Env['Apollo'],
    MEDIA: {} as Env['MEDIA'],
    VECTORIZE: {} as Env['VECTORIZE'],
    APOLLO_QUEUE: {} as Env['APOLLO_QUEUE'],
    BACKGROUND: {} as Env['BACKGROUND'],
    CODING: {} as Env['CODING'],
  };
  return { port, dataDirectory, deviceName, environment };
}
