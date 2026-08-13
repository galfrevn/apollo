import { describe, expect, it } from 'bun:test';
import { z } from 'zod';

import { buildTestRsaPrivateKeyPem } from '@/configuration/testing';
import {
  createGithubInstallationTokenForRepository,
  listGithubAppRepositoryFullNameList,
  resolveGithubInstallationId,
  signGithubAppJsonWebToken,
} from '@/github/app';
import { parseGithubRepositoryReference } from '@/github/repository';

type CapturedRequest = {
  readonly url: string;
  readonly init: RequestInit;
};

const jsonWebTokenSegmentSchema = z
  .object({
    alg: z.string(),
    typ: z.string(),
    iss: z.string(),
    iat: z.number(),
    exp: z.number(),
  })
  .partial();

function decodeBase64UrlJson(segment: string): z.infer<typeof jsonWebTokenSegmentSchema> {
  const base64Text = segment.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64Text.padEnd(Math.ceil(base64Text.length / 4) * 4, '=');
  return jsonWebTokenSegmentSchema.parse(JSON.parse(atob(padded)));
}

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
    // Longest fragment wins: "/app/installations/42/access_tokens" also
    // contains "/installation", so first-match would stub the wrong call.
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

describe('signGithubAppJsonWebToken', () => {
  it('signs an RS256 token whose claims GitHub will accept', async () => {
    const privateKeyPem = await buildTestRsaPrivateKeyPem();
    const nowMilliseconds = 1_700_000_000_000;

    const jsonWebToken = await signGithubAppJsonWebToken({
      appId: '123456',
      privateKeyPem,
      nowMilliseconds,
    });

    const [headerSegment, claimsSegment, signatureSegment] = jsonWebToken.split('.');
    expect(decodeBase64UrlJson(headerSegment)).toEqual({ alg: 'RS256', typ: 'JWT' });

    const claims = decodeBase64UrlJson(claimsSegment);
    expect(claims.iss).toBe('123456');
    const nowSeconds = Math.floor(nowMilliseconds / 1000);
    // Backdated against clock drift, and well inside GitHub's 10 minute ceiling.
    expect(Number(claims.iat)).toBeLessThan(nowSeconds);
    expect(Number(claims.exp) - Number(claims.iat)).toBeLessThanOrEqual(600);
    expect(Number(claims.exp)).toBeGreaterThan(nowSeconds);

    expect(signatureSegment.length).toBeGreaterThan(0);
    expect(jsonWebToken).not.toContain('=');
    expect(jsonWebToken).not.toContain('+');
    expect(jsonWebToken).not.toContain('/');
  });

  it('explains how to convert a PKCS#1 key instead of failing obscurely', async () => {
    await expect(
      signGithubAppJsonWebToken({
        appId: '1',
        privateKeyPem:
          '-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----',
        nowMilliseconds: 0,
      }),
    ).rejects.toThrow(/pkcs8/i);
  });

  it('tolerates a PEM pasted as a single line with escaped newlines', async () => {
    const privateKeyPem = await buildTestRsaPrivateKeyPem();
    const singleLinePem = privateKeyPem.replaceAll('\n', '\\n');
    await expect(
      signGithubAppJsonWebToken({
        appId: '1',
        privateKeyPem: singleLinePem,
        nowMilliseconds: 0,
      }),
    ).resolves.toContain('.');
  });
});

describe('resolveGithubInstallationId', () => {
  it('names the uninstalled repository when GitHub answers 404', async () => {
    const { fetchImplementation } = createFetchMock([
      { fragment: '/installation', status: 404, body: {} },
    ]);

    await expect(
      resolveGithubInstallationId({
        repository: parseGithubRepositoryReference('galfrevn/secreto'),
        appJsonWebToken: 'jwt',
        fetchImplementation,
      }),
    ).rejects.toThrow(/no está instalado en galfrevn\/secreto/i);
  });
});

describe('createGithubInstallationTokenForRepository', () => {
  it('exchanges the app key for an installation token', async () => {
    const privateKeyPem = await buildTestRsaPrivateKeyPem();
    const { fetchImplementation, callList } = createFetchMock([
      { fragment: '/installation', status: 200, body: { id: 42 } },
      {
        fragment: '/access_tokens',
        status: 201,
        body: { token: 'ghs_installationtoken', expires_at: '2026-08-10T13:00:00Z' },
      },
    ]);

    const installationToken = await createGithubInstallationTokenForRepository({
      repository: parseGithubRepositoryReference('galfrevn/apollo'),
      appId: '123456',
      privateKeyPem,
      nowMilliseconds: 1_700_000_000_000,
      fetchImplementation,
    });

    expect(installationToken.token).toBe('ghs_installationtoken');
    expect(callList[0].url).toContain('/repos/galfrevn/apollo/installation');
    expect(callList[1].url).toContain('/app/installations/42/access_tokens');
    expect(callList[1].init.method).toBe('POST');
  });

  it('refuses to call GitHub at all when the app is not configured', async () => {
    const { fetchImplementation, callList } = createFetchMock([]);

    await expect(
      createGithubInstallationTokenForRepository({
        repository: parseGithubRepositoryReference('galfrevn/apollo'),
        appId: '',
        privateKeyPem: '',
        nowMilliseconds: 0,
        fetchImplementation,
      }),
    ).rejects.toThrow(/GITHUB_APP_ID/);
    expect(callList).toHaveLength(0);
  });
});

describe('listGithubAppRepositoryFullNameList', () => {
  it('aggregates the repositories of every installation', async () => {
    const privateKeyPem = await buildTestRsaPrivateKeyPem();
    const { fetchImplementation } = createFetchMock([
      {
        fragment: '/app/installations?per_page=100&page=1',
        status: 200,
        body: [{ id: 7 }, { id: 9 }],
      },
      {
        fragment: '/access_tokens',
        status: 201,
        body: { token: 'ghs_token', expires_at: '2026-08-10T13:00:00Z' },
      },
      {
        fragment: '/installation/repositories?per_page=100&page=1',
        status: 200,
        body: {
          repositories: [
            { full_name: 'galfrevn/apollo' },
            { full_name: 'galfrevn/dotfiles' },
          ],
        },
      },
    ]);

    const fullNameList = await listGithubAppRepositoryFullNameList({
      appId: '123456',
      privateKeyPem,
      nowMilliseconds: 1_700_000_000_000,
      fetchImplementation,
    });

    expect(fullNameList).toEqual([
      'galfrevn/apollo',
      'galfrevn/dotfiles',
      'galfrevn/apollo',
      'galfrevn/dotfiles',
    ]);
  });

  it('follows pagination past the first page of repositories', async () => {
    const privateKeyPem = await buildTestRsaPrivateKeyPem();
    const firstPageRepositoryList = Array.from({ length: 100 }, (_, index) => ({
      full_name: `galfrevn/repo-${index}`,
    }));
    const { fetchImplementation, callList } = createFetchMock([
      {
        fragment: '/app/installations?per_page=100&page=1',
        status: 200,
        body: [{ id: 7 }],
      },
      {
        fragment: '/access_tokens',
        status: 201,
        body: { token: 'ghs_token', expires_at: '2026-08-10T13:00:00Z' },
      },
      {
        fragment: '/installation/repositories?per_page=100&page=1',
        status: 200,
        body: { repositories: firstPageRepositoryList },
      },
      {
        fragment: '/installation/repositories?per_page=100&page=2',
        status: 200,
        body: { repositories: [{ full_name: 'galfrevn/repo-100' }] },
      },
    ]);

    const fullNameList = await listGithubAppRepositoryFullNameList({
      appId: '123456',
      privateKeyPem,
      nowMilliseconds: 1_700_000_000_000,
      fetchImplementation,
    });

    expect(fullNameList).toHaveLength(101);
    expect(fullNameList.at(-1)).toBe('galfrevn/repo-100');
    expect(
      callList.some((request) =>
        request.url.includes('/installation/repositories?per_page=100&page=2'),
      ),
    ).toBe(true);
  });

  it('surfaces a failed installations listing as an error', async () => {
    const privateKeyPem = await buildTestRsaPrivateKeyPem();
    const { fetchImplementation } = createFetchMock([
      { fragment: '/app/installations', status: 500, body: {} },
    ]);

    await expect(
      listGithubAppRepositoryFullNameList({
        appId: '123456',
        privateKeyPem,
        nowMilliseconds: 1_700_000_000_000,
        fetchImplementation,
      }),
    ).rejects.toThrow(/instalaciones/);
  });

  it('refuses to call GitHub when the app is not configured', async () => {
    const { fetchImplementation, callList } = createFetchMock([]);

    await expect(
      listGithubAppRepositoryFullNameList({
        appId: '',
        privateKeyPem: '',
        nowMilliseconds: 0,
        fetchImplementation,
      }),
    ).rejects.toThrow(/GITHUB_APP_ID/);
    expect(callList).toHaveLength(0);
  });
});
