import type { z } from 'zod';

import type { notifyBackgroundResultInputSchema } from '@/agents/rpc';
import { runCodingAgent } from '@/coding/agent';
import { buildCodingBranchName } from '@/coding/git';
import {
  buildCodingDocumentObjectKey,
  buildCodingPublishSandboxId,
  buildCodingSandboxId,
} from '@/coding/keys';
import { runOpencodeAgent } from '@/coding/opencode';
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
import type { BlobStore } from '@/platform/blob';
import type { StepRunner } from '@/platform/steps';
import { CODING_UNAVAILABLE_SPOKEN_SUMMARY } from '@/sandbox/capability';
import { chatWithOpenRouter } from '@/voice/llm';

export type CodingRunParams = {
  readonly repository: string;
  readonly task: string;
  readonly deviceId: string;
};

export type CodingRunResult = {
  readonly summary: string;
  readonly pullRequestUrl?: string;
};

export type CodingSandboxHandle = SandboxLike & { destroy: () => Promise<void> };

type BackgroundResultNotification = z.infer<typeof notifyBackgroundResultInputSchema>;

export type CodingRunDependencies = {
  readonly openRouterApiKey: string;
  readonly codingModelId: string;
  readonly codingEngine: string | undefined;
  readonly codingProxyOrigin: string | undefined;
  readonly githubAppId: string;
  readonly githubAppPrivateKeyPem: string;
  readonly mediaBlobStore: BlobStore;
  readonly mintCodingProxyToken: (instanceId: string) => Promise<string>;
  readonly createSandbox:
    | ((sandboxId: string) => Promise<CodingSandboxHandle>)
    | undefined;
  readonly notifyApollo: (notification: BackgroundResultNotification) => Promise<void>;
};

export async function executeCodingTaskRun(input: {
  readonly params: CodingRunParams;
  readonly instanceId: string;
  readonly steps: StepRunner;
  readonly dependencies: CodingRunDependencies;
}): Promise<CodingRunResult> {
  const { params, instanceId, steps, dependencies } = input;
  const createSandbox = dependencies.createSandbox;

  // The tool layer already refuses to enqueue without the capability; this
  // guard covers instances created any other way (console, replays).
  if (createSandbox === undefined) {
    const summary = CODING_UNAVAILABLE_SPOKEN_SUMMARY;
    await notifyDevice(dependencies, params.task, summary);
    return { summary };
  }
  const repository = parseGithubRepositoryReference(params.repository);
  const repositoryLabel = `${repository.owner}/${repository.repository}`;
  const agentSandboxId = buildCodingSandboxId(instanceId);
  const publishSandboxId = buildCodingPublishSandboxId(instanceId);

  // First and outside the container: a repository the App was never installed
  // on fails here, before a container boots or a model token is spent.
  const setup = await steps.do('resolve-github-access', async () => {
    const installationToken = await createGithubInstallationTokenForRepository({
      repository,
      appId: dependencies.githubAppId,
      privateKeyPem: dependencies.githubAppPrivateKeyPem,
      nowMilliseconds: Date.now(),
    });
    const appJsonWebToken = await signGithubAppJsonWebToken({
      appId: dependencies.githubAppId,
      privateKeyPem: dependencies.githubAppPrivateKeyPem,
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

  const branchName = await steps.do('choose-branch', async () =>
    buildCodingBranchName(params.task, () => instanceId.slice(0, 8)),
  );

  try {
    await steps.do('prepare-workspace', async () => {
      const sandbox = await createSandbox(agentSandboxId);
      const installationToken = await mintInstallationToken(dependencies, repository);
      await prepareCodingWorkspace({
        sandbox,
        repository,
        baseBranch: setup.baseBranch,
        installationToken,
      });
      return true;
    });

    const agentOutcome = await steps.do(
      'run-coding-agent',
      { retries: { limit: 1, delayMilliseconds: 10_000, backoff: 'constant' } },
      async () => {
        const sandbox = await createSandbox(agentSandboxId);
        // opencode manages its own loop and context; the hand-rolled agent
        // stays as the fallback while the proxy origin is unset, and as an
        // escape hatch behind CODING_ENGINE=legacy.
        const proxyOrigin = dependencies.codingProxyOrigin;
        if (dependencies.codingEngine !== 'legacy' && proxyOrigin !== undefined) {
          return runOpencodeAgent({
            sandbox,
            proxyOrigin,
            proxyToken: await dependencies.mintCodingProxyToken(instanceId),
            modelId: dependencies.codingModelId,
            taskText: params.task,
          });
        }
        return runCodingAgent({
          sandbox: buildAgentSandboxPort(sandbox),
          callLlm: async ({ messageList, toolDefinitionList }) =>
            chatWithOpenRouter({
              openRouterApiKey: dependencies.openRouterApiKey,
              modelId: dependencies.codingModelId,
              messageList,
              toolDefinitionList,
            }),
          repositoryLabel,
          taskText: params.task,
        });
      },
    );

    const extraction = await steps.do('extract-changes', async () => {
      const sandbox = await createSandbox(agentSandboxId);
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
      const documentKey = buildCodingDocumentObjectKey(params.deviceId, instanceId);
      await steps.do('persist-log', async () => {
        const runLog = buildRunLog({
          repositoryLabel,
          taskText: params.task,
          branchName,
          agentSummary: agentOutcome.summary,
          transcript: agentOutcome.transcript,
        });
        await dependencies.mediaBlobStore.put(
          documentKey,
          redactSecretsFromText(runLog),
          { contentType: 'text/markdown; charset=utf-8' },
        );
        return true;
      });
      await notifyDevice(dependencies, params.task, summary, documentKey);
      return { summary };
    }

    // Minted again rather than reused: a token lasts an hour and the agent
    // loop above can run longer than that.
    await steps.do('publish-changes', async () => {
      const sandbox = await createSandbox(publishSandboxId);
      const installationToken = await mintInstallationToken(dependencies, repository);
      await publishCodingChanges({
        sandbox,
        repository,
        baseBranch: setup.baseBranch,
        branchName,
        commitIdentity: setup.commitIdentity,
        commitMessage: buildCommitMessage(params.task),
        patchText: extraction.patchText,
        installationToken,
      });
      return true;
    });

    const pullRequest = await steps.do('open-pull-request', async () => {
      const installationToken = await mintInstallationToken(dependencies, repository);
      return createGithubPullRequest({
        repository,
        installationToken,
        headBranch: branchName,
        baseBranch: setup.baseBranch,
        title: buildCommitMessage(params.task),
        body: buildPullRequestBody({
          taskText: params.task,
          agentSummary: agentOutcome.summary,
          changedFileSummary: extraction.changedFileSummary,
        }),
      });
    });

    const documentKey = buildCodingDocumentObjectKey(params.deviceId, instanceId);
    await steps.do('persist-log', async () => {
      const runLog = buildRunLog({
        repositoryLabel,
        taskText: params.task,
        branchName,
        agentSummary: agentOutcome.summary,
        transcript: agentOutcome.transcript,
        pullRequestUrl: pullRequest.url,
      });
      await dependencies.mediaBlobStore.put(documentKey, redactSecretsFromText(runLog), {
        contentType: 'text/markdown; charset=utf-8',
      });
      return true;
    });

    const summary = `${agentOutcome.summary} Dejé el pull request ${pullRequest.number} en ${repositoryLabel}.`;
    await notifyDevice(dependencies, params.task, summary, documentKey);
    return { summary, pullRequestUrl: pullRequest.url };
  } finally {
    // Billing runs while the container is alive, so this runs even on
    // failure — but it must not turn a finished run into a failed one, nor
    // bury the error that brought us here.
    await steps.do('destroy-sandbox', async () => {
      const destroyedList = await Promise.all(
        [agentSandboxId, publishSandboxId].map(async (sandboxId) => {
          try {
            const sandbox = await createSandbox(sandboxId);
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

async function mintInstallationToken(
  dependencies: CodingRunDependencies,
  repository: ReturnType<typeof parseGithubRepositoryReference>,
): Promise<string> {
  const installationToken = await createGithubInstallationTokenForRepository({
    repository,
    appId: dependencies.githubAppId,
    privateKeyPem: dependencies.githubAppPrivateKeyPem,
    nowMilliseconds: Date.now(),
  });
  return installationToken.token;
}

async function notifyDevice(
  dependencies: CodingRunDependencies,
  taskText: string,
  summary: string,
  documentKey?: string,
): Promise<void> {
  const backgroundResultNotification: BackgroundResultNotification = {
    prompt: taskText,
    summary,
  };
  if (documentKey !== undefined) {
    backgroundResultNotification.documentKey = documentKey;
  }
  await dependencies.notifyApollo(backgroundResultNotification);
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
