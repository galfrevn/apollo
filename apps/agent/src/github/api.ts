import { z } from 'zod';

import {
  buildGithubRequestHeaders,
  GITHUB_API_BASE_URL,
  GITHUB_API_USER_AGENT,
} from '@/github/app';
import type { GithubRepositoryReference } from '@/github/repository';

const repositoryResponseSchema = z.object({
  default_branch: z.string().min(1),
});

const pullRequestResponseSchema = z.object({
  number: z.number().int().positive(),
  html_url: z.string().min(1),
});

const botUserResponseSchema = z.object({
  id: z.number().int().positive(),
});

const appResponseSchema = z.object({
  slug: z.string().min(1),
});

export type GithubPullRequest = {
  readonly number: number;
  readonly url: string;
};

export type GithubCommitIdentity = {
  readonly name: string;
  readonly email: string;
};

export async function resolveGithubDefaultBranch(input: {
  readonly repository: GithubRepositoryReference;
  readonly installationToken: string;
  readonly fetchImplementation?: typeof fetch;
}): Promise<string> {
  const fetchImplementation = input.fetchImplementation ?? globalThis.fetch;
  const response = await fetchImplementation(
    `${GITHUB_API_BASE_URL}/repos/${input.repository.owner}/${input.repository.repository}`,
    { headers: buildGithubRequestHeaders(`Bearer ${input.installationToken}`) },
  );
  if (!response.ok) {
    throw new Error(`No pude leer el repositorio (status ${response.status})`);
  }
  return repositoryResponseSchema.parse(await response.json()).default_branch;
}

export async function createGithubPullRequest(input: {
  readonly repository: GithubRepositoryReference;
  readonly installationToken: string;
  readonly headBranch: string;
  readonly baseBranch: string;
  readonly title: string;
  readonly body: string;
  readonly fetchImplementation?: typeof fetch;
}): Promise<GithubPullRequest> {
  if (input.headBranch === input.baseBranch) {
    throw new Error('El branch de trabajo no puede ser el branch base');
  }
  const fetchImplementation = input.fetchImplementation ?? globalThis.fetch;
  const response = await fetchImplementation(
    `${GITHUB_API_BASE_URL}/repos/${input.repository.owner}/${input.repository.repository}/pulls`,
    {
      method: 'POST',
      headers: {
        ...buildGithubRequestHeaders(`Bearer ${input.installationToken}`),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: input.title,
        body: input.body,
        head: input.headBranch,
        base: input.baseBranch,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`No pude abrir el pull request (status ${response.status})`);
  }
  const payload = pullRequestResponseSchema.parse(await response.json());
  return { number: payload.number, url: payload.html_url };
}

// The noreply address needs the bot user's id, which is not the App ID — the
// bot is a separate account. Getting it wrong unlinks commits from the App.
export async function resolveGithubAppCommitIdentity(input: {
  readonly appJsonWebToken: string;
  readonly fetchImplementation?: typeof fetch;
}): Promise<GithubCommitIdentity> {
  const fetchImplementation = input.fetchImplementation ?? globalThis.fetch;
  const appResponse = await fetchImplementation(`${GITHUB_API_BASE_URL}/app`, {
    headers: buildGithubRequestHeaders(`Bearer ${input.appJsonWebToken}`),
  });
  if (!appResponse.ok) {
    throw new Error(`No pude leer el GitHub App (status ${appResponse.status})`);
  }
  const appSlug = appResponseSchema.parse(await appResponse.json()).slug;

  const botLogin = `${appSlug}[bot]`;
  const botResponse = await fetchImplementation(
    `${GITHUB_API_BASE_URL}/users/${encodeURIComponent(botLogin)}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': GITHUB_API_USER_AGENT,
      },
    },
  );
  if (!botResponse.ok) {
    throw new Error(`No pude leer el usuario bot (status ${botResponse.status})`);
  }
  const botUserId = botUserResponseSchema.parse(await botResponse.json()).id;

  return {
    name: botLogin,
    email: `${botUserId}+${botLogin}@users.noreply.github.com`,
  };
}
