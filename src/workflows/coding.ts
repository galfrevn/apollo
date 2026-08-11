import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers';
import { getAgentByName } from 'agents';

import { runCodingAgent } from '@/coding/agent';
import { buildCodingBranchName } from '@/coding/git';
import { runOpencodeAgent } from '@/coding/opencode';
import { mintCodingProxyToken, resolveCodingProxySigningSecret } from '@/coding/proxy';
import { resolveApolloConfiguration } from '@/configuration/resolve';
import {
  buildCodingDocumentObjectKey,
  buildCodingPublishSandboxId,
  buildCodingSandboxId,
} from '@/coding/keys';
import {
  buildAgentSandboxPort,
  extractCodingChanges,
  prepareCodingWorkspace,
  publishCodingChanges,
  type SandboxLike,
} from '@/coding/run';
import {
  createGithubPullRequest,
  resolveGithubAppCommitIdentity,
  resolveGithubDefaultBranch,
} from '@/github/api';
import {
  createGithubInstallationTokenForRepository,
  signGithubAppJsonWebToken,
} from '@/github/app';
import {
  parseGithubRepositoryReference,
  redactSecretsFromText,
} from '@/github/repository';
import { chatWithOpenRouter } from '@/voice/llm';

export type ApolloCodingParams = {
  readonly repository: string;
  readonly task: string;
  readonly deviceId: string;
};

export type ApolloCodingResult = {
  readonly summary: string;
  readonly pullRequestUrl?: string;
};

export class ApolloCoding extends WorkflowEntrypoint<Env, ApolloCodingParams> {
  async run(
    event: WorkflowEvent<ApolloCodingParams>,
    step: WorkflowStep,
  ): Promise<ApolloCodingResult> {
    const repository = parseGithubRepositoryReference(event.payload.repository);
    const repositoryLabel = `${repository.owner}/${repository.repository}`;
    const agentSandboxId = buildCodingSandboxId(event.instanceId);
    const publishSandboxId = buildCodingPublishSandboxId(event.instanceId);

    // First and outside the container: a repository the App was never installed
    // on fails here, before a container boots or a model token is spent.
    const setup = await step.do('resolve-github-access', async () => {
      const installationToken = await createGithubInstallationTokenForRepository({
        repository,
        appId: this.env.GITHUB_APP_ID,
        privateKeyPem: this.env.GITHUB_APP_PRIVATE_KEY,
        nowMilliseconds: Date.now(),
      });
      const appJsonWebToken = await signGithubAppJsonWebToken({
        appId: this.env.GITHUB_APP_ID,
        privateKeyPem: this.env.GITHUB_APP_PRIVATE_KEY,
        nowMilliseconds: Date.now(),
      });
      const [baseBranch, commitIdentity] = await Promise.all([
        resolveGithubDefaultBranch({
          repository,
          installationToken: installationToken.token,
        }),
        resolveGithubAppCommitIdentity({ appJsonWebToken }),
      ]);
      return { baseBranch, commitIdentity };
    });

    const branchName = await step.do('choose-branch', async () =>
      buildCodingBranchName(event.payload.task, () => event.instanceId.slice(0, 8)),
    );

    try {
      await step.do('prepare-workspace', async () => {
        const sandbox = await this.#getSandbox(agentSandboxId);
        const installationToken = await this.#mintInstallationToken(repository);
        await prepareCodingWorkspace({
          sandbox,
          repository,
          baseBranch: setup.baseBranch,
          installationToken,
        });
        return true;
      });

      const agentOutcome = await step.do(
        'run-coding-agent',
        { retries: { limit: 1, delay: '10 seconds', backoff: 'constant' } },
        async () => {
          const sandbox = await this.#getSandbox(agentSandboxId);
          // opencode manages its own loop and context; the hand-rolled agent
          // stays as the fallback while the proxy origin is unset, and as an
          // escape hatch behind CODING_ENGINE=legacy.
          const proxyOrigin = this.env.CODING_PROXY_ORIGIN;
          const codingModelId = resolveApolloConfiguration(this.env).models.coding;
          if (this.env.CODING_ENGINE !== 'legacy' && proxyOrigin !== undefined) {
            return runOpencodeAgent({
              sandbox,
              proxyOrigin,
              proxyToken: await mintCodingProxyToken({
                instanceId: event.instanceId,
                signingSecret: resolveCodingProxySigningSecret(this.env),
                nowMilliseconds: Date.now(),
              }),
              modelId: codingModelId,
              taskText: event.payload.task,
            });
          }
          return runCodingAgent({
            sandbox: buildAgentSandboxPort(sandbox),
            callLlm: async ({ messageList, toolDefinitionList }) =>
              chatWithOpenRouter({
                openRouterApiKey: this.env.OPENROUTER_API_KEY,
                modelId: codingModelId,
                messageList,
                toolDefinitionList,
              }),
            repositoryLabel,
            taskText: event.payload.task,
          });
        },
      );

      const extraction = await step.do('extract-changes', async () => {
        const sandbox = await this.#getSandbox(agentSandboxId);
        return extractCodingChanges({ sandbox });
      });

      if (!extraction.hasChanges) {
        // A read-only task (audit, review) legitimately changes nothing: the
        // agent's reply is the deliverable, not a fallback line.
        const summary =
          agentOutcome.summary.length > 0
            ? agentOutcome.summary
            : agentOutcome.didReachRoundLimit
              ? `Me quedé sin vueltas en ${repositoryLabel} y no llegué a cambiar nada.`
              : `Revisé ${repositoryLabel} y no hizo falta cambiar nada.`;
        const documentKey = buildCodingDocumentObjectKey(
          event.payload.deviceId,
          event.instanceId,
        );
        await step.do('persist-log', async () => {
          const runLog = buildRunLog({
            repositoryLabel,
            taskText: event.payload.task,
            branchName,
            agentSummary: agentOutcome.summary,
            transcript: agentOutcome.transcript,
          });
          await this.env.MEDIA.put(documentKey, redactSecretsFromText(runLog), {
            httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
          });
          return true;
        });
        await this.#notifyDevice(
          event.payload.deviceId,
          event.payload.task,
          summary,
          documentKey,
        );
        return { summary };
      }

      // Minted again rather than reused: a token lasts an hour and the agent
      // loop above can run longer than that.
      await step.do('publish-changes', async () => {
        const sandbox = await this.#getSandbox(publishSandboxId);
        const installationToken = await this.#mintInstallationToken(repository);
        await publishCodingChanges({
          sandbox,
          repository,
          baseBranch: setup.baseBranch,
          branchName,
          commitIdentity: setup.commitIdentity,
          commitMessage: buildCommitMessage(event.payload.task),
          patchText: extraction.patchText,
          installationToken,
        });
        return true;
      });

      const pullRequest = await step.do('open-pull-request', async () => {
        const installationToken = await this.#mintInstallationToken(repository);
        return createGithubPullRequest({
          repository,
          installationToken,
          headBranch: branchName,
          baseBranch: setup.baseBranch,
          title: buildCommitMessage(event.payload.task),
          body: buildPullRequestBody({
            taskText: event.payload.task,
            agentSummary: agentOutcome.summary,
            changedFileSummary: extraction.changedFileSummary,
          }),
        });
      });

      const documentKey = buildCodingDocumentObjectKey(
        event.payload.deviceId,
        event.instanceId,
      );
      await step.do('persist-log', async () => {
        const runLog = buildRunLog({
          repositoryLabel,
          taskText: event.payload.task,
          branchName,
          agentSummary: agentOutcome.summary,
          transcript: agentOutcome.transcript,
          pullRequestUrl: pullRequest.url,
        });
        await this.env.MEDIA.put(documentKey, redactSecretsFromText(runLog), {
          httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
        });
        return true;
      });

      const summary = `${agentOutcome.summary} Dejé el pull request ${pullRequest.number} en ${repositoryLabel}.`;
      await this.#notifyDevice(
        event.payload.deviceId,
        event.payload.task,
        summary,
        documentKey,
      );
      return { summary, pullRequestUrl: pullRequest.url };
    } finally {
      // Billing runs while the container is alive, so this runs even on
      // failure — but it must not turn a finished run into a failed one, nor
      // bury the error that brought us here.
      await step.do('destroy-sandbox', async () => {
        const destroyedList = await Promise.all(
          [agentSandboxId, publishSandboxId].map(async (sandboxId) => {
            try {
              const sandbox = await this.#getSandbox(sandboxId);
              await sandbox.destroy();
              return true;
            } catch (error) {
              console.error(
                JSON.stringify({
                  level: 'error',
                  message: 'apollo_coding_sandbox_destroy_failed',
                  sandboxId,
                  error: error instanceof Error ? error.message : String(error),
                }),
              );
              return false;
            }
          }),
        );
        return destroyedList.every((wasDestroyed) => wasDestroyed);
      });
    }
  }

  async #mintInstallationToken(
    repository: ReturnType<typeof parseGithubRepositoryReference>,
  ): Promise<string> {
    const installationToken = await createGithubInstallationTokenForRepository({
      repository,
      appId: this.env.GITHUB_APP_ID,
      privateKeyPem: this.env.GITHUB_APP_PRIVATE_KEY,
      nowMilliseconds: Date.now(),
    });
    return installationToken.token;
  }

  async #getSandbox(
    sandboxId: string,
  ): Promise<SandboxLike & { destroy: () => Promise<void> }> {
    const { getSandbox } = await import('@cloudflare/sandbox');
    // keepAlive because the disk is wiped on sleep: the 10 minute default would
    // take the clone with it while the agent is still thinking.
    const sandbox = getSandbox(this.env.Sandbox, sandboxId, {
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

  async #notifyDevice(
    deviceId: string,
    taskText: string,
    summary: string,
    documentKey?: string,
  ): Promise<void> {
    const apollo = await getAgentByName(this.env.Apollo, deviceId);
    await apollo.notifyBackgroundResult({
      prompt: taskText,
      summary,
      ...(documentKey !== undefined ? { documentKey } : {}),
    });
  }
}

export function buildCommitMessage(taskText: string): string {
  const firstLine = taskText.trim().split('\n')[0].trim();
  const withoutTrailingPeriod = firstLine.replace(/\.+$/, '');
  return `chore: ${withoutTrailingPeriod.slice(0, 88)}`;
}

export function buildPullRequestBody(input: {
  readonly taskText: string;
  readonly agentSummary: string;
  readonly changedFileSummary: string;
}): string {
  return [
    '### Pedido',
    input.taskText,
    '',
    '### Qué hice',
    input.agentSummary.length > 0 ? input.agentSummary : 'Sin resumen del agente.',
    '',
    '### Archivos tocados',
    '```',
    input.changedFileSummary,
    '```',
    '',
    '— Abierto por Apollo desde el escritorio. Revisá antes de mergear.',
  ].join('\n');
}

function buildRunLog(input: {
  readonly repositoryLabel: string;
  readonly taskText: string;
  readonly branchName: string;
  readonly agentSummary: string;
  readonly transcript: readonly string[];
  readonly pullRequestUrl?: string;
}): string {
  return [
    `# Apollo — ${input.repositoryLabel}`,
    '',
    `**Tarea:** ${input.taskText}`,
    `**Branch:** ${input.branchName}`,
    ...(input.pullRequestUrl !== undefined
      ? [`**Pull request:** ${input.pullRequestUrl}`]
      : []),
    '',
    '## Resumen',
    input.agentSummary,
    '',
    '## Herramientas usadas',
    ...input.transcript.map((entry) => `- ${entry}`),
  ].join('\n');
}
