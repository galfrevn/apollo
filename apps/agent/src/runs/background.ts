import type { z } from 'zod';

import type { notifyBackgroundResultInputSchema } from '@/agents/rpc';
import { sendEmailWithResend } from '@/notifications/email';
import type { BlobStore } from '@/platform/blob';
import type { StepRunner } from '@/platform/steps';
import { runDeepResearchWithPerplexity } from '@/search/deepresearch';
import { buildResearchDocumentObjectKey } from '@/search/keys';
import { synthesizeResearchSpokenSummary } from '@/search/synthesize';

export type BackgroundRunParams = {
  readonly prompt: string;
  readonly deviceId: string;
};

export type BackgroundRunResult = {
  readonly summary: string;
  readonly documentKey?: string;
};

type BackgroundResultNotification = z.infer<typeof notifyBackgroundResultInputSchema>;

export type BackgroundRunDependencies = {
  readonly openRouterApiKey: string;
  readonly researchModelId: string;
  readonly chatModelId: string;
  readonly resendApiKey: string | undefined;
  readonly ownerEmailAddress: string | undefined;
  readonly mediaBlobStore: BlobStore;
  readonly notifyApollo: (notification: BackgroundResultNotification) => Promise<void>;
};

export async function executeBackgroundResearchRun(input: {
  readonly params: BackgroundRunParams;
  readonly instanceId: string;
  readonly steps: StepRunner;
  readonly dependencies: BackgroundRunDependencies;
}): Promise<BackgroundRunResult> {
  const { params, instanceId, steps, dependencies } = input;

  // Sonar plans and runs its own multi-source searches: one long step
  // instead of the old plan → fetch → synthesize chain. A run can take a
  // few minutes, hence the generous retry delay.
  const reportMarkdown = await steps.do(
    'deep-research',
    { retries: { limit: 2, delayMilliseconds: 30_000, backoff: 'exponential' } },
    async () =>
      runDeepResearchWithPerplexity({
        openRouterApiKey: dependencies.openRouterApiKey,
        modelId: dependencies.researchModelId,
        prompt: params.prompt,
        nowMilliseconds: Date.now(),
      }),
  );

  if (reportMarkdown.length === 0) {
    const failureSummary = 'No pude conseguir fuentes web útiles para esa investigación.';
    await steps.do('notify-apollo-failure', async () => {
      await dependencies.notifyApollo({
        prompt: params.prompt,
        summary: failureSummary,
      });
      return true;
    });
    return { summary: failureSummary };
  }

  const documentKey = buildResearchDocumentObjectKey(params.deviceId, instanceId);

  await steps.do('persist-document', async () => {
    await dependencies.mediaBlobStore.put(documentKey, reportMarkdown, {
      contentType: 'text/markdown; charset=utf-8',
    });
    return true;
  });

  // The device only speaks a short summary; the full report goes to the
  // owner's inbox. Best-effort: no email config (or a send failure) must not
  // sink the research that already succeeded.
  await steps.do('email-report', async () => {
    const ownerEmailAddress = dependencies.ownerEmailAddress;
    if (!dependencies.resendApiKey || !ownerEmailAddress) {
      return false;
    }
    try {
      await sendEmailWithResend({
        resendApiKey: dependencies.resendApiKey,
        toAddress: ownerEmailAddress,
        subject: `Informe de Apollo: ${params.prompt.slice(0, 120)}`,
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

  const spokenSummary = await steps.do(
    'synthesize-spoken-summary',
    { retries: { limit: 2, delayMilliseconds: 5_000, backoff: 'exponential' } },
    async () =>
      synthesizeResearchSpokenSummary({
        openRouterApiKey: dependencies.openRouterApiKey,
        modelId: dependencies.chatModelId,
        prompt: params.prompt,
        reportMarkdown,
      }),
  );

  await steps.do('notify-apollo', async () => {
    await dependencies.notifyApollo({
      prompt: params.prompt,
      summary: spokenSummary,
      documentKey,
    });
    return true;
  });

  return { summary: spokenSummary, documentKey };
}
