import { describe, expect, it } from 'bun:test';

import {
  createGithubInstallationTokenForRepository,
  resolveGithubInstallationId,
  signGithubAppJsonWebToken,
} from '@/github/app';
import { parseGithubRepositoryReference } from '@/github/repository';

type CapturedRequest = {
  readonly url: string;
  readonly init: RequestInit;
};

async function buildTestPrivateKeyPem(): Promise<string> {
  const generatedKey = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  if (!('privateKey' in generatedKey)) {
    throw new Error('generateKey did not return a key pair');
  }
  const exportedKey = await crypto.subtle.exportKey('pkcs8', generatedKey.privateKey);
  if (!(exportedKey instanceof ArrayBuffer)) {
    throw new Error('exportKey did not return pkcs8 bytes');
  }
  const pkcs8Bytes = new Uint8Array(exportedKey);
  let binaryText = '';
  for (const byte of pkcs8Bytes) {
    binaryText += String.fromCharCode(byte);
  }
  const base64Body = btoa(binaryText).replaceAll(/(.{64})/g, '$1\n');
  return `-----BEGIN PRIVATE KEY-----\n${base64Body}\n-----END PRIVATE KEY-----`;
}

function decodeBase64UrlJson(segment: string): Record<string, unknown> {
  const base64Text = segment.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64Text.padEnd(Math.ceil(base64Text.length / 4) * 4, '=');
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

function createFetchMock(
  responseByUrlFragment: readonly {
    readonly fragment: string;
    readonly status: number;
    readonly body: unknown;
  }[],
): { readonly fetchImplementation: typeof fetch; readonly callList: CapturedRequest[] } {
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
  return {
    fetchImplementation: Object.assign(fetchHandler, {
      preconnect: () => {},
    }) as typeof fetch,
    callList,
  };
}

describe('signGithubAppJsonWebToken', () => {
  it('signs an RS256 token whose claims GitHub will accept', async () => {
    const privateKeyPem = await buildTestPrivateKeyPem();
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
    const privateKeyPem = await buildTestPrivateKeyPem();
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
    const privateKeyPem = await buildTestPrivateKeyPem();
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
