import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers';
import { getAgentByName } from 'agents';

import { createR2BlobStore } from '@/platform/cloudflare/blob';
import { createWorkflowStepRunner } from '@/platform/cloudflare/steps';
import {
  executeBackgroundResearchRun,
  type BackgroundRunParams,
  type BackgroundRunResult,
} from '@/runs/background';

export type ApolloBackgroundParams = BackgroundRunParams;

export class ApolloBackground extends WorkflowEntrypoint<Env, ApolloBackgroundParams> {
  async run(
    event: WorkflowEvent<ApolloBackgroundParams>,
    step: WorkflowStep,
  ): Promise<BackgroundRunResult> {
    return executeBackgroundResearchRun({
      params: event.payload,
      instanceId: event.instanceId,
      steps: createWorkflowStepRunner(step),
      dependencies: {
        openRouterApiKey: this.env.OPENROUTER_API_KEY,
        researchModelId: this.env.OPENROUTER_RESEARCH_MODEL,
        chatModelId: this.env.OPENROUTER_MODEL,
        resendApiKey: this.env.RESEND_API_KEY,
        ownerEmailAddress: this.env.APOLLO_OWNER_EMAIL,
        mediaBlobStore: createR2BlobStore(this.env.MEDIA),
        notifyApollo: async (notification) => {
          const apollo = await getAgentByName(this.env.Apollo, event.payload.deviceId);
          await apollo.notifyBackgroundResult(notification);
        },
      },
    });
  }
}
