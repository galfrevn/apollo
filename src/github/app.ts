import { z } from 'zod';

import type { GithubRepositoryReference } from '@/github/repository';

export const GITHUB_API_BASE_URL = 'https://api.github.com';
export const GITHUB_API_USER_AGENT = 'apollo-desk-agent';

// GitHub rejects a JWT whose `exp` is more than 10 minutes out, and clocks
// between here and GitHub drift, so the window stays deliberately short.
const APP_JWT_LIFETIME_SECONDS = 480;
const APP_JWT_CLOCK_SKEW_SECONDS = 30;

const installationResponseSchema = z.object({
  id: z.number().int().positive(),
});

const installationListResponseSchema = z.array(installationResponseSchema);

const installationRepositoriesResponseSchema = z.object({
  repositories: z.array(z.object({ full_name: z.string().min(1) })),
});

const installationTokenResponseSchema = z.object({
  token: z.string().min(1),
  expires_at: z.string().min(1),
});

export type GithubInstallationToken = {
  readonly token: string;
  readonly expiresAt: string;
};

function encodeBase64Url(bytes: Uint8Array): string {
  let binaryText = '';
  for (const byte of bytes) {
    binaryText += String.fromCharCode(byte);
  }
  return btoa(binaryText).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decodeBase64ToBytes(base64Text: string): Uint8Array {
  const binaryText = atob(base64Text);
  const bytes = new Uint8Array(binaryText.length);
  for (let index = 0; index < binaryText.length; index += 1) {
    bytes[index] = binaryText.charCodeAt(index);
  }
  return bytes;
}

// A PEM pasted as one line keeps literal "\n", and GitHub hands out PKCS#1
// while importKey('pkcs8') needs PKCS#8.
function extractPrivateKeyDerBytes(privateKeyPem: string): Uint8Array {
  const normalizedPem = privateKeyPem.replaceAll('\\n', '\n').trim();
  if (normalizedPem.includes('BEGIN RSA PRIVATE KEY')) {
    throw new Error(
      'La clave del GitHub App está en formato PKCS#1; convertila con: openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in clave.pem -out clave-pkcs8.pem',
    );
  }
  const base64Body = normalizedPem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replaceAll(/\s+/g, '');
  if (base64Body.length === 0) {
    throw new Error('La clave privada del GitHub App está vacía');
  }
  return decodeBase64ToBytes(base64Body);
}

export async function signGithubAppJsonWebToken(input: {
  readonly appId: string;
  readonly privateKeyPem: string;
  readonly nowMilliseconds: number;
}): Promise<string> {
  const issuedAtSeconds =
    Math.floor(input.nowMilliseconds / 1000) - APP_JWT_CLOCK_SKEW_SECONDS;
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + APP_JWT_LIFETIME_SECONDS,
    iss: input.appId,
  };

  const textEncoder = new TextEncoder();
  const signingInput = `${encodeBase64Url(
    textEncoder.encode(JSON.stringify(header)),
  )}.${encodeBase64Url(textEncoder.encode(JSON.stringify(claims)))}`;

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    extractPrivateKeyDerBytes(input.privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    textEncoder.encode(signingInput),
  );

  return `${signingInput}.${encodeBase64Url(new Uint8Array(signatureBytes))}`;
}

export function buildGithubRequestHeaders(authorizationValue: string): HeadersInit {
  return {
    Authorization: authorizationValue,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': GITHUB_API_USER_AGENT,
  };
}

export async function resolveGithubInstallationId(input: {
  readonly repository: GithubRepositoryReference;
  readonly appJsonWebToken: string;
  readonly fetchImplementation?: typeof fetch;
}): Promise<number> {
  const fetchImplementation = input.fetchImplementation ?? globalThis.fetch;
  const response = await fetchImplementation(
    `${GITHUB_API_BASE_URL}/repos/${input.repository.owner}/${input.repository.repository}/installation`,
    { headers: buildGithubRequestHeaders(`Bearer ${input.appJsonWebToken}`) },
  );

  if (response.status === 404) {
    throw new Error(
      `El GitHub App de Apollo no está instalado en ${input.repository.owner}/${input.repository.repository}`,
    );
  }
  if (!response.ok) {
    throw new Error(`No pude resolver la instalación (status ${response.status})`);
  }

  return installationResponseSchema.parse(await response.json()).id;
}

export async function createGithubInstallationToken(input: {
  readonly installationId: number;
  readonly appJsonWebToken: string;
  readonly fetchImplementation?: typeof fetch;
}): Promise<GithubInstallationToken> {
  const fetchImplementation = input.fetchImplementation ?? globalThis.fetch;
  const response = await fetchImplementation(
    `${GITHUB_API_BASE_URL}/app/installations/${input.installationId}/access_tokens`,
    {
      method: 'POST',
      headers: buildGithubRequestHeaders(`Bearer ${input.appJsonWebToken}`),
    },
  );

  if (!response.ok) {
    throw new Error(`No pude crear el token de instalación (status ${response.status})`);
  }

  const payload = installationTokenResponseSchema.parse(await response.json());
  return { token: payload.token, expiresAt: payload.expires_at };
}

// The App's installation list doubles as the coding allowlist, so this is
// also how the agent learns which repositories it may touch.
export async function listGithubAppRepositoryFullNameList(input: {
  readonly appId: string;
  readonly privateKeyPem: string;
  readonly nowMilliseconds: number;
  readonly fetchImplementation?: typeof fetch;
}): Promise<readonly string[]> {
  if (input.appId.length === 0 || input.privateKeyPem.length === 0) {
    throw new Error('Faltan GITHUB_APP_ID o GITHUB_APP_PRIVATE_KEY');
  }
  const fetchImplementation = input.fetchImplementation ?? globalThis.fetch;
  const appJsonWebToken = await signGithubAppJsonWebToken({
    appId: input.appId,
    privateKeyPem: input.privateKeyPem,
    nowMilliseconds: input.nowMilliseconds,
  });

  const installationsResponse = await fetchImplementation(
    `${GITHUB_API_BASE_URL}/app/installations?per_page=100`,
    { headers: buildGithubRequestHeaders(`Bearer ${appJsonWebToken}`) },
  );
  if (!installationsResponse.ok) {
    throw new Error(
      `No pude listar las instalaciones del App (status ${installationsResponse.status})`,
    );
  }
  const installationList = installationListResponseSchema.parse(
    await installationsResponse.json(),
  );

  const fullNameList: string[] = [];
  for (const installation of installationList) {
    const installationToken = await createGithubInstallationToken({
      installationId: installation.id,
      appJsonWebToken,
      ...(input.fetchImplementation !== undefined
        ? { fetchImplementation: input.fetchImplementation }
        : {}),
    });
    const repositoriesResponse = await fetchImplementation(
      `${GITHUB_API_BASE_URL}/installation/repositories?per_page=100`,
      { headers: buildGithubRequestHeaders(`token ${installationToken.token}`) },
    );
    if (!repositoriesResponse.ok) {
      throw new Error(
        `No pude listar los repositorios de una instalación (status ${repositoriesResponse.status})`,
      );
    }
    const payload = installationRepositoriesResponseSchema.parse(
      await repositoriesResponse.json(),
    );
    fullNameList.push(...payload.repositories.map((repository) => repository.full_name));
  }
  return fullNameList;
}

export async function createGithubInstallationTokenForRepository(input: {
  readonly repository: GithubRepositoryReference;
  readonly appId: string;
  readonly privateKeyPem: string;
  readonly nowMilliseconds: number;
  readonly fetchImplementation?: typeof fetch;
}): Promise<GithubInstallationToken> {
  if (input.appId.length === 0 || input.privateKeyPem.length === 0) {
    throw new Error('Faltan GITHUB_APP_ID o GITHUB_APP_PRIVATE_KEY');
  }
  const appJsonWebToken = await signGithubAppJsonWebToken({
    appId: input.appId,
    privateKeyPem: input.privateKeyPem,
    nowMilliseconds: input.nowMilliseconds,
  });
  const installationId = await resolveGithubInstallationId({
    repository: input.repository,
    appJsonWebToken,
    ...(input.fetchImplementation !== undefined
      ? { fetchImplementation: input.fetchImplementation }
      : {}),
  });
  return createGithubInstallationToken({
    installationId,
    appJsonWebToken,
    ...(input.fetchImplementation !== undefined
      ? { fetchImplementation: input.fetchImplementation }
      : {}),
  });
}
