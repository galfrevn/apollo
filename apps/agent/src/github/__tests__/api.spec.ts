import { describe, expect, it } from 'bun:test';

import {
  createGithubPullRequest,
  resolveGithubAppCommitIdentity,
  resolveGithubDefaultBranch,
} from '@/github/api';
import { parseGithubRepositoryReference } from '@/github/repository';

type CapturedRequest = {
  readonly url: string;
  readonly init: RequestInit;
};

function createFetchMock(
  responseByUrlFragment: readonly {
    readonly fragment: string;
    readonly status: number;
    readonly body: unknown;
  }[],
) {
  const callList: CapturedRequest[] = [];
  const fetchHandler = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = String(input);
    callList.push({ url, init: init ?? {} });
    const matched = [...responseByUrlFragment]
      .toSorted((left, right) => right.fragment.length - left.fragment.length)
      .find((candidate) => url.includes(candidate.fragment));
    if (matched === undefined) {
      return new Response('{}', { status: 500 });
    }
    return new Response(JSON.stringify(matched.body), { status: matched.status });
  };
  // SAFETY: the code under test only invokes fetch's call signature and never
  // touches other members, so the handler plus a preconnect stub covers the
  // whole surface this suite exercises.
  const fetchImplementation = Object.assign(fetchHandler, {
    preconnect: () => {},
  }) as typeof fetch;
  return { fetchImplementation, callList };
}

const apolloRepository = parseGithubRepositoryReference('example/apollo');

describe('resolveGithubDefaultBranch', () => {
  it('reads the default branch off the repository', async () => {
    const { fetchImplementation } = createFetchMock([
      {
        fragment: '/repos/example/apollo',
        status: 200,
        body: { default_branch: 'main' },
      },
    ]);

    await expect(
      resolveGithubDefaultBranch({
        repository: apolloRepository,
        installationToken: 'ghs_token',
        fetchImplementation,
      }),
    ).resolves.toBe('main');
  });

  it('fails loudly when the repository cannot be read', async () => {
    const { fetchImplementation } = createFetchMock([
      { fragment: '/repos/example/apollo', status: 403, body: {} },
    ]);

    await expect(
      resolveGithubDefaultBranch({
        repository: apolloRepository,
        installationToken: 'ghs_token',
        fetchImplementation,
      }),
    ).rejects.toThrow(/403/);
  });
});

describe('createGithubPullRequest', () => {
  it('opens the pull request from the work branch onto the base', async () => {
    const { fetchImplementation, callList } = createFetchMock([
      {
        fragment: '/pulls',
        status: 201,
        body: { number: 7, html_url: 'https://github.com/example/apollo/pull/7' },
      },
    ]);

    const pullRequest = await createGithubPullRequest({
      repository: apolloRepository,
      installationToken: 'ghs_token',
      headBranch: 'apollo/arreglar-typo-a1b2',
      baseBranch: 'main',
      title: 'Arreglar typo',
      body: 'Hecho por Apollo.',
      fetchImplementation,
    });

    expect(pullRequest).toEqual({
      number: 7,
      url: 'https://github.com/example/apollo/pull/7',
    });
    const requestBody = JSON.parse(String(callList[0].init.body));
    expect(requestBody.head).toBe('apollo/arreglar-typo-a1b2');
    expect(requestBody.base).toBe('main');
  });

  it('refuses to target the base branch as its own head', async () => {
    const { fetchImplementation, callList } = createFetchMock([]);

    await expect(
      createGithubPullRequest({
        repository: apolloRepository,
        installationToken: 'ghs_token',
        headBranch: 'main',
        baseBranch: 'main',
        title: 't',
        body: 'b',
        fetchImplementation,
      }),
    ).rejects.toThrow(/no puede ser el branch base/i);
    expect(callList).toHaveLength(0);
  });
});

describe('resolveGithubAppCommitIdentity', () => {
  it('builds the noreply address from the bot user id, not the app id', async () => {
    const { fetchImplementation } = createFetchMock([
      { fragment: '/app', status: 200, body: { slug: 'apollo-desk' } },
      { fragment: '/users/', status: 200, body: { id: 987654 } },
    ]);

    await expect(
      resolveGithubAppCommitIdentity({
        appJsonWebToken: 'jwt',
        fetchImplementation,
      }),
    ).resolves.toEqual({
      name: 'apollo-desk[bot]',
      email: '987654+apollo-desk[bot]@users.noreply.github.com',
    });
  });
});
