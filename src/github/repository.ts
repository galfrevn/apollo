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

export type SpokenRepositoryResolution =
  | { readonly kind: 'match'; readonly fullName: string }
  | { readonly kind: 'ambiguous'; readonly candidateFullNameList: readonly string[] }
  | { readonly kind: 'none' };

function splitIntoSpokenTokenList(text: string): readonly string[] {
  return text
    .toLowerCase()
    .split(/[\s./_-]+/)
    .filter((token) => token.length > 0);
}

function normalizeRepositoryName(name: string): string {
  return splitIntoSpokenTokenList(name).join('');
}

// The repository name has to appear as consecutive words somewhere in the
// spoken phrase, so surrounding words in any language fall away without a
// stopword list; the widest window wins so "apollo firmware" resolves to
// apollo-firmware instead of tying with apollo.
function selectRepositoriesMatchingTokenWindow(
  spokenTokenList: readonly string[],
  candidateList: readonly { fullName: string; normalizedNameList: string[] }[],
): readonly string[] {
  for (let windowSize = spokenTokenList.length; windowSize >= 1; windowSize -= 1) {
    const matchedFullNameSet = new Set<string>();
    for (
      let startIndex = 0;
      startIndex + windowSize <= spokenTokenList.length;
      startIndex += 1
    ) {
      const windowText = spokenTokenList
        .slice(startIndex, startIndex + windowSize)
        .join('');
      for (const candidate of candidateList) {
        if (candidate.normalizedNameList.includes(windowText)) {
          matchedFullNameSet.add(candidate.fullName);
        }
      }
    }
    if (matchedFullNameSet.size > 0) {
      return [...matchedFullNameSet];
    }
  }
  return [];
}

export function resolveSpokenRepositoryReference(
  spokenReference: string,
  installedFullNameList: readonly string[],
): SpokenRepositoryResolution {
  const spokenTokenList = splitIntoSpokenTokenList(spokenReference);
  if (spokenTokenList.length === 0) {
    return { kind: 'none' };
  }

  const candidateList = installedFullNameList.map((fullName) => ({
    fullName,
    normalizedNameList: [
      normalizeRepositoryName(fullName.split('/')[1] ?? ''),
      normalizeRepositoryName(fullName),
    ].filter((name) => name.length > 0),
  }));

  const windowMatchList = selectRepositoriesMatchingTokenWindow(
    spokenTokenList,
    candidateList,
  );
  const normalizedSpoken = spokenTokenList.join('');
  const matchList =
    windowMatchList.length > 0
      ? windowMatchList
      : candidateList
          .filter((candidate) =>
            candidate.normalizedNameList.some((name) => name.includes(normalizedSpoken)),
          )
          .map((candidate) => candidate.fullName);

  const [firstMatch] = matchList;
  if (firstMatch !== undefined && matchList.length === 1) {
    return { kind: 'match', fullName: firstMatch };
  }
  if (matchList.length > 1) {
    return { kind: 'ambiguous', candidateFullNameList: matchList };
  }
  return { kind: 'none' };
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
