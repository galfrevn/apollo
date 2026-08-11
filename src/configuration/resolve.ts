import { defaultModelCatalog } from '@/configuration/models';

export type ApolloModelConfiguration = {
  readonly conversation: string;
  readonly transcription: string;
  readonly research: string;
  readonly coding: string;
  readonly embedding: string;
  readonly speech: string;
};

export type ApolloConfiguration = {
  readonly models: ApolloModelConfiguration;
};

function resolveOverridableValue(
  overrideValue: string | undefined,
  defaultValue: string,
): string {
  return overrideValue !== undefined && overrideValue.length > 0
    ? overrideValue
    : defaultValue;
}

// The single place deployment configuration is assembled. Today it reads
// environment overrides over code defaults; the runtime (wizard-managed)
// override layer lands on top of this same seam.
export function resolveApolloConfiguration(environment: Env): ApolloConfiguration {
  return {
    models: {
      conversation: resolveOverridableValue(
        environment.OPENROUTER_MODEL,
        defaultModelCatalog.conversation,
      ),
      transcription: resolveOverridableValue(
        environment.OPENROUTER_STT_MODEL,
        defaultModelCatalog.transcription,
      ),
      research: resolveOverridableValue(
        environment.OPENROUTER_RESEARCH_MODEL,
        defaultModelCatalog.research,
      ),
      coding: resolveOverridableValue(
        environment.OPENROUTER_CODING_MODEL,
        defaultModelCatalog.coding,
      ),
      embedding: resolveOverridableValue(
        environment.OPENROUTER_EMBEDDING_MODEL,
        defaultModelCatalog.embedding,
      ),
      speech: resolveOverridableValue(
        environment.ELEVENLABS_TTS_MODEL,
        defaultModelCatalog.speech,
      ),
    },
  };
}
