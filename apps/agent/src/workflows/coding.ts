import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers';
import { getAgentByName } from 'agents';

import { mintCodingProxyToken } from '@/coding/proxy';
import { createR2BlobStore } from '@/platform/cloudflare/blob';
import { createWorkflowStepRunner } from '@/platform/cloudflare/steps';
import {
  executeCodingTaskRun,
  type CodingRunParams,
  type CodingRunResult,
  type CodingSandboxHandle,
} from '@/runs/coding';

export type ApolloCodingParams = CodingRunParams;
export type ApolloCodingResult = CodingRunResult;

export class ApolloCoding extends WorkflowEntrypoint<Env, ApolloCodingParams> {
  async run(
    event: WorkflowEvent<ApolloCodingParams>,
    step: WorkflowStep,
  ): Promise<ApolloCodingResult> {
    const sandboxNamespace = this.env.Sandbox;
    return executeCodingTaskRun({
      params: event.payload,
      instanceId: event.instanceId,
      steps: createWorkflowStepRunner(step),
      dependencies: {
        openRouterApiKey: this.env.OPENROUTER_API_KEY,
        codingModelId: this.env.OPENROUTER_CODING_MODEL,
        codingEngine: this.env.CODING_ENGINE,
        codingProxyOrigin: this.env.CODING_PROXY_ORIGIN,
        githubAppId: this.env.GITHUB_APP_ID,
        githubAppPrivateKeyPem: this.env.GITHUB_APP_PRIVATE_KEY,
        mediaBlobStore: createR2BlobStore(this.env.MEDIA),
        mintCodingProxyToken: (instanceId) =>
          mintCodingProxyToken({
            instanceId,
            openRouterApiKey: this.env.OPENROUTER_API_KEY,
            nowMilliseconds: Date.now(),
          }),
        createSandbox:
          sandboxNamespace === undefined
            ? undefined
            : (sandboxId) => createCodingSandbox(sandboxNamespace, sandboxId),
        notifyApollo: async (notification) => {
          const apollo = await getAgentByName(this.env.Apollo, event.payload.deviceId);
          await apollo.notifyBackgroundResult(notification);
        },
      },
    });
  }
}

async function createCodingSandbox(
  sandboxNamespace: NonNullable<Env['Sandbox']>,
  sandboxId: string,
): Promise<CodingSandboxHandle> {
  const { getSandbox } = await import('@cloudflare/sandbox');
  // keepAlive because the disk is wiped on sleep: the 10 minute default would
  // take the clone with it while the agent is still thinking.
  const sandbox = getSandbox(sandboxNamespace, sandboxId, {
    keepAlive: true,
    normalizeId: true,
  });
  return {
    exec: (command, options) => sandbox.exec(command, options),
    listFiles: async (path) => {
      const result = await sandbox.listFiles(path);
      return result.files.map((file) => ({
        path: file.absolutePath,
        isDirectory: file.type === 'directory',
      }));
    },
    readFile: (path) => sandbox.readFile(path),
    writeFile: async (path, content) => {
      await sandbox.writeFile(path, content);
    },
    destroy: () => sandbox.destroy(),
  };
}
