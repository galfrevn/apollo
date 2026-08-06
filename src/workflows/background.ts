import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers';
import { getAgentByName } from 'agents';

import { buildResearchDocumentObjectKey } from '@/search/keys';
import { collectFetchedSourceList } from '@/search/pipeline';
import {
  planResearchQueryList,
  synthesizeResearchReportMarkdown,
  synthesizeResearchSpokenSummary,
} from '@/search/synthesize';

export type ApolloBackgroundParams = {
  readonly prompt: string;
  readonly deviceId: string;
};

export class ApolloBackground extends WorkflowEntrypoint<Env, ApolloBackgroundParams> {
  async run(
    event: WorkflowEvent<ApolloBackgroundParams>,
    step: WorkflowStep,
  ): Promise<{ readonly summary: string; readonly documentKey?: string }> {
    const queryList = await step.do(
      'plan-queries',
      { retries: { limit: 2, delay: '5 seconds', backoff: 'exponential' } },
      async () =>
        planResearchQueryList({
          openRouterApiKey: this.env.OPENROUTER_API_KEY,
          modelId: this.env.OPENROUTER_MODEL,
          prompt: event.payload.prompt,
        }),
    );

    const sourceList = await step.do(
      'search-and-fetch',
      { retries: { limit: 2, delay: '5 seconds', backoff: 'exponential' } },
      async () =>
        collectFetchedSourceList({
          webSearch: this.env.WEBSEARCH,
          queryList,
          maxPages: 10,
          resultsPerQuery: 5,
        }),
    );

    if (sourceList.length === 0) {
      const failureSummary =
        'No pude conseguir fuentes web útiles para esa investigación.';
      await step.do('notify-apollo-failure', async () => {
        const apollo = await getAgentByName(this.env.Apollo, event.payload.deviceId);
        await apollo.notifyBackgroundResult({
          prompt: event.payload.prompt,
          summary: failureSummary,
        });
        return true;
      });
      return { summary: failureSummary };
    }

    const reportMarkdown = await step.do(
      'synthesize-report',
      { retries: { limit: 2, delay: '5 seconds', backoff: 'exponential' } },
      async () =>
        synthesizeResearchReportMarkdown({
          openRouterApiKey: this.env.OPENROUTER_API_KEY,
          modelId: this.env.OPENROUTER_MODEL,
          prompt: event.payload.prompt,
          sourceList,
        }),
    );

    const documentKey = buildResearchDocumentObjectKey(
      event.payload.deviceId,
      event.instanceId,
    );

    await step.do('persist-document', async () => {
      await this.env.MEDIA.put(documentKey, reportMarkdown, {
        httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
      });
      return true;
    });

    const spokenSummary = await step.do(
      'synthesize-spoken-summary',
      { retries: { limit: 2, delay: '5 seconds', backoff: 'exponential' } },
      async () =>
        synthesizeResearchSpokenSummary({
          openRouterApiKey: this.env.OPENROUTER_API_KEY,
          modelId: this.env.OPENROUTER_MODEL,
          prompt: event.payload.prompt,
          reportMarkdown,
        }),
    );

    await step.do('notify-apollo', async () => {
      const apollo = await getAgentByName(this.env.Apollo, event.payload.deviceId);
      await apollo.notifyBackgroundResult({
        prompt: event.payload.prompt,
        summary: spokenSummary,
        documentKey,
      });
      return true;
    });

    return { summary: spokenSummary, documentKey };
  }
}
