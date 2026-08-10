export type GithubRepositoryReference = {
  readonly owner: string;
  readonly repository: string;
};

const GITHUB_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

function isUsableGithubName(candidateName: string): boolean {
  return (
    candidateName.length > 0 &&
    candidateName.length <= 100 &&
    GITHUB_NAME_PATTERN.test(candidateName)
  );
}

export function parseGithubRepositoryReference(
  rawReference: string,
): GithubRepositoryReference {
  const trimmedReference = rawReference.trim();
  if (trimmedReference.length === 0) {
    throw new Error('Falta el repositorio');
  }

  const withoutScheme = trimmedReference
    .replace(/^git@github\.com:/i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  const segmentList = withoutScheme.split('/');
  if (segmentList.length !== 2) {
    throw new Error(`No pude interpretar el repositorio "${rawReference}"`);
  }

  const [owner, repository] = segmentList;
  if (!isUsableGithubName(owner) || !isUsableGithubName(repository)) {
    throw new Error(`No pude interpretar el repositorio "${rawReference}"`);
  }

  return { owner, repository };
}

export function formatGithubRepositoryReference(
  reference: GithubRepositoryReference,
): string {
  return `${reference.owner}/${reference.repository}`;
}

// Last line of defence: a command can still echo a token it was handed, so
// anything bound for a log, a document, an email or TTS passes through here.
export function redactSecretsFromText(
  text: string,
  secretList: readonly (string | undefined)[] = [],
): string {
  let redactedText = text;
  for (const secret of secretList) {
    if (secret === undefined || secret.length < 8) {
      continue;
    }
    redactedText = redactedText.replaceAll(secret, '***');
  }
  return redactedText.replaceAll(/gh[pousr]_[A-Za-z0-9]{16,}/g, '***');
}
