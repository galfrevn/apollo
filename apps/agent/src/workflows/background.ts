import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers';
import { getAgentByName } from 'agents';

import { sendEmailWithResend } from '@/notifications/email';
import { runDeepResearchWithPerplexity } from '@/search/deepresearch';
import { buildResearchDocumentObjectKey } from '@/search/keys';
import { synthesizeResearchSpokenSummary } from '@/search/synthesize';

export type ApolloBackgroundParams = {
  readonly prompt: string;
  readonly deviceId: string;
};

export class ApolloBackground extends WorkflowEntrypoint<Env, ApolloBackgroundParams> {
  async run(
    event: WorkflowEvent<ApolloBackgroundParams>,
    step: WorkflowStep,
  ): Promise<{ readonly summary: string; readonly documentKey?: string }> {
    // Sonar plans and runs its own multi-source searches: one long step
    // instead of the old plan → fetch → synthesize chain. A run can take a
    // few minutes, hence the generous retry delay.
    const reportMarkdown = await step.do(
      'deep-research',
      { retries: { limit: 2, delay: '30 seconds', backoff: 'exponential' } },
      async () =>
        runDeepResearchWithPerplexity({
          openRouterApiKey: this.env.OPENROUTER_API_KEY,
          modelId: this.env.OPENROUTER_RESEARCH_MODEL,
          prompt: event.payload.prompt,
          nowMilliseconds: Date.now(),
        }),
    );

    if (reportMarkdown.length === 0) {
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

    // The device only speaks a short summary; the full report goes to the
    // owner's inbox. Best-effort: no email config (or a send failure) must not
    // sink the research that already succeeded.
    await step.do('email-report', async () => {
      if (!this.env.RESEND_API_KEY) {
        return false;
      }
      try {
        await sendEmailWithResend({
          resendApiKey: this.env.RESEND_API_KEY,
          toAddress: this.env.APOLLO_OWNER_EMAIL,
          subject: `Informe de Apollo: ${event.payload.prompt.slice(0, 120)}`,
          textBody: reportMarkdown,
        });
        return true;
      } catch (error) {
        console.error(
          JSON.stringify({
            level: 'error',
            message: 'apollo_research_email_failed',
            error: error instanceof Error ? error.message : String(error),
          }),
        );
        return false;
      }
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
