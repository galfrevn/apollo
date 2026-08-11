// Default model ids live in code instead of wrangler vars: vars freeze into
// literal types whose values must be committed to the public repo, while these
// defaults can be overridden per deployment through plain environment values.
export const defaultModelCatalog = {
  conversation: 'deepseek/deepseek-v4-flash-0731',
  transcription: 'openai/whisper-large-v3',
  research: 'perplexity/sonar-deep-research',
  coding: 'moonshotai/kimi-k3',
  embedding: 'openai/text-embedding-3-small',
  speech: 'eleven_multilingual_v2',
} as const;
